import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JourneyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new journey unit session (patient enters a unit)
   */
  async createSession(data: {
    visitId: string;
    unitType: string;
    roomId?: string;
    floorId?: string;
    doctorId?: string;
    counterId?: string;
    queueTicketId?: string;
    createdBy?: string;
  }) {
    const session = await this.prisma.journeyUnitSession.create({
      data: {
        visitId: data.visitId,
        unitType: data.unitType as any,
        roomId: data.roomId,
        floorId: data.floorId,
        doctorId: data.doctorId,
        counterId: data.counterId,
        queueTicketId: data.queueTicketId,
        waitingStartedAt: new Date(),
        status: 'WAITING',
        createdBy: data.createdBy,
      },
    });

    // Create WAITING_CREATED event
    await this.createEvent({
      visitId: data.visitId,
      journeyUnitSessionId: session.id,
      unitType: data.unitType,
      eventType: 'WAITING_CREATED',
      roomId: data.roomId,
      floorId: data.floorId,
      doctorId: data.doctorId,
      createdBy: data.createdBy,
    });

    return session;
  }

  /**
   * Record a call event (patient called to counter/room)
   */
  async callSession(sessionId: string, data: { counterId?: string; createdBy?: string }) {
    const session = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        calledAt: new Date(),
        counterId: data.counterId,
        status: 'CALLED',
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: session.visitId,
      journeyUnitSessionId: session.id,
      unitType: session.unitType,
      eventType: 'CALLED',
      counterId: data.counterId,
      roomId: session.roomId,
      floorId: session.floorId,
      doctorId: session.doctorId,
      createdBy: data.createdBy,
    });

    return session;
  }

  /**
   * Start service (patient being served)
   */
  async startService(sessionId: string, data: { createdBy?: string }) {
    const now = new Date();
    const session = await this.prisma.journeyUnitSession.findUnique({ where: { id: sessionId } });

    const waitingDuration = session?.waitingStartedAt
      ? Math.round((now.getTime() - session.waitingStartedAt.getTime()) / 1000)
      : null;

    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        serviceStartedAt: now,
        waitingDurationSeconds: waitingDuration,
        status: 'SERVING',
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'SERVICE_STARTED',
      roomId: updated.roomId,
      floorId: updated.floorId,
      doctorId: updated.doctorId,
      counterId: updated.counterId,
      createdBy: data.createdBy,
    });

    return updated;
  }

  /**
   * Finish service
   */
  async finishService(sessionId: string, data: { createdBy?: string; serviceName?: string }) {
    const now = new Date();
    const session = await this.prisma.journeyUnitSession.findUnique({ where: { id: sessionId } });

    const serviceDuration = session?.serviceStartedAt
      ? Math.round((now.getTime() - session.serviceStartedAt.getTime()) / 1000)
      : null;

    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        serviceFinishedAt: now,
        serviceDurationSeconds: serviceDuration,
        serviceName: data.serviceName,
        status: 'FINISHED',
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'SERVICE_FINISHED',
      roomId: updated.roomId,
      floorId: updated.floorId,
      doctorId: updated.doctorId,
      counterId: updated.counterId,
      createdBy: data.createdBy,
    });

    return updated;
  }

  /**
   * Transfer session — mark as TRANSFERRED and log event
   */
  async transferSession(
    sessionId: string,
    data: { reason: string; targetUnitType: string; createdBy?: string },
  ) {
    const now = new Date();
    const session = await this.prisma.journeyUnitSession.findUnique({ where: { id: sessionId } });
    if (!session) return null;

    const serviceDuration = session.serviceStartedAt
      ? Math.round((now.getTime() - session.serviceStartedAt.getTime()) / 1000)
      : null;

    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        serviceFinishedAt: now,
        serviceDurationSeconds: serviceDuration,
        status: 'TRANSFERRED',
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'TRANSFERRED',
      roomId: updated.roomId,
      floorId: updated.floorId,
      doctorId: updated.doctorId,
      counterId: updated.counterId,
      note: `Transfer ke ${data.targetUnitType}. Alasan: ${data.reason}`,
      createdBy: data.createdBy,
    });

    return updated;
  }

  /**
   * Cancel session — mark as CANCELLED and log event, also cancel visit/ticket
   */
  async cancelSession(
    sessionId: string,
    data: { reason: string; createdBy: string },
  ) {
    const now = new Date();
    const session = await this.prisma.journeyUnitSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;

    const serviceDuration = session.serviceStartedAt
      ? Math.round((now.getTime() - session.serviceStartedAt.getTime()) / 1000)
      : null;

    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        serviceFinishedAt: now,
        serviceDurationSeconds: serviceDuration,
        status: 'CANCELLED',
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'CANCELLED',
      roomId: updated.roomId,
      floorId: updated.floorId,
      doctorId: updated.doctorId,
      counterId: updated.counterId,
      note: data.reason,
      createdBy: data.createdBy,
    });

    // Update visit current status
    await this.prisma.visit.update({
      where: { id: updated.visitId },
      data: {
        currentStatus: 'CANCELLED',
      },
    });

    // Update associated queue ticket
    if (updated.queueTicketId) {
      await this.prisma.queueTicket.update({
        where: { id: updated.queueTicketId },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    return updated;
  }

  /**
   * Edit time (for "lupa klik" correction)
   */
  async editTime(
    sessionId: string,
    data: {
      waitingStartedAt?: Date;
      calledAt?: Date;
      serviceStartedAt?: Date;
      serviceFinishedAt?: Date;
      reason: string;
      editedBy: string;
    },
  ) {
    const updateData: any = {
      isTimeEdited: true,
      editedReason: data.reason,
      editedBy: data.editedBy,
      editedAt: new Date(),
    };

    if (data.waitingStartedAt) updateData.waitingStartedAt = data.waitingStartedAt;
    if (data.calledAt) updateData.calledAt = data.calledAt;
    if (data.serviceStartedAt) updateData.serviceStartedAt = data.serviceStartedAt;
    if (data.serviceFinishedAt) updateData.serviceFinishedAt = data.serviceFinishedAt;

    // Recalculate durations
    const session = await this.prisma.journeyUnitSession.findUnique({ where: { id: sessionId } });
    const wsAt = data.waitingStartedAt || session?.waitingStartedAt;
    const ssAt = data.serviceStartedAt || session?.serviceStartedAt;
    const sfAt = data.serviceFinishedAt || session?.serviceFinishedAt;

    if (wsAt && ssAt) {
      updateData.waitingDurationSeconds = Math.round(
        (new Date(ssAt).getTime() - new Date(wsAt).getTime()) / 1000,
      );
    }
    if (ssAt && sfAt) {
      updateData.serviceDurationSeconds = Math.round(
        (new Date(sfAt).getTime() - new Date(ssAt).getTime()) / 1000,
      );
    }

    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'TIME_EDITED',
      note: data.reason,
      createdBy: data.editedBy,
    });

    return updated;
  }

  /**
   * Hold / Skip session (e.g. toilet break/not present)
   */
  async holdSession(sessionId: string, data: { createdBy: string }) {
    const updated = await this.prisma.journeyUnitSession.update({
      where: { id: sessionId },
      data: {
        status: 'SKIPPED',
        counterId: null, // Reset counter assignment so anyone can call back
        updatedBy: data.createdBy,
      },
    });

    await this.createEvent({
      visitId: updated.visitId,
      journeyUnitSessionId: updated.id,
      unitType: updated.unitType,
      eventType: 'SKIPPED',
      roomId: updated.roomId,
      floorId: updated.floorId,
      doctorId: updated.doctorId,
      createdBy: data.createdBy,
      note: 'Antrean di-hold / dilewati',
    });

    // Update visit currentStatus
    await this.prisma.visit.update({
      where: { id: updated.visitId },
      data: {
        currentStatus: 'SKIPPED',
      },
    });

    return updated;
  }

  /**
   * Get session by visit and unit type
   */
  async findSessionByVisitAndUnit(visitId: string, unitType: string) {
    return this.prisma.journeyUnitSession.findFirst({
      where: {
        visitId,
        unitType: unitType as any,
        status: { notIn: ['CANCELLED', 'FINISHED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all sessions for a visit
   */
  async findSessionsByVisit(visitId: string) {
    return this.prisma.journeyUnitSession.findMany({
      where: { visitId },
      include: {
        room: true,
        floor: true,
        doctor: true,
        counter: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create audit event
   */
  private async createEvent(data: {
    visitId: string;
    journeyUnitSessionId?: string;
    unitType: string;
    eventType: string;
    roomId?: string | null;
    floorId?: string | null;
    counterId?: string | null;
    doctorId?: string | null;
    note?: string;
    createdBy?: string;
  }) {
    return this.prisma.journeyEvent.create({
      data: {
        visitId: data.visitId,
        journeyUnitSessionId: data.journeyUnitSessionId,
        unitType: data.unitType as any,
        eventType: data.eventType as any,
        eventTime: new Date(),
        roomId: data.roomId,
        floorId: data.floorId,
        counterId: data.counterId,
        doctorId: data.doctorId,
        note: data.note,
        createdBy: data.createdBy,
      },
    });
  }
}
