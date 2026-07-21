import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HisApiService } from '../adapters/his-api.service';
import { parseLocalDate } from '../common/timezone.utils';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private prisma: PrismaService,
    private hisApiService: HisApiService,
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
        psd.ScheduleDate
      FROM ParamedicScheduleDate psd
      LEFT JOIN Paramedic p ON psd.ParamedicID = p.ParamedicID
      WHERE psd.ScheduleDate >= '${targetDateStr} 00:00:00' 
        AND psd.ScheduleDate <= '${targetDateStr} 23:59:59'
    `;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sql }).toString(),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      this.logger.warn(`SIMRS Bridge schedule query failed: ${err.message}`);
      return [];
    }
  }

  async syncDailySchedules(targetDateStr?: string) {
    this.logger.log('Starting daily HIS schedule sync...');

    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    let today = new Date();
    const localTime = today.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    let dateStr = targetDateStr;
    let isoDateStr = '';

    if (dateStr) {
      const normalized = dateStr.replace(/[^0-9]/g, '');
      if (normalized.length === 8) {
        const y = parseInt(normalized.substring(0, 4), 10);
        const m = parseInt(normalized.substring(4, 6), 10) - 1;
        const d = parseInt(normalized.substring(6, 8), 10);
        today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
        dateStr = normalized;
        isoDateStr = `${normalized.substring(0, 4)}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
      } else if (dateStr.length === 10 && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
        isoDateStr = dateStr;
        dateStr = `${parts[0]}${parts[1]}${parts[2]}`;
      } else {
        dateStr = undefined;
      }
    }

    if (!dateStr || !isoDateStr) {
      const yyyy = localDate.getUTCFullYear().toString();
      const mm = (localDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = localDate.getUTCDate().toString().padStart(2, '0');
      dateStr = `${yyyy}${mm}${dd}`;
      isoDateStr = `${yyyy}-${mm}-${dd}`;

      const y = localDate.getUTCFullYear();
      const m = localDate.getUTCMonth();
      const d = localDate.getUTCDate();
      today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
    }

    // 1. Try SIMRS Bridge first
    const simrsSchedules = await this.querySimrsBridge(isoDateStr);
    let totalSynced = 0;

    if (simrsSchedules.length > 0) {
      this.logger.log(`Found ${simrsSchedules.length} doctor schedules from SIMRS Bridge.`);

      const parts = isoDateStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      const daysId = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = daysId[new Date(y, m, d).getDay()];

      for (const s of simrsSchedules) {
        if (!s.ParamedicID) continue;

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

        const existing = await this.prisma.doctorSchedule.findFirst({
          where: {
            doctorId: doctor.id,
            scheduleDate: today,
          },
        });

        if (existing) {
          await this.prisma.doctorSchedule.update({
            where: { id: existing.id },
            data: {
              roomId: room.id,
              floorId: floor.id,
              startTime: '08:00',
              endTime: '14:00',
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
              startTime: '08:00',
              endTime: '14:00',
              quota: 50,
              status: 'ACTIVE',
            },
          });
        }
        totalSynced++;
      }

      this.logger.log(`Daily sync finished via SIMRS Bridge. Synced ${totalSynced} schedule entries.`);
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
}

// Trigger rebuild for environment variables configuration
