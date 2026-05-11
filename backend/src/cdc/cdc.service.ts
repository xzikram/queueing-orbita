import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';

@Injectable()
export class CdcService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
  ) {}

  async getQueue() {
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'CDC',
        currentStatus: { in: ['WAITING', 'SERVING'] },
        finishedAt: null,
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        journeySessions: {
          where: { unitType: 'CDC', status: { notIn: ['FINISHED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CDC');
    if (!session) throw new BadRequestException('Sesi CDC tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Layanan CDC dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CDC');
    if (!session) throw new BadRequestException('Sesi CDC tidak ditemukan');

    await this.journeyService.finishService(session.id, { createdBy: userId });

    // Route to Cashier
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: 'CASHIER', currentStatus: 'WAITING' },
    });

    const kasirRoom = await this.prisma.room.findFirst({ where: { roomType: 'CASHIER' } });
    await this.journeyService.createSession({
      visitId,
      unitType: 'CASHIER',
      roomId: kasirRoom?.id,
      queueTicketId: visit.queueTicketId,
      createdBy: userId,
    });

    return { message: 'CDC selesai, pasien diarahkan ke Kasir' };
  }
}
