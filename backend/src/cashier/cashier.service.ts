import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class CashierService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue() {
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'CASHIER',
        currentStatus: { in: ['WAITING', 'CALLED', 'SERVING', 'WAITING_DESTINATION'] },
        finishedAt: null,
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        journeySessions: {
          where: { unitType: 'CASHIER', status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] } },
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
        ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
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
          ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
          targetCounter: counter.name,
          unitType: 'CASHIER',
          calledAt: new Date(),
        },
      });
    }

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pasien dipanggil ke kasir' };
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'CASHIER');
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    this.displayGateway.triggerDashboardRefresh();
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
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pembayaran selesai, pilih tujuan selanjutnya' };
  }

  async setNextDestination(visitId: string, destination: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    // Delegate to routing service
    return this.routingService.routeToNextUnit(
      visitId,
      destination,
      {
        roomId: visit.selectedRoomId,
        floorId: visit.selectedFloorId,
        doctorId: visit.selectedDoctorId,
        queueTicketId: visit.queueTicketId,
      },
      userId,
    );
  }

  /**
   * Transfer patient from cashier to another unit
   */
  async transferPatient(visitId: string, data: { targetUnitType: string; reason: string; userId: string }) {
    return this.routingService.transferPatient(visitId, data.targetUnitType, data.reason, data.userId);
  }

  /**
   * Get available destinations from cashier
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('CASHIER');
  }

  /**
   * Get recent call logs for the cashier display
   */
  async getRecentCalls(limit = 10) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.displayCallLog.findMany({
      where: {
        unitType: 'CASHIER',
        calledAt: { gte: today },
      },
      orderBy: { calledAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Sync a kiosk ticket (source) with an existing patient visit (target)
   */
  async syncTicket(sourceVisitId: string, targetVisitId: string, userId: string) {
    const sourceVisit = await this.prisma.visit.findUnique({ where: { id: sourceVisitId } });
    const targetVisit = await this.prisma.visit.findUnique({ where: { id: targetVisitId } });

    if (!sourceVisit) throw new NotFoundException('Data tiket Kiosk tidak ditemukan');
    if (!targetVisit) throw new NotFoundException('Data kunjungan pasien tidak ditemukan');

    await this.prisma.$transaction(async (prisma) => {
      // 1. Move ticket to targetVisit
      await prisma.visit.update({
        where: { id: targetVisitId },
        data: { queueTicketId: sourceVisit.queueTicketId },
      });

      // 2. Update target session ticket
      const targetSession = await prisma.journeyUnitSession.findFirst({
        where: { visitId: targetVisitId, unitType: 'CASHIER', status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] } }
      });
      if (targetSession) {
        await prisma.journeyUnitSession.update({
          where: { id: targetSession.id },
          data: { queueTicketId: sourceVisit.queueTicketId },
        });
      }

      // 3. Delete source visit journey events and sessions
      const sourceSessions = await prisma.journeyUnitSession.findMany({ where: { visitId: sourceVisitId } });
      const sourceSessionIds = sourceSessions.map(s => s.id);
      if (sourceSessionIds.length > 0) {
        await prisma.journeyEvent.deleteMany({ where: { journeyUnitSessionId: { in: sourceSessionIds } } });
      }
      await prisma.journeyEvent.deleteMany({ where: { visitId: sourceVisitId } });
      await prisma.journeyUnitSession.deleteMany({ where: { visitId: sourceVisitId } });

      // 4. Delete source visit
      await prisma.visit.delete({ where: { id: sourceVisitId } });
      
      // Log audit
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SYNC_TICKET',
          entity: 'Visit',
          entityId: targetVisitId,
          reason: `Merged Kiosk ticket into patient visit`,
        }
      });
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Sinkronisasi antrean berhasil' };
  }
}
