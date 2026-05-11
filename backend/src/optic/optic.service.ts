import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';

@Injectable()
export class OpticService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
  ) {}

  async getQueue() {
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'OPTIC',
        currentStatus: { in: ['WAITING', 'SERVING'] },
        finishedAt: null,
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        journeySessions: {
          where: { unitType: 'OPTIC', status: { notIn: ['FINISHED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'OPTIC');
    if (!session) throw new BadRequestException('Sesi Optik tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Layanan optik dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'OPTIC');
    if (!session) throw new BadRequestException('Sesi Optik tidak ditemukan');
    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: null, currentStatus: 'FINISHED', finishedAt: new Date() },
    });
    return { message: 'Kunjungan selesai' };
  }
}
