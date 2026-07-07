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
export class CashierService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue() {
    const { today, tomorrow } = getLocalDateBoundaries();

    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'CASHIER',
        currentStatus: {
          in: ['WAITING', 'CALLED', 'SERVING', 'WAITING_DESTINATION'],
        },
        finishedAt: null,
        visitDate: { gte: today, lt: tomorrow },
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        journeySessions: {
          where: {
            unitType: 'CASHIER',
            status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
          },
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

    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');

    // Auto-reset busy counter status to STANDBY if calling a patient
    if (counter.status === 'BUSY') {
      await this.prisma.counter.update({
        where: { id: counter.id },
        data: { status: 'STANDBY' },
      });
      this.displayGateway.server.emit('counterStatusChanged', {
        counterId: counter.id,
        status: 'STANDBY',
      });
    }

    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'CASHIER',
    );
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');

    // Check if the ticket is already being processed by another counter
    if (session.status === 'CALLED' || session.status === 'SERVING') {
      if (session.counterId && session.counterId !== counterId) {
        const otherCounter = await this.prisma.counter.findUnique({
          where: { id: session.counterId },
        });
        throw new BadRequestException(
          `Tiket ini sedang diproses di ${otherCounter?.name || 'counter lain'}`,
        );
      }
    }

    const now = new Date();
    const isFirstCall = session.status === 'WAITING' || session.status === 'SKIPPED';
    const waitingDuration = (isFirstCall && session.waitingStartedAt)
      ? Math.round((now.getTime() - session.waitingStartedAt.getTime()) / 1000)
      : session.waitingDurationSeconds;

    await this.prisma.journeyUnitSession.update({
      where: { id: session.id },
      data: {
        calledAt: now,
        serviceStartedAt: now,
        status: 'SERVING',
        waitingDurationSeconds: waitingDuration,
        counterId,
        updatedBy: userId,
      },
    });

    await this.prisma.journeyEvent.create({
      data: {
        visitId,
        journeyUnitSessionId: session.id,
        unitType: 'CASHIER',
        eventType: 'CALLED',
        counterId,
        eventTime: now,
        createdBy: userId,
      },
    });

    await this.prisma.journeyEvent.create({
      data: {
        visitId,
        journeyUnitSessionId: session.id,
        unitType: 'CASHIER',
        eventType: 'SERVICE_STARTED',
        counterId,
        eventTime: now,
        createdBy: userId,
      },
    });

    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });

    // Broadcast to kasir display
    const kasirDisplay = await this.prisma.display.findFirst({
      where: { code: 'display_kasir' },
    });
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
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'CASHIER',
    );
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pembayaran dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'CASHIER',
    );
    if (!session) throw new BadRequestException('Sesi Kasir tidak ditemukan');
    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'WAITING_DESTINATION' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pembayaran selesai, pilih tujuan selanjutnya' };
  }

  async setNextDestination(
    visitId: string,
    destination: string,
    userId: string,
  ) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });
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
   * Cancel / Drop a cashier visit
   */
  async cancelVisit(visitId: string, data: { reason: string; userId: string }) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        queueTicket: true,
        journeySessions: {
          where: {
            unitType: 'CASHIER',
            status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!visit) throw new NotFoundException('Data kunjungan tidak ditemukan');

    // Find active session
    const activeSession = visit.journeySessions?.[0];
    if (activeSession) {
      await this.journeyService.cancelSession(activeSession.id, {
        reason: data.reason,
        createdBy: data.userId,
      });
    } else {
      // Fallback update visit & ticket
      await this.prisma.visit.update({
        where: { id: visitId },
        data: { currentStatus: 'CANCELLED' },
      });

      if (visit.queueTicketId) {
        await this.prisma.queueTicket.update({
          where: { id: visit.queueTicketId },
          data: { status: 'CANCELLED' },
        });
      }

      await this.prisma.journeyEvent.create({
        data: {
          visitId: visitId,
          unitType: 'CASHIER',
          eventType: 'CANCELLED',
          eventTime: new Date(),
          note: data.reason,
          createdBy: data.userId,
        },
      });
    }

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: 'CANCEL_VISIT',
        entity: 'Visit',
        entityId: visitId,
        reason: data.reason,
        ticketNo: visit.doctorTicketNo || visit.queueTicket?.ticketNo,
        unitType: 'CASHIER',
        patientName: visit.patientName,
      },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Antrean kasir berhasil dibatalkan' };
  }

  /**
   * Hold / Skip a cashier visit (patient not present / toilet break)
   */
  async holdVisit(visitId: string, data: { userId: string }) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        queueTicket: true,
        journeySessions: {
          where: {
            unitType: 'CASHIER',
            status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!visit) throw new NotFoundException('Data kunjungan tidak ditemukan');

    const activeSession = visit.journeySessions?.[0];
    if (!activeSession)
      throw new BadRequestException('Sesi aktif tidak ditemukan');

    await this.journeyService.holdSession(activeSession.id, {
      createdBy: data.userId,
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: 'HOLD_VISIT',
        entity: 'Visit',
        entityId: visitId,
        reason: 'Antrean di-hold/dilewati',
        ticketNo: visit.doctorTicketNo || visit.queueTicket?.ticketNo,
        unitType: 'CASHIER',
        patientName: visit.patientName,
      },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Antrean kasir berhasil di-hold' };
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
    const { today } = getLocalDateBoundaries();

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
  async syncTicket(
    sourceVisitId: string,
    targetVisitId: string,
    userId: string,
  ) {
    const sourceVisit = await this.prisma.visit.findUnique({
      where: { id: sourceVisitId },
    });
    const targetVisit = await this.prisma.visit.findUnique({
      where: { id: targetVisitId },
    });

    if (!sourceVisit)
      throw new NotFoundException('Data tiket Kiosk tidak ditemukan');
    if (!targetVisit)
      throw new NotFoundException('Data kunjungan pasien tidak ditemukan');

    await this.prisma.$transaction(async (prisma) => {
      const sourceQueueTicketId = sourceVisit.queueTicketId;

      // 1. Delete source visit journey events and sessions
      const sourceSessions = await prisma.journeyUnitSession.findMany({
        where: { visitId: sourceVisitId },
      });
      const sourceSessionIds = sourceSessions.map((s) => s.id);
      if (sourceSessionIds.length > 0) {
        await prisma.journeyEvent.deleteMany({
          where: { journeyUnitSessionId: { in: sourceSessionIds } },
        });
      }
      await prisma.journeyEvent.deleteMany({
        where: { visitId: sourceVisitId },
      });
      await prisma.journeyUnitSession.deleteMany({
        where: { visitId: sourceVisitId },
      });

      // 2. Delete source visit first to free up the unique constraint on queueTicketId
      await prisma.visit.delete({ where: { id: sourceVisitId } });

      // 3. Move ticket to targetVisit
      await prisma.visit.update({
        where: { id: targetVisitId },
        data: { queueTicketId: sourceQueueTicketId },
      });

      // 4. Update target session ticket
      const targetSession = await prisma.journeyUnitSession.findFirst({
        where: {
          visitId: targetVisitId,
          unitType: 'CASHIER',
          status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
        },
      });
      if (targetSession) {
        await prisma.journeyUnitSession.update({
          where: { id: targetSession.id },
          data: { queueTicketId: sourceQueueTicketId },
        });
      }

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SYNC_TICKET',
          entity: 'Visit',
          entityId: targetVisitId,
          reason: `Merged Kiosk ticket into patient visit`,
        },
      });
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Sinkronisasi antrean berhasil' };
  }
}
