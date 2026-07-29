import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
import { DisplayGateway } from '../websocket/display.gateway';
import { getLocalDateBoundaries } from '../common/timezone.utils';

@Injectable()
export class CdcService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue(floorId?: string) {
    const { today, tomorrow } = getLocalDateBoundaries();

    const where: any = {
      currentUnitType: 'CDC',
      currentStatus: { in: ['WAITING', 'SERVING'] },
      finishedAt: null,
      visitDate: { gte: today, lt: tomorrow },
    };

    if (floorId) {
      const targetFloor = await this.prisma.floor.findUnique({
        where: { id: floorId },
      });
      if (targetFloor) {
        where.OR = [
          { selectedFloorId: targetFloor.id },
          { selectedFloor: { floorNumber: targetFloor.floorNumber } },
          { selectedRoom: { floorId: targetFloor.id } },
          { selectedRoom: { floor: { floorNumber: targetFloor.floorNumber } } },
        ];
      } else {
        where.selectedFloorId = floorId;
      }
    }

    return this.prisma.visit.findMany({
      where,
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        journeySessions: {
          where: {
            unitType: 'CDC',
            status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'CDC',
    );
    if (!session) throw new BadRequestException('Sesi CDC tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Layanan CDC dimulai' };
  }

  async finishService(
    visitId: string,
    userId: string,
    nextUnitType?: string,
    serviceName?: string,
  ) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'CDC',
    );
    if (session) {
      await this.journeyService.finishService(session.id, {
        createdBy: userId,
        serviceName,
      });
    }

    // Dynamic routing — use provided nextUnitType or default (CASHIER)
    const nextUnit =
      nextUnitType ||
      this.routingService.getDefaultNextUnit('CDC') ||
      'CASHIER';

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
    const destLabel = nextUnit === 'CASHIER' ? 'Kasir' : nextUnit.toLowerCase();
    return { message: `CDC selesai, pasien diarahkan ke ${destLabel}` };
  }

  /**
   * Transfer patient from CDC to another unit
   */
  async transferPatient(
    visitId: string,
    data: { targetUnitType: string; reason: string; userId: string },
  ) {
    return this.routingService.transferPatient(
      visitId,
      data.targetUnitType,
      data.reason,
      data.userId,
    );
  }

  /**
   * Get available destinations from CDC
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('CDC');
  }
}
