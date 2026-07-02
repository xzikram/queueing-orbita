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

  async syncDailySchedules(targetDateStr?: string) {
    this.logger.log('Starting daily HIS schedule sync...');

    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    let today = new Date();
    const localTime = today.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    let dateStr = targetDateStr;
    if (dateStr) {
      // Normalize to YYYYMMDD
      const normalized = dateStr.replace(/[^0-9]/g, '');
      if (normalized.length === 8) {
        dateStr = normalized;
        const y = parseInt(normalized.substring(0, 4), 10);
        const m = parseInt(normalized.substring(4, 6), 10) - 1;
        const d = parseInt(normalized.substring(6, 8), 10);
        today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
      } else if (dateStr.length === 10 && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        dateStr = `${parts[0]}${parts[1]}${parts[2]}`;
        today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
      } else {
        dateStr = undefined;
      }
    }

    if (!dateStr) {
      const yyyy = localDate.getUTCFullYear().toString();
      const mm = (localDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = localDate.getUTCDate().toString().padStart(2, '0');
      dateStr = `${yyyy}${mm}${dd}`;

      const y = localDate.getUTCFullYear();
      const m = localDate.getUTCMonth();
      const d = localDate.getUTCDate();
      today = new Date(Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000);
    }

    const serviceUnitIdsStr =
      process.env.HIS_SERVICE_UNIT_IDS || 'A101,A110,A112,A201';
    const serviceUnitIds = serviceUnitIdsStr.split(',').map((s) => s.trim());

    // Fetch all active doctors
    const doctors = await this.prisma.doctor.findMany({
      where: { isActive: true },
    });
    let totalSynced = 0;

    // Fetch default floor
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
                let floorId = defaultFloor.id;
                if (s.RoomID === 'B3-102') {
                  let targetFloor = await this.prisma.floor.findUnique({
                    where: { floorNumber: 7 },
                  });
                  if (!targetFloor) {
                    targetFloor = await this.prisma.floor.create({
                      data: {
                        floorNumber: 7,
                        name: 'Lantai 7',
                      },
                    });
                  }
                  floorId = targetFloor.id;
                } else {
                  const match = s.RoomID.match(/^[A-Z0-9]+-(\d+)$/i);
                  if (match) {
                    const roomDigits = match[1];
                    if (roomDigits.length >= 3) {
                      const floorStr = roomDigits.substring(
                        0,
                        roomDigits.length - 2,
                      );
                      const floorNum = parseInt(floorStr, 10);
                      if (!isNaN(floorNum)) {
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
                        floorId = targetFloor.id;
                      }
                    }
                  }
                }

                const friendlyName = this.formatRoomName(s.RoomID);
                room = await this.prisma.room.create({
                  data: {
                    code: s.RoomID,
                    name: friendlyName,
                    roomType: 'DOCTOR' as any,
                    floorId,
                  },
                });
                this.logger.log(
                  `Created new room from HIS: ${friendlyName} (${s.RoomID})`,
                );
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
                this.logger.log(`Created fallback DEFAULT-ROOM`);
              }
            }

            // Convert startTime and endTime to Dates based on target/today's date
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

            // Upsert the schedule (we find existing by doctorId, roomId, and scheduleDate)
            // But Prisma doesn't have a unique constraint on these three, so we use findFirst and update/create.
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
        } catch (e) {
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

  private formatRoomName(roomId: string) {
    if (roomId === 'A1-605') return 'Internist';
    if (roomId === 'A1-702') return 'Low Vision';
    if (roomId === 'B3-102') return 'Pediatric';

    // Attempt to map "A1-[floor][slot_padded]" (e.g. "A1-502") to "Poli [floor][letter]" (e.g. "Poli 5B")
    if (roomId.startsWith('A1-')) {
      const parts = roomId.split('-'); // e.g. ["A1", "502"]
      if (parts[1] && parts[1].length >= 3) {
        const floorStr = parts[1].substring(0, parts[1].length - 2); // e.g. "5"
        const slotStr = parts[1].substring(parts[1].length - 2); // e.g. "02"
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
