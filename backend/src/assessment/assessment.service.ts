import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class AssessmentService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue(floorId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      currentUnitType: 'ASSESSMENT',
      currentStatus: { in: ['WAITING', 'SERVING'] },
      finishedAt: null,
      visitDate: { gte: today, lt: tomorrow },
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
          where: { unitType: 'ASSESSMENT', status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] } },
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

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pengkajian dimulai' };
  }

  async finishService(visitId: string, userId: string, nextUnitType?: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { selectedRoom: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'ASSESSMENT');
    if (!session) throw new BadRequestException('Sesi pengkajian tidak ditemukan');

    await this.journeyService.finishService(session.id, { createdBy: userId });

    // Dynamic routing — use provided nextUnitType or default (BDR)
    const nextUnit = nextUnitType || this.routingService.getDefaultNextUnit('ASSESSMENT') || 'BDR';

    await this.routingService.routeToNextUnit(
      visitId,
      nextUnit,
      {
        roomId: visit.selectedRoomId,
        floorId: visit.selectedFloorId,
        doctorId: visit.selectedDoctorId,
        queueTicketId: visit.queueTicketId,
      },
      userId,
    );

    this.displayGateway.triggerDashboardRefresh();
    const destLabel = nextUnit === 'BDR' ? 'BDR' : nextUnit.toLowerCase();
    return { message: `Pengkajian selesai, pasien diarahkan ke ${destLabel}` };
  }

  /**
   * Transfer patient from assessment to another unit
   */
  async transferPatient(visitId: string, data: { targetUnitType: string; reason: string; userId: string }) {
    return this.routingService.transferPatient(visitId, data.targetUnitType, data.reason, data.userId);
  }

  /**
   * Get available destinations from assessment
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('ASSESSMENT');
  }
}
