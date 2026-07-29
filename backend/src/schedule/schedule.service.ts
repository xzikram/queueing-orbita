import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HisApiService } from '../adapters/his-api.service';
import { parseLocalDate } from '../common/timezone.utils';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private prisma: PrismaService,
    private hisApiService: HisApiService,
    private displayGateway: DisplayGateway,
  ) {}

  async findActiveToday() {
    let tzOffset = 8; // Default to Asia/Makassar (WITA, UTC+8)
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    const now = new Date();
    const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth();
    const day = localDate.getUTCDate();

    const today = new Date(
      Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
    );
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.doctorSchedule.findMany({
      where: {
        scheduleDate: { gte: today, lt: tomorrow },
        status: 'ACTIVE',
      },
      include: {
        doctor: true,
        room: { include: { floor: true } },
        floor: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findAll(query?: { date?: string; doctorId?: string; roomId?: string }) {
    const where: any = {};

    if (query?.date) {
      const date = parseLocalDate(query.date);
      const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      where.scheduleDate = { gte: date, lt: nextDay };
    }

    if (query?.doctorId) where.doctorId = query.doctorId;
    if (query?.roomId) where.roomId = query.roomId;

    return this.prisma.doctorSchedule.findMany({
      where,
      include: {
        doctor: true,
        room: { include: { floor: true } },
        floor: true,
      },
      orderBy: [{ scheduleDate: 'desc' }, { startTime: 'asc' }],
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id },
      include: { doctor: true, room: true, floor: true },
    });
    if (!schedule) throw new NotFoundException('Jadwal tidak ditemukan');
    return schedule;
  }

  async create(data: any) {
    const { reason, ...createData } = data;
    if (createData.scheduleDate) {
      createData.scheduleDate = parseLocalDate(createData.scheduleDate);
    }
    return this.prisma.doctorSchedule.create({
      data: createData,
      include: { doctor: true, room: true, floor: true },
    });
  }

  async update(
    id: string,
    data: any,
    reason?: string,
    username: string = 'System',
  ) {
    const old = await this.findOne(id);
    const updateData = { ...data };
    if (updateData.scheduleDate) {
      updateData.scheduleDate = parseLocalDate(updateData.scheduleDate);
    }
    const updated = await this.prisma.doctorSchedule.update({
      where: { id },
      data: updateData,
      include: { doctor: true, room: true, floor: true },
    });

    if (reason) {
      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'DoctorSchedule',
          entityId: id,
          userName: username,
          unitType: 'SCHEDULE',
          humanDescription: `Edit Jadwal dr. ${old.doctor?.doctorName} pada ${old.scheduleDate.toLocaleDateString()}. Alasan: ${reason}`,
          reason,
          oldValue: JSON.stringify(old),
          newValue: JSON.stringify(updated),
        },
      });
    }

    return updated;
  }

  async delete(id: string, reason?: string, username: string = 'System') {
    const old = await this.findOne(id);
    await this.prisma.doctorSchedule.delete({ where: { id } });

    if (reason) {
      await this.prisma.auditLog.create({
        data: {
          action: 'DELETE',
          entity: 'DoctorSchedule',
          entityId: id,
          userName: username,
          unitType: 'SCHEDULE',
          humanDescription: `Hapus Jadwal dr. ${old.doctor?.doctorName} pada ${old.scheduleDate.toLocaleDateString()}. Alasan: ${reason}`,
          reason,
          oldValue: JSON.stringify(old),
        },
      });
    }

    return { message: 'Jadwal berhasil dihapus' };
  }

  async deleteAll() {
    await this.prisma.doctorSchedule.deleteMany();
    return { message: 'Semua jadwal berhasil dihapus' };
  }

  // --- HIS SYNC LOGIC ---

  async getAppointmentArrivalTracking(
    scheduleId?: string,
    targetDateStr?: string,
  ) {
    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    let today = new Date();
    const localTime = today.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    let year = localDate.getUTCFullYear();
    let month = localDate.getUTCMonth();
    let day = localDate.getUTCDate();

    let selectedSchedule: any = null;
    if (scheduleId) {
      selectedSchedule = await this.prisma.doctorSchedule.findUnique({
        where: { id: scheduleId },
        include: { doctor: true, room: { include: { floor: true } } },
      });
      if (selectedSchedule && selectedSchedule.scheduleDate) {
        const d = new Date(selectedSchedule.scheduleDate);
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      }
    }

    if (targetDateStr) {
      const cleanStr = String(targetDateStr).trim();
      if (cleanStr.includes('-') || cleanStr.includes('/')) {
        const delimiter = cleanStr.includes('-') ? '-' : '/';
        const parts = cleanStr.split(delimiter);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
        }
      } else {
        const digits = cleanStr.replace(/[^0-9]/g, '');
        if (digits.length === 8) {
          year = parseInt(digits.substring(0, 4), 10);
          month = parseInt(digits.substring(4, 6), 10) - 1;
          day = parseInt(digits.substring(6, 8), 10);
        }
      }
    }

    const mmStr = String(month + 1).padStart(2, '0');
    const ddStr = String(day).padStart(2, '0');
    const isoDateStr = `${year}-${mmStr}-${ddStr}`;

    const startOfDay = new Date(`${isoDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${isoDateStr}T23:59:59.999Z`);

    const bridgeUrl =
      process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
    const bridgeToken =
      process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';
    const url = new URL(bridgeUrl);
    url.searchParams.append('token', bridgeToken);

    const executeSql = async (sql: string) => {
      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ query: sql }).toString(),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        return [];
      }
    };

    // Fetch SIMRS appointments, SIMRS registrations, ParamedicLeaves, and local Orbita Visits
    const [appointments, registrations, leaves, localVisits] =
      await Promise.all([
        executeSql(`
        SELECT 
          AppointmentNo, ParamedicID, ParamedicName, MedicalNo, PatientID, PatientName,
          MobilePhoneNo, AppointmentDate, AppointmentTime, SaranDatang, AppointmentQue, Notes, ServiceUnitName
        FROM vwAppointment
        WHERE AppointmentDate >= '${isoDateStr} 00:00:00' AND AppointmentDate <= '${isoDateStr} 23:59:59'
        ORDER BY ParamedicName, AppointmentQue ASC
      `),
        executeSql(`
        SELECT 
          r.RegistrationNo, r.RegistrationDate, r.PatientID, r.AppointmentNo, r.RegistrationQue, r.ParamedicID
        FROM Registration r
        WHERE r.RegistrationDate >= '${isoDateStr} 00:00:00' AND r.RegistrationDate <= '${isoDateStr} 23:59:59'
          AND r.IsVoid = 0
      `),
        executeSql(`
        SELECT pl.ParamedicID, p.ParamedicName, pl.Notes
        FROM ParamedicLeave pl
        LEFT JOIN Paramedic p ON pl.ParamedicID = p.ParamedicID
        WHERE pl.IsApproved = 1
          AND pl.StartDate <= '${isoDateStr} 23:59:59'
          AND pl.EndDate >= '${isoDateStr} 00:00:00'
      `),
        this.prisma.visit.findMany({
          where: {
            visitDate: { gte: startOfDay, lt: endOfDay },
            ...(selectedSchedule?.doctorId
              ? { selectedDoctorId: selectedSchedule.doctorId }
              : {}),
          },
          include: { queueTicket: true },
        }),
      ]);

    const regMap = new Map<string, any>();
    const patientRegMap = new Map<string, any>();

    for (const r of registrations) {
      if (r.AppointmentNo) regMap.set(r.AppointmentNo, r);
      if (r.PatientID) patientRegMap.set(r.PatientID, r);
    }

    const localVisitMap = new Map<string, any>();
    for (const v of localVisits) {
      if (v.patientRmNo) localVisitMap.set(v.patientRmNo, v);
    }

    const leaveDocSet = new Set(leaves.map((l: any) => l.ParamedicID));

    const localDoctors = await this.prisma.doctor.findMany({
      select: { id: true, doctorCode: true, doctorInitials: true },
    });
    const initialsMap = new Map<string, string>();
    localDoctors.forEach((d) =>
      initialsMap.set(d.doctorCode, d.doctorInitials || ''),
    );

    // Filter appointments if a specific schedule was selected
    const targetDoctorCode = selectedSchedule?.doctor?.doctorCode;
    const filteredAppointments = targetDoctorCode
      ? appointments.filter((a: any) => a.ParamedicID === targetDoctorCode)
      : appointments;

    let arrivedCount = 0;
    let notArrivedCount = 0;

    const list = filteredAppointments.map((a: any) => {
      const simrsReg =
        regMap.get(a.AppointmentNo) ||
        (a.PatientID ? patientRegMap.get(a.PatientID) : null);
      const localVisit = a.MedicalNo
        ? localVisitMap.get(a.MedicalNo)
        : null;

      const isArrived = !!simrsReg || !!localVisit;
      const isDoctorOnLeave = leaveDocSet.has(a.ParamedicID);

      if (isArrived) arrivedCount++;
      else notArrivedCount++;

      const initials =
        initialsMap.get(a.ParamedicID) ||
        selectedSchedule?.doctor?.doctorInitials ||
        selectedSchedule?.doctor?.doctorCode ||
        'DR';
      const queueNo = a.AppointmentQue || simrsReg?.RegistrationQue || 1;
      const formattedDoctorTicketNo = localVisit?.doctorTicketNo || `${initials}${String(queueNo).padStart(3, '0')}`;

      return {
        appointmentNo: a.AppointmentNo,
        patientId: a.PatientID,
        MedicalNo: a.MedicalNo || a.PatientID || '-',
        PatientName: a.PatientName,
        MobilePhoneNo: a.MobilePhoneNo || '-',
        ParamedicID: a.ParamedicID,
        ParamedicName: a.ParamedicName,
        AppointmentTime: a.AppointmentTime,
        SaranDatang: a.SaranDatang,
        AppointmentQue: a.AppointmentQue,
        formattedDoctorTicketNo,
        Notes: a.Notes,
        isArrived,
        queueTicketNo: localVisit?.queueTicket?.ticketNo || null,
        registration: localVisit
          ? {
              currentUnitType: localVisit.currentUnitType,
              currentStatus: localVisit.currentStatus,
            }
          : simrsReg
          ? {
              currentUnitType: 'ADMISSION',
              currentStatus: 'WAITING',
            }
          : null,
        isDoctorOnLeave,
      };
    });

    return {
      date: isoDateStr,
      scheduleId: selectedSchedule?.id || null,
      doctor: selectedSchedule?.doctor || null,
      room: selectedSchedule?.room || null,
      summary: {
        totalAppointments: filteredAppointments.length,
        arrivedCount,
        notArrivedCount,
      },
      appointments: list,
    };
  }

  private async querySimrsBridge(targetDateStr: string): Promise<any[]> {
    const bridgeUrl = process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
    const bridgeToken = process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';
    const url = new URL(bridgeUrl);
    url.searchParams.append('token', bridgeToken);

    const sql = `
      SELECT 
        psd.ServiceUnitID,
        psd.RoomID,
        psd.ParamedicID,
        p.ParamedicName,
        psd.ScheduleDate,
        psd.OperationalTimeID,
        ot.OperationalTimeName,
        ot.StartTime1,
        ot.EndTime1
      FROM ParamedicScheduleDate psd
      LEFT JOIN Paramedic p ON psd.ParamedicID = p.ParamedicID
      LEFT JOIN OperationalTime ot ON psd.OperationalTimeID = ot.OperationalTimeID
      WHERE psd.ScheduleDate >= '${targetDateStr} 00:00:00' 
        AND psd.ScheduleDate <= '${targetDateStr} 23:59:59'
    `;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sql }).toString(),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      this.logger.warn(`SIMRS Bridge schedule query failed: ${err.message}`);
      return [];
    }
  }

  private async querySimrsLeaves(targetDateStr: string): Promise<Set<string>> {
    const bridgeUrl = process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
    const bridgeToken = process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';
    const url = new URL(bridgeUrl);
    url.searchParams.append('token', bridgeToken);

    const sql = `
      SELECT ParamedicID
      FROM ParamedicLeave
      WHERE IsApproved = 1
        AND StartDate <= '${targetDateStr} 23:59:59'
        AND EndDate >= '${targetDateStr} 00:00:00'
    `;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sql }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        return new Set(data.map((l: any) => l.ParamedicID));
      }
      return new Set();
    } catch (err: any) {
      this.logger.warn(`SIMRS Bridge leave query failed: ${err.message}`);
      return new Set();
    }
  }

  async syncDailySchedules(targetDateStr?: string) {
    this.logger.log(`Starting daily HIS schedule sync for targetDateStr: ${targetDateStr || 'today'}...`);

    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    let today = new Date();
    const localTime = today.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    let year = localDate.getUTCFullYear();
    let month = localDate.getUTCMonth();
    let day = localDate.getUTCDate();

    if (targetDateStr) {
      const cleanStr = String(targetDateStr).trim();
      if (cleanStr.includes('-') || cleanStr.includes('/')) {
        const delimiter = cleanStr.includes('-') ? '-' : '/';
        const parts = cleanStr.split(delimiter);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD or YYYY/MM/DD
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            // DD-MM-YYYY or DD/MM/YYYY
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
        }
      } else {
        const digits = cleanStr.replace(/[^0-9]/g, '');
        if (digits.length === 8) {
          year = parseInt(digits.substring(0, 4), 10);
          month = parseInt(digits.substring(4, 6), 10) - 1;
          day = parseInt(digits.substring(6, 8), 10);
        }
      }
    }

    const mmStr = String(month + 1).padStart(2, '0');
    const ddStr = String(day).padStart(2, '0');
    const isoDateStr = `${year}-${mmStr}-${ddStr}`;
    const dateStr = `${year}${mmStr}${ddStr}`;

    today = new Date(Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000);

    // 1. Fetch SIMRS Schedules & Leaves in parallel
    const [simrsSchedules, leaveDoctorIds] = await Promise.all([
      this.querySimrsBridge(isoDateStr),
      this.querySimrsLeaves(isoDateStr),
    ]);

    let totalSynced = 0;

    if (simrsSchedules.length > 0) {
      this.logger.log(
        `Found ${simrsSchedules.length} doctor schedules from SIMRS Bridge. (${leaveDoctorIds.size} doctor(s) on leave today)`,
      );

      const parts = isoDateStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      const daysId = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = daysId[new Date(y, m, d).getDay()];

      for (const s of simrsSchedules) {
        if (!s.ParamedicID) continue;

        const isOnLeave = leaveDoctorIds.has(s.ParamedicID);

        let doctor = await this.prisma.doctor.findUnique({
          where: { doctorCode: s.ParamedicID },
        });

        if (!doctor) {
          doctor = await this.prisma.doctor.create({
            data: {
              doctorCode: s.ParamedicID,
              doctorName: s.ParamedicName || s.ParamedicID,
              specialty: 'Spesialis Mata',
            },
          });
        }

        const existing = await this.prisma.doctorSchedule.findFirst({
          where: {
            doctorId: doctor.id,
            scheduleDate: today,
          },
        });

        if (isOnLeave) {
          if (existing) {
            await this.prisma.doctorSchedule.update({
              where: { id: existing.id },
              data: { status: 'INACTIVE' },
            });
            this.logger.log(`Marked schedule INACTIVE for Dr. ${doctor.doctorName} (On Leave in SIMRS)`);
          }
          continue;
        }

        const roomCode = s.RoomID || 'DEFAULT-ROOM';
        let room = await this.prisma.room.findUnique({
          where: { code: roomCode },
        });

        const floorNum = this.getFloorNumber(roomCode);
        let floor = await this.prisma.floor.findUnique({
          where: { floorNumber: floorNum },
        });
        if (!floor) {
          floor = await this.prisma.floor.create({
            data: { floorNumber: floorNum, name: `Lantai ${floorNum}` },
          });
        }

        if (!room) {
          const friendlyName = this.formatRoomName(roomCode);
          room = await this.prisma.room.create({
            data: {
              code: roomCode,
              name: friendlyName,
              roomType: 'DOCTOR' as any,
              floorId: floor.id,
            },
          });
        }

        const startTime =
          s.StartTime1 && String(s.StartTime1).trim()
            ? String(s.StartTime1).trim()
            : '08:00';
        const endTime =
          s.EndTime1 && String(s.EndTime1).trim()
            ? String(s.EndTime1).trim()
            : '14:00';

        if (existing) {
          await this.prisma.doctorSchedule.update({
            where: { id: existing.id },
            data: {
              roomId: room.id,
              floorId: floor.id,
              startTime,
              endTime,
              quota: 50,
              status: 'ACTIVE',
            },
          });
        } else {
          await this.prisma.doctorSchedule.create({
            data: {
              doctorId: doctor.id,
              roomId: room.id,
              floorId: floor.id,
              scheduleDate: today,
              dayName,
              startTime,
              endTime,
              quota: 50,
              status: 'ACTIVE',
            },
          });
        }
        totalSynced++;
      }

      this.logger.log(`Daily sync finished via SIMRS Bridge. Synced ${totalSynced} active schedule entries.`);
      return { success: true, totalSynced };
    }

    // 2. Fallback to Beam HIS API if Bridge had 0 schedules
    this.logger.log('Fallback: Fetching from Beam HIS API...');
    const serviceUnitIdsStr = process.env.HIS_SERVICE_UNIT_IDS || 'A101,A110,A112,A201';
    const serviceUnitIds = serviceUnitIdsStr.split(',').map((s) => s.trim());

    const doctors = await this.prisma.doctor.findMany({
      where: { isActive: true },
    });

    let defaultFloor = await this.prisma.floor.findFirst();
    if (!defaultFloor) {
      defaultFloor = await this.prisma.floor.create({
        data: { floorNumber: 1, name: 'Lantai 1' },
      });
    }

    for (const doc of doctors) {
      for (const unitId of serviceUnitIds) {
        try {
          const hisSchedules = await this.hisApiService.getSchedule(
            doc.doctorCode,
            dateStr,
            dateStr,
            unitId,
          );

          for (const s of hisSchedules) {
            let room: any = null;
            if (s.RoomID) {
              room = await this.prisma.room.findUnique({
                where: { code: s.RoomID },
              });
              if (!room) {
                const floorNum = this.getFloorNumber(s.RoomID);
                let targetFloor = await this.prisma.floor.findUnique({
                  where: { floorNumber: floorNum },
                });
                if (!targetFloor) {
                  targetFloor = await this.prisma.floor.create({
                    data: {
                      floorNumber: floorNum,
                      name: `Lantai ${floorNum}`,
                    },
                  });
                }

                const friendlyName = this.formatRoomName(s.RoomID);
                room = await this.prisma.room.create({
                  data: {
                    code: s.RoomID,
                    name: friendlyName,
                    roomType: 'DOCTOR' as any,
                    floorId: targetFloor.id,
                  },
                });
              }
            } else if (doc.defaultRoomId) {
              room = await this.prisma.room.findUnique({
                where: { id: doc.defaultRoomId },
              });
            }

            if (!room) {
              const fallbackCode = 'DEFAULT-ROOM';
              room = await this.prisma.room.findUnique({
                where: { code: fallbackCode },
              });
              if (!room) {
                room = await this.prisma.room.create({
                  data: {
                    code: fallbackCode,
                    name: 'Poli Default',
                    roomType: 'DOCTOR' as any,
                    floorId: defaultFloor.id,
                  },
                });
              }
            }

            const scheduleDate = today;

            const daysId = [
              'Minggu',
              'Senin',
              'Selasa',
              'Rabu',
              'Kamis',
              'Jumat',
              'Sabtu',
            ];
            const localScheduleDate = new Date(
              scheduleDate.getTime() + tzOffset * 60 * 60 * 1000,
            );
            const dayName = daysId[localScheduleDate.getUTCDay()];

            const startTimeStr = s.StartTime1 || '08:00';
            const endTimeStr = s.EndTime1 || '15:00';

            const existing = await this.prisma.doctorSchedule.findFirst({
              where: {
                doctorId: doc.id,
                roomId: room.id,
                scheduleDate: scheduleDate,
              },
            });

            if (existing) {
              await this.prisma.doctorSchedule.update({
                where: { id: existing.id },
                data: {
                  startTime: startTimeStr,
                  endTime: endTimeStr,
                  quota: parseInt(s.Slot || '0') || existing.quota,
                },
              });
            } else {
              await this.prisma.doctorSchedule.create({
                data: {
                  doctorId: doc.id,
                  roomId: room.id,
                  floorId: room.floorId || defaultFloor.id,
                  scheduleDate: scheduleDate,
                  dayName: dayName,
                  startTime: startTimeStr,
                  endTime: endTimeStr,
                  quota: parseInt(s.Slot || '0') || 50,
                  status: 'ACTIVE',
                },
              });
            }
            totalSynced++;
          }
        } catch (e: any) {
          this.logger.error(
            `Error syncing schedule for ${doc.doctorCode} unit ${unitId}: ${e.message}`,
          );
        }
      }
    }

    this.logger.log(
      `Daily sync finished. Synced ${totalSynced} schedule entries.`,
    );
    return { success: true, totalSynced };
  }

  private getFloorNumber(roomId: string): number {
    if (!roomId) return 5;
    if (
      roomId === 'B3-102' ||
      roomId === 'A1-701' ||
      roomId === 'A1-702' ||
      roomId === 'B4-101'
    ) {
      return 7;
    }
    if (roomId.startsWith('A1-')) {
      const parts = roomId.split('-');
      if (parts[1] && parts[1].length >= 3) {
        const floorStr = parts[1].substring(0, parts[1].length - 2);
        const f = parseInt(floorStr, 10);
        if (!isNaN(f)) return f;
      }
    }
    return 5;
  }

  private formatRoomName(roomId: string) {
    if (!roomId) return 'Poli Default';
    if (roomId === 'A1-605') return 'Internist';
    if (roomId === 'A1-702') return 'Low Vision';
    if (roomId === 'B3-102' || roomId === 'A1-701') return 'Pediatric';
    if (roomId === 'B4-101') return 'Protesa';

    if (roomId.startsWith('A1-')) {
      const parts = roomId.split('-');
      if (parts[1] && parts[1].length >= 3) {
        const floorStr = parts[1].substring(0, parts[1].length - 2);
        const slotStr = parts[1].substring(parts[1].length - 2);
        const slotNum = parseInt(slotStr, 10);
        if (!isNaN(slotNum) && slotNum >= 1 && slotNum <= 26) {
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const letter = alphabet[slotNum - 1];
          return `Poli ${floorStr}${letter}`;
        }
      }
      return `Poli ${parts[1]}`;
    }
    return roomId;
  }

  async syncSimrsRegistrations() {
    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    const now = new Date();
    const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const isoDateStr = `${year}-${month}-${day}`;

    const startOfDay = new Date(`${isoDateStr}T00:00:00.000Z`);

    const bridgeUrl =
      process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
    const bridgeToken =
      process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';
    const url = new URL(bridgeUrl);
    url.searchParams.append('token', bridgeToken);

    const sql = `
      SELECT r.RegistrationNo, r.PatientID, r.ParamedicID, r.RegistrationQue,
             r.isProcessQue, r.IsClosed, r.ServiceUnitID,
             p.FirstName, p.LastName, p.MedicalNo
      FROM Registration r
      INNER JOIN Patient p ON r.PatientID = p.PatientID
      WHERE r.RegistrationNo LIKE 'REG/OP/%'
        AND r.RegistrationDate >= '${isoDateStr} 00:00:00'
        AND r.IsVoid = 0
      ORDER BY r.RegistrationDate ASC
    `;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sql }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      const simrsRegs = await res.json();
      if (!Array.isArray(simrsRegs) || simrsRegs.length === 0) return { addedCount: 0 };

      const doctors = await this.prisma.doctor.findMany({
        include: { defaultRoom: { include: { floor: true } } },
      });
      const floors = await this.prisma.floor.findMany();
      const rooms = await this.prisma.room.findMany({ include: { floor: true } });

      let addedCount = 0;

      for (const reg of simrsRegs) {
        const fullName = `${reg.FirstName || ''} ${reg.LastName || ''}`.trim();
        const rawRm = reg.PatientID;
        const formattedRm = reg.MedicalNo || rawRm;

        const existingVisit = await this.prisma.visit.findFirst({
          where: {
            visitDate: { gte: startOfDay },
            OR: [
              { patientRmNo: rawRm },
              { patientRmNo: formattedRm },
              { patientRmNo: { contains: rawRm.replace(/[^0-9]/g, '') } },
            ],
          },
        });

        if (existingVisit) continue;

        const doc = doctors.find((d) => d.doctorCode === reg.ParamedicID);
        const todaySchedule = await this.prisma.doctorSchedule.findFirst({
          where: { doctorId: doc?.id, scheduleDate: { gte: startOfDay }, status: 'ACTIVE' },
          include: { room: { include: { floor: true } }, floor: true },
        });

        let targetRoom = todaySchedule?.room || doc?.defaultRoom;
        let targetFloor = todaySchedule?.floor || doc?.defaultRoom?.floor;

        // Dynamic lookup: query SIMRS Bridge ParamedicScheduleDate directly for doctor's active room today
        if (!targetRoom && reg.ParamedicID) {
          try {
            const simrsSchedules = await this.querySimrsBridge(isoDateStr);
            const docSimrsSched = simrsSchedules.find((s: any) => s.ParamedicID === reg.ParamedicID);
            if (docSimrsSched?.RoomID) {
              const roomCode = docSimrsSched.RoomID;
              let room = rooms.find((r) => r.code === roomCode);
              if (!room) {
                const floorNum = this.getFloorNumber(roomCode);
                let floor = floors.find((f) => f.floorNumber === floorNum);
                if (!floor) {
                  floor = await this.prisma.floor.create({
                    data: { floorNumber: floorNum, name: `Lantai ${floorNum}` },
                  });
                  floors.push(floor);
                }
                const friendlyName = this.formatRoomName(roomCode);
                room = await this.prisma.room.create({
                  data: {
                    code: roomCode,
                    name: friendlyName,
                    roomType: 'DOCTOR' as any,
                    floorId: floor.id,
                  },
                  include: { floor: true },
                });
                rooms.push(room);
              }
              targetRoom = room;
              targetFloor = room.floor || floors.find((f) => f.id === room.floorId);

              if (doc && targetRoom) {
                const fId = targetFloor?.id || targetRoom.floorId;
                if (fId) {
                  await this.prisma.doctorSchedule.create({
                    data: {
                      doctorId: doc.id,
                      roomId: targetRoom.id,
                      floorId: fId,
                      scheduleDate: startOfDay,
                      dayName: 'Hari Ini',
                      startTime: docSimrsSched.StartTime1 || '08:00',
                      endTime: docSimrsSched.EndTime1 || '14:00',
                      quota: 50,
                      status: 'ACTIVE',
                    },
                  }).catch(() => {});
                }
              }
            }
          } catch (e) {}
        }

        if (!targetRoom) {
          if (reg.ParamedicID === 'D217') {
            targetRoom = rooms.find((r) => r.code === 'A1-602' || r.name.includes('6B'));
            targetFloor = targetRoom?.floor || floors.find((f) => f.floorNumber === 6);
          } else {
            targetFloor = floors.find((f) => f.floorNumber === 5) || floors.find((f) => f.floorNumber === 6) || floors[0];
            targetRoom = rooms.find((r) => r.floorId === targetFloor?.id) || rooms[0];
          }
        }

        const initials = doc?.doctorInitials || doc?.doctorCode || 'DR';
        const doctorTicketNo = `${initials}${String(reg.RegistrationQue || 1).padStart(3, '0')}`;

        let ticket = await this.prisma.queueTicket.findFirst({
          where: { ticketNo: doctorTicketNo, queueDate: { gte: startOfDay } },
        });

        if (!ticket) {
          ticket = await this.prisma.queueTicket.create({
            data: {
              ticketNo: doctorTicketNo,
              queueDate: startOfDay,
              patientType: 'ONLINE',
              status: 'FINISHED',
              selectedDoctorId: doc?.id,
              selectedRoomId: targetRoom?.id,
              selectedFloorId: targetFloor?.id,
            },
          });
        }

        const visit = await this.prisma.visit.create({
          data: {
            visitCode: `V-SIMRS-${reg.RegistrationNo}`,
            queueTicketId: ticket.id,
            visitDate: startOfDay,
            patientRmNo: rawRm,
            patientName: fullName,
            patientType: 'ONLINE',
            selectedDoctorId: doc?.id,
            selectedFloorId: targetFloor?.id,
            selectedRoomId: targetRoom?.id,
            currentUnitType: 'ASSESSMENT',
            currentStatus: 'WAITING',
            doctorTicketNo,
          },
        });

        await this.prisma.journeyUnitSession.create({
          data: {
            visitId: visit.id,
            unitType: 'ASSESSMENT',
            status: 'WAITING',
            floorId: targetFloor?.id,
            roomId: targetRoom?.id,
            doctorId: doc?.id,
            queueTicketId: ticket.id,
            createdBy: 'Auto Sync SIMRS Kiosk',
          },
        });

        await this.prisma.journeyEvent.create({
          data: {
            visitId: visit.id,
            unitType: 'ASSESSMENT',
            eventType: 'WAITING_CREATED',
            eventTime: new Date(),
            floorId: targetFloor?.id,
            roomId: targetRoom?.id,
            doctorId: doc?.id,
            note: 'Diimpor otomatis dari Kiosk SIMRS',
          },
        });

        addedCount++;
      }

      if (addedCount > 0) {
        this.logger.log(
          `Auto-synced ${addedCount} new Kiosk SIMRS registration(s) into Orbita Pengkajian.`,
        );
        this.displayGateway.triggerDashboardRefresh();
      }

      return { addedCount };
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-sync Kiosk SIMRS registrations: ${err.message}`,
      );
      return { addedCount: 0 };
    }
  }
}

// Trigger rebuild for environment variables configuration
