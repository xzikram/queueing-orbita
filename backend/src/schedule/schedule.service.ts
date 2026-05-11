import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  async findActiveToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
      const date = new Date(query.date);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
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
    return this.prisma.doctorSchedule.create({
      data,
      include: { doctor: true, room: true, floor: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.doctorSchedule.update({
      where: { id },
      data,
      include: { doctor: true, room: true, floor: true },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.doctorSchedule.delete({ where: { id } });
    return { message: 'Jadwal berhasil dihapus' };
  }

  async deleteAll() {
    await this.prisma.doctorSchedule.deleteMany();
    return { message: 'Semua jadwal berhasil dihapus' };
  }
}
