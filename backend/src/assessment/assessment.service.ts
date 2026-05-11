import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';

@Injectable()
export class AssessmentService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
  ) {}

  async getQueue(floorId?: string) {
    const where: any = {
      currentUnitType: 'ASSESSMENT',
      currentStatus: { in: ['WAITING', 'SERVING'] },
      finishedAt: null,
    };
    if (floorId) where.selectedFloorId = floorId;

    return this.prisma.visit.findMany({
      where,
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        selectedFloor: true,
        journeySessions: {
          where: { unitType: 'ASSESSMENT', status: { notIn: ['FINISHED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startService(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'ASSESSMENT');
    if (!session) throw new BadRequestException('Sesi pengkajian tidak ditemukan');

    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });

    return { message: 'Pengkajian dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { selectedRoom: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'ASSESSMENT');
    if (!session) throw new BadRequestException('Sesi pengkajian tidak ditemukan');

    await this.journeyService.finishService(session.id, { createdBy: userId });

    // Route to BDR
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: 'BDR', currentStatus: 'WAITING' },
    });

    await this.journeyService.createSession({
      visitId,
      unitType: 'BDR',
      roomId: visit.selectedRoomId || undefined,
      floorId: visit.selectedFloorId || undefined,
      doctorId: visit.selectedDoctorId || undefined,
      queueTicketId: visit.queueTicketId,
      createdBy: userId,
    });

    return { message: 'Pengkajian selesai, pasien diarahkan ke BDR' };
  }
}
