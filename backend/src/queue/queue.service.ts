import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class QueueService {
  constructor(
    private prisma: PrismaService,
    private displayGateway: DisplayGateway,
  ) {}

  async generateTicket(data: {
    patientType: 'UMUM' | 'ASURANSI' | 'BARU' | 'LAMA' | 'ONLINE';
    scheduleId: string;
  }) {
    // Validate schedule
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: data.scheduleId },
      include: { doctor: true, room: { include: { floor: true } } },
    });

    if (!schedule) {
      throw new BadRequestException('Jadwal tidak ditemukan');
    }

    if (schedule.status !== 'ACTIVE') {
      throw new BadRequestException('Jadwal tidak aktif');
    }

    if (schedule.bookedCount >= schedule.quota) {
      throw new BadRequestException('Kuota dokter sudah penuh');
    }

    // Generate ticket number using Doctor Code as prefix
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const prefix = schedule.doctor.doctorCode || (data.patientType === 'UMUM' ? 'U' : 'A');

    const lastTicket = await this.prisma.queueTicket.findFirst({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        selectedDoctorId: schedule.doctorId,
      },
      orderBy: { createdAt: 'desc' },
    });

    let nextNumber = 1;
    if (lastTicket) {
      // The ticket number format is Prefix + 3 digit number (e.g. HB001)
      // Extract the number part by replacing the prefix
      const numberPart = lastTicket.ticketNo.replace(prefix, '');
      const lastNum = parseInt(numberPart) || 0;
      nextNumber = lastNum + 1;
    }

    const ticketNo = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Create ticket and increment booked count
    const [ticket] = await this.prisma.$transaction([
      this.prisma.queueTicket.create({
        data: {
          ticketNo,
          queueDate: today,
          patientType: data.patientType,
          selectedScheduleId: schedule.id,
          selectedDoctorId: schedule.doctorId,
          selectedRoomId: schedule.roomId,
          selectedFloorId: schedule.floorId,
          status: 'WAITING',
        },
        include: {
          selectedSchedule: { include: { doctor: true, room: true } },
          selectedDoctor: true,
          selectedRoom: { include: { floor: true } },
        },
      }),
      this.prisma.doctorSchedule.update({
        where: { id: schedule.id },
        data: { bookedCount: { increment: 1 } },
      }),
    ]);

    this.displayGateway.triggerDashboardRefresh();
    return ticket;
  }

  async generateAdmissionTicket(data: { patientType: 'BARU' | 'LAMA' | 'ASURANSI' | 'ONLINE'; scheduleId?: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let prefix = 'A';
    if (data.patientType === 'BARU') prefix = 'A';
    if (data.patientType === 'LAMA') prefix = 'B';
    if (data.patientType === 'ASURANSI') prefix = 'C';
    if (data.patientType === 'ONLINE') prefix = 'D';

    // If a scheduleId is provided (from Kiosk doctor selection), validate and link it
    let schedule: any = null;
    if (data.scheduleId) {
      schedule = await this.prisma.doctorSchedule.findUnique({
        where: { id: data.scheduleId },
        include: { doctor: true, room: { include: { floor: true } } },
      });
      if (!schedule) throw new BadRequestException('Jadwal dokter tidak ditemukan');
      if (schedule.status !== 'ACTIVE') throw new BadRequestException('Jadwal dokter tidak aktif');
      if (schedule.bookedCount >= schedule.quota) throw new BadRequestException('Kuota dokter sudah penuh');
    }

    const lastTicket = await this.prisma.queueTicket.findFirst({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        ticketNo: { startsWith: prefix },
      },
      orderBy: { createdAt: 'desc' },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const numberPart = lastTicket.ticketNo.replace(prefix, '');
      const lastNum = parseInt(numberPart) || 0;
      nextNumber = lastNum + 1;
    }

    const ticketNo = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    const ticketData: any = {
      ticketNo,
      queueDate: today,
      patientType: data.patientType,
      status: 'WAITING',
    };

    // Attach doctor/room/floor if schedule was selected
    if (schedule) {
      ticketData.selectedScheduleId = schedule.id;
      ticketData.selectedDoctorId = schedule.doctorId;
      ticketData.selectedRoomId = schedule.roomId;
      ticketData.selectedFloorId = schedule.floorId;
    }

    if (schedule) {
      // Use transaction to create ticket and increment booked count atomically
      const [ticket] = await this.prisma.$transaction([
        this.prisma.queueTicket.create({
          data: ticketData,
          include: {
            selectedDoctor: true,
            selectedRoom: { include: { floor: true } },
            selectedSchedule: { include: { doctor: true } },
          },
        }),
        this.prisma.doctorSchedule.update({
          where: { id: schedule.id },
          data: { bookedCount: { increment: 1 } },
        }),
      ]);
      this.displayGateway.triggerDashboardRefresh();
      return ticket;
    }

    const ticket = await this.prisma.queueTicket.create({
      data: ticketData,
    });

    this.displayGateway.triggerDashboardRefresh();
    return ticket;
  }

  async generateCashierTicket(data: { patientType: 'UMUM' | 'ASURANSI' }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const prefix = data.patientType === 'UMUM' ? 'G' : 'H';

    const lastTicket = await this.prisma.queueTicket.findFirst({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        ticketNo: { startsWith: prefix },
      },
      orderBy: { createdAt: 'desc' },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const numberPart = lastTicket.ticketNo.replace(prefix, '');
      const lastNum = parseInt(numberPart) || 0;
      nextNumber = lastNum + 1;
    }

    const ticketNo = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Create ticket AND a visit starting at CASHIER directly
    const [ticket, visit] = await this.prisma.$transaction(async (prisma) => {
      const t = await prisma.queueTicket.create({
        data: {
          ticketNo,
          queueDate: today,
          patientType: data.patientType,
          status: 'WAITING',
        },
      });

      const v = await prisma.visit.create({
        data: {
          visitCode: `V-${ticketNo}-${Date.now()}`,
          visitDate: today,
          patientType: data.patientType,
          queueTicketId: t.id,
          currentUnitType: 'CASHIER',
          currentStatus: 'WAITING',
        },
      });

      // Create cashier session immediately
      await prisma.journeyUnitSession.create({
        data: {
          visitId: v.id,
          unitType: 'CASHIER',
          status: 'WAITING',
        },
      });

      return [t, v];
    });

    this.displayGateway.triggerDashboardRefresh();
    return ticket;
  }

  async findTodayTickets() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.queueTicket.findMany({
      where: {
        queueDate: { gte: today, lt: tomorrow },
      },
      include: {
        selectedDoctor: true,
        selectedRoom: true,
        selectedFloor: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findTicket(id: string) {
    return this.prisma.queueTicket.findUnique({
      where: { id },
      include: {
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        selectedSchedule: true,
        visit: true,
      },
    });
  }

  async getFloorDisplayData(floorNumber: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get recent calls for this floor from display_call_logs
    const recentCalls = await this.prisma.displayCallLog.findMany({
      where: {
        createdAt: { gte: today },
        display: { floor: { floorNumber } },
      },
      include: {
        visit: true,
      },
      orderBy: { calledAt: 'desc' },
      take: 50,
    });

    const uniqueBdr: typeof recentCalls = [];
    const uniquePoli: typeof recentCalls = [];
    
    for (const c of recentCalls) {
      // Tentukan apakah panggilan ini masih aktif di unit tersebut
      let isActiveAtUnit = true;
      if (c.visit) {
        if (c.visit.currentStatus === 'FINISHED' || c.visit.currentStatus === 'CANCELLED') {
          isActiveAtUnit = false;
        } else if (c.unitType === 'BDR' && c.visit.currentUnitType !== 'BDR') {
          isActiveAtUnit = false;
        } else if ((c.unitType === 'DOCTOR' || c.unitType === 'ASSESSMENT') && 
                   c.visit.currentUnitType !== 'DOCTOR' && c.visit.currentUnitType !== 'ASSESSMENT') {
          isActiveAtUnit = false;
        }
      }

      if (isActiveAtUnit) {
        if (c.unitType === 'BDR') {
          if (!uniqueBdr.some(x => x.ticketNo === c.ticketNo)) uniqueBdr.push(c);
        } else if (c.unitType === 'DOCTOR' || c.unitType === 'ASSESSMENT') {
          if (!uniquePoli.some(x => x.ticketNo === c.ticketNo)) uniquePoli.push(c);
        }
      }
    }

    const bdrCalls = uniqueBdr.slice(0, 5);
    const poliCalls = uniquePoli.slice(0, 5);

    // Get waiting list: Visits that are WAITING for ASSESSMENT or DOCTOR or BDR on this floor
    const waitingList = await this.prisma.visit.findMany({
      where: {
        visitDate: { gte: today },
        currentStatus: 'WAITING',
        selectedFloor: { floorNumber },
        currentUnitType: { in: ['ASSESSMENT', 'DOCTOR', 'BDR'] },
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    return {
      recentBdr: bdrCalls,
      recentPoli: poliCalls,
      waitingList: waitingList.map(v => ({
        ticketNo: v.doctorTicketNo || v.queueTicket?.ticketNo,
        unitType: v.currentUnitType,
        roomName: v.selectedRoom?.name,
        doctorName: v.selectedDoctor?.doctorName,
        patientName: v.patientName,
      })),
    };
  }
}
