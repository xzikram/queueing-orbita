import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class CashierService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue() {
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'CASHIER',
        currentStatus: { in: ['WAITING', 'CALLED', 'SERVING'] },
        finishedAt: null,
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        journeySessions: {
          where: { unitType: 'CASHIER', status: { notIn: ['FINISHED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { counter: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async callPatient(visitId: string, counterId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { queueTicket: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const counter = await this.prisma.counter.findUnique({ where: { id: counterId } });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CASHIER');
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');

    await this.journeyService.callSession(session.id, { counterId, createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'CALLED' } });

    // Broadcast to kasir display
    const kasirDisplay = await this.prisma.display.findFirst({ where: { code: 'display_kasir' } });
    if (kasirDisplay) {
      this.displayGateway.broadcastCall('display_kasir', {
        ticketNo: visit.queueTicket.ticketNo,
        patientType: visit.queueTicket.patientType,
        counterName: counter.name,
        unitType: 'CASHIER',
        calledAt: new Date(),
        visitId: visit.id,
      });
      await this.prisma.displayCallLog.create({
        data: {
          displayId: kasirDisplay.id,
          visitId: visit.id,
          queueTicketId: visit.queueTicketId,
          ticketNo: visit.queueTicket.ticketNo,
          targetCounter: counter.name,
          unitType: 'CASHIER',
          calledAt: new Date(),
        },
      });
    }

    return { message: 'Pasien dipanggil ke kasir' };
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CASHIER');
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Pembayaran dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CASHIER');
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');
    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'WAITING_DESTINATION' },
    });
    return { message: 'Pembayaran selesai, pilih tujuan selanjutnya' };
  }

  async setNextDestination(visitId: string, destination: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    if (destination === 'FINISHED') {
      await this.prisma.visit.update({
        where: { id: visitId },
        data: { currentUnitType: null, currentStatus: 'FINISHED', finishedAt: new Date() },
      });
      return { message: 'Kunjungan selesai' };
    }

    const unitType = destination as any;
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: unitType, currentStatus: 'WAITING' },
    });

    let roomId: string | undefined;
    if (destination === 'PHARMACY') {
      const r = await this.prisma.room.findFirst({ where: { roomType: 'PHARMACY' } });
      roomId = r?.id;
    } else if (destination === 'OPTIC') {
      const r = await this.prisma.room.findFirst({ where: { roomType: 'OPTIC' } });
      roomId = r?.id;
    }

    await this.journeyService.createSession({
      visitId,
      unitType,
      roomId,
      queueTicketId: visit.queueTicketId,
      createdBy: userId,
    });

    return { message: `Pasien diarahkan ke ${destination}` };
  }
}
