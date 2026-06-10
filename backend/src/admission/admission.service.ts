import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class AdmissionService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  /**
   * Get admission queue — tickets waiting for admission
   */
  async getQueue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get tickets that don't have a visit yet (haven't been processed by admission)
    // Only fetch tickets with prefixes A, B, C, D (Admission ticket prefixes)
    const tickets = await this.prisma.queueTicket.findMany({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        status: { in: ['WAITING', 'IN_PROGRESS'] },
        OR: [
          { ticketNo: { startsWith: 'A' } },
          { ticketNo: { startsWith: 'B' } },
          { ticketNo: { startsWith: 'C' } },
          { ticketNo: { startsWith: 'D' } },
        ],
      },
      include: {
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        selectedSchedule: true,
        visit: {
          include: {
            journeySessions: {
              where: { unitType: 'ADMISSION' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { counter: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tickets;
  }

  /**
   * Call a patient to a counter
   */
  async callPatient(ticketId: string, data: { counterId: string; userId: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: {
        selectedDoctor: true,
        selectedRoom: true,
        visit: {
          include: {
            journeySessions: {
              where: { unitType: 'ADMISSION', status: { notIn: ['FINISHED', 'CANCELLED'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket tidak ditemukan');

    const counter = await this.prisma.counter.findUnique({ where: { id: data.counterId } });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');

    // Check if the ticket is already being processed by another counter
    const activeSession = ticket.visit?.journeySessions?.[0];
    if (activeSession && activeSession.counterId && activeSession.counterId !== data.counterId) {
      const otherCounter = await this.prisma.counter.findUnique({ where: { id: activeSession.counterId } });
      throw new BadRequestException(`Tiket ini sedang diproses di ${otherCounter?.name || 'counter lain'}`);
    }

    // If no visit yet, create one
    let visit = ticket.visit;
    if (!visit) {
      const visitCode = `V${Date.now().toString(36).toUpperCase()}`;

      // Pre-generate doctor ticket number if a doctor is already selected from the kiosk
      let doctorTicketNo: string | null = null;
      if (ticket.selectedDoctorId) {
        doctorTicketNo = await this.generateDoctorTicketNo(ticket.selectedDoctorId);
      }

      visit = await this.prisma.visit.create({
        data: {
          visitCode,
          queueTicketId: ticket.id,
          visitDate: new Date(),
          patientType: ticket.patientType,
          selectedDoctorId: ticket.selectedDoctorId,
          selectedScheduleId: ticket.selectedScheduleId,
          selectedRoomId: ticket.selectedRoomId,
          selectedFloorId: ticket.selectedFloorId,
          currentUnitType: 'ADMISSION',
          currentStatus: 'CALLED',
          doctorTicketNo,
          createdBy: data.userId,
        },
        include: {
          journeySessions: {
            where: { unitType: 'ADMISSION' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      // Create admission journey session
      await this.journeyService.createSession({
        visitId: visit.id,
        unitType: 'ADMISSION',
        counterId: data.counterId,
        queueTicketId: ticket.id,
        createdBy: data.userId,
      });
    }

    // Get the admission session
    let session = await this.journeyService.findSessionByVisitAndUnit(visit.id, 'ADMISSION');
    if (!session) {
      session = await this.journeyService.createSession({
        visitId: visit.id,
        unitType: 'ADMISSION',
        counterId: data.counterId,
        queueTicketId: ticket.id,
        createdBy: data.userId,
      });
    }

    // Call the session
    await this.journeyService.callSession(session.id, {
      counterId: data.counterId,
      createdBy: data.userId,
    });

    // Update ticket status
    await this.prisma.queueTicket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS' },
    });

    // Update visit current status
    await this.prisma.visit.update({
      where: { id: visit.id },
      data: { currentStatus: 'CALLED', currentUnitType: 'ADMISSION' },
    });

    // Create display call log
    const admisiDisplay = await this.prisma.display.findFirst({
      where: { code: 'display_admisi' },
    });

    if (admisiDisplay) {
      await this.prisma.displayCallLog.create({
        data: {
          displayId: admisiDisplay.id,
          visitId: visit.id,
          queueTicketId: ticket.id,
          ticketNo: ticket.ticketNo,
          targetCounter: counter.name,
          unitType: 'ADMISSION',
          calledAt: new Date(),
        },
      });

      // Broadcast to TV display
      this.displayGateway.broadcastCall('display_admisi', {
        ticketNo: ticket.ticketNo,
        patientType: ticket.patientType,
        counterName: counter.name,
        unitType: 'ADMISSION',
        calledAt: new Date(),
        visitId: visit.id,
      });
    }

    // Trigger dashboard refresh
    this.displayGateway.triggerDashboardRefresh();

    return { ticket, visit, counter };
  }

  /**
   * Start serving a patient
   */
  async startService(ticketId: string, data: { userId: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { visit: true },
    });

    if (!ticket?.visit) throw new BadRequestException('Pasien belum dipanggil');

    const session = await this.journeyService.findSessionByVisitAndUnit(
      ticket.visit.id,
      'ADMISSION',
    );
    if (!session) throw new BadRequestException('Sesi admission tidak ditemukan');

    await this.journeyService.startService(session.id, { createdBy: data.userId });

    await this.prisma.visit.update({
      where: { id: ticket.visit.id },
      data: { currentStatus: 'SERVING' },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Layanan dimulai' };
  }

  /**
   * Finish admission and route patient to next unit (dynamic)
   */
  async finishService(
    ticketId: string,
    data: {
      userId: string;
      patientRmNo?: string;
      patientName?: string;
      patientDob?: string;
      nextUnitType?: string;
    },
  ) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: {
        visit: true,
        selectedRoom: { include: { floor: true } },
      },
    });

    if (!ticket?.visit) throw new BadRequestException('Pasien belum dipanggil');

    const session = await this.journeyService.findSessionByVisitAndUnit(
      ticket.visit.id,
      'ADMISSION',
    );
    if (!session) throw new BadRequestException('Sesi admission tidak ditemukan');

    // Finish admission session
    await this.journeyService.finishService(session.id, { createdBy: data.userId });

    // Re-fetch visit and ticket to get the latest data
    // (updatePatientData may have changed doctor/schedule/room/floor during admission)
    const freshVisit = await this.prisma.visit.findUnique({ where: { id: ticket.visit.id } });
    const freshTicket = await this.prisma.queueTicket.findUnique({ where: { id: ticketId } });

    // Always prefer visit data (most up-to-date), then fall back to ticket
    let finalDoctorId = freshVisit?.selectedDoctorId || freshTicket?.selectedDoctorId || null;
    let finalRoomId = freshVisit?.selectedRoomId || freshTicket?.selectedRoomId || null;
    let finalFloorId = freshVisit?.selectedFloorId || freshTicket?.selectedFloorId || null;
    let currentDoctorTicketNo = freshVisit?.doctorTicketNo || null;

    // Generate doctorTicketNo if not exists and doctor is selected
    if (finalDoctorId && !currentDoctorTicketNo) {
      currentDoctorTicketNo = await this.generateDoctorTicketNo(finalDoctorId);
    }

    const updateData: any = {
      currentRoomId: finalRoomId,
      doctorTicketNo: currentDoctorTicketNo,
    };
    if (data.patientRmNo) updateData.patientRmNo = data.patientRmNo;
    if (data.patientName) updateData.patientName = data.patientName;
    if (data.patientDob) updateData.patientDob = new Date(data.patientDob);

    await this.prisma.visit.update({
      where: { id: ticket.visit.id },
      data: updateData,
    });

    // Dynamic routing — use provided nextUnitType or default (ASSESSMENT)
    const nextUnit = data.nextUnitType || this.routingService.getDefaultNextUnit('ADMISSION') || 'ASSESSMENT';

    await this.routingService.routeToNextUnit(
      ticket.visit.id,
      nextUnit,
      {
        roomId: finalRoomId,
        floorId: finalFloorId,
        doctorId: finalDoctorId,
        queueTicketId: ticket.id,
      },
      data.userId,
    );

    this.displayGateway.triggerDashboardRefresh();
    const destLabel = nextUnit === 'ASSESSMENT' ? 'pengkajian' : nextUnit.toLowerCase();
    return { message: `Admisi selesai, pasien diarahkan ke ${destLabel}` };
  }

  /**
   * Transfer patient from admission to another unit
   */
  async transferPatient(ticketId: string, data: { targetUnitType: string; reason: string; userId: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { visit: true },
    });
    if (!ticket?.visit) throw new BadRequestException('Visit belum dibuat');

    return this.routingService.transferPatient(
      ticket.visit.id,
      data.targetUnitType,
      data.reason,
      data.userId,
    );
  }

  /**
   * Cancel / Drop a queue ticket
   */
  async cancelTicket(ticketId: string, data: { reason: string; userId: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: {
        visit: {
          include: {
            journeySessions: {
              where: { unitType: 'ADMISSION', status: { notIn: ['FINISHED', 'CANCELLED'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket tidak ditemukan');

    // Update queue ticket status
    await this.prisma.queueTicket.update({
      where: { id: ticketId },
      data: { status: 'CANCELLED' },
    });

    if (ticket.visit) {
      // Update visit status
      await this.prisma.visit.update({
        where: { id: ticket.visit.id },
        data: { currentStatus: 'CANCELLED' },
      });

      // Find and cancel active session
      const activeSession = ticket.visit.journeySessions?.[0];
      if (activeSession) {
        await this.journeyService.cancelSession(activeSession.id, {
          reason: data.reason,
          createdBy: data.userId,
        });
      } else {
        // If there's a visit but no active session, create a cancelled event
        await this.prisma.journeyEvent.create({
          data: {
            visitId: ticket.visit.id,
            unitType: 'ADMISSION',
            eventType: 'CANCELLED',
            eventTime: new Date(),
            note: data.reason,
            createdBy: data.userId,
          },
        });
      }
    }

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: 'CANCEL_TICKET',
        entity: 'QueueTicket',
        entityId: ticketId,
        reason: data.reason,
        ticketNo: ticket.ticketNo,
        unitType: 'ADMISSION',
      },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Tiket berhasil dibatalkan' };
  }

  /**
   * Hold / Skip a ticket (patient not present / toilet break)
   */
  async holdTicket(ticketId: string, data: { userId: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: {
        visit: {
          include: {
            journeySessions: {
              where: { unitType: 'ADMISSION', status: { notIn: ['FINISHED', 'CANCELLED'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket tidak ditemukan');
    if (!ticket.visit) throw new BadRequestException('Visit belum dibuat/pasien belum dipanggil');

    const activeSession = ticket.visit.journeySessions?.[0];
    if (!activeSession) throw new BadRequestException('Sesi aktif tidak ditemukan');

    await this.journeyService.holdSession(activeSession.id, { createdBy: data.userId });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: 'HOLD_TICKET',
        entity: 'QueueTicket',
        entityId: ticketId,
        reason: 'Antrean di-hold/dilewati',
        ticketNo: ticket.ticketNo,
        unitType: 'ADMISSION',
      },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Antrean berhasil di-hold' };
  }

  /**
   * Get available destinations from admission
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('ADMISSION');
  }

  /**
   * Update patient data on a visit
   */
  async updatePatientData(ticketId: string, data: { patientRmNo?: string; patientName?: string; patientDob?: string; scheduleId?: string; doctorTicketNo?: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { visit: true },
    });
    if (!ticket?.visit) throw new BadRequestException('Visit belum dibuat');

    const updateData: any = {};
    if (data.patientRmNo !== undefined) updateData.patientRmNo = data.patientRmNo;
    if (data.patientName !== undefined) updateData.patientName = data.patientName;
    if (data.patientDob !== undefined) updateData.patientDob = data.patientDob ? new Date(data.patientDob) : null;
    if (data.doctorTicketNo !== undefined) updateData.doctorTicketNo = data.doctorTicketNo || null;

    if (data.scheduleId) {
      const schedule = await this.prisma.doctorSchedule.findUnique({
        where: { id: data.scheduleId },
        include: { room: true },
      });
      if (schedule) {
        updateData.selectedScheduleId = schedule.id;
        updateData.selectedDoctorId = schedule.doctorId;
        updateData.selectedRoomId = schedule.roomId;
        updateData.selectedFloorId = schedule.floorId;

        // Also update the queue ticket so it matches
        await this.prisma.queueTicket.update({
          where: { id: ticket.id },
          data: {
            selectedScheduleId: schedule.id,
            selectedDoctorId: schedule.doctorId,
            selectedRoomId: schedule.roomId,
            selectedFloorId: schedule.floorId,
          },
        });
      }
    }

    await this.prisma.visit.update({ where: { id: ticket.visit.id }, data: updateData });
    return { message: 'Data pasien diperbarui' };
  }

  /**
   * Correct time on a journey session ("Lupa klik")
   */
  async correctTime(ticketId: string, data: {
    field: 'calledAt' | 'serviceStartedAt' | 'serviceFinishedAt';
    correctedTime: string;
    reason: string;
    userId: string;
  }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { visit: true },
    });
    if (!ticket?.visit) throw new BadRequestException('Visit belum dibuat');

    const session = await this.journeyService.findSessionByVisitAndUnit(ticket.visit.id, 'ADMISSION');
    if (!session) throw new BadRequestException('Sesi admission tidak ditemukan');

    const corrected = new Date(data.correctedTime);
    const updatePayload: any = { isTimeEdited: true, editedReason: data.reason, editedBy: data.userId, editedAt: new Date() };
    updatePayload[data.field] = corrected;

    // Recalculate durations
    if (data.field === 'calledAt' || data.field === 'serviceStartedAt') {
      const s = await this.prisma.journeyUnitSession.findUnique({ where: { id: session.id } });
      if (s) {
        const called = data.field === 'calledAt' ? corrected : s.calledAt;
        const started = data.field === 'serviceStartedAt' ? corrected : s.serviceStartedAt;
        if (called && s.waitingStartedAt) {
          updatePayload.waitingDurationSeconds = Math.round((called.getTime() - s.waitingStartedAt.getTime()) / 1000);
        }
        if (started && s.serviceFinishedAt) {
          updatePayload.serviceDurationSeconds = Math.round((s.serviceFinishedAt.getTime() - started.getTime()) / 1000);
        }
      }
    }

    await this.prisma.journeyUnitSession.update({ where: { id: session.id }, data: updatePayload });

    // Log event
    await this.prisma.journeyEvent.create({
      data: {
        visitId: ticket.visit.id,
        journeyUnitSessionId: session.id,
        unitType: 'ADMISSION',
        eventType: 'TIME_EDITED',
        eventTime: new Date(),
        note: `Field ${data.field} dikoreksi. Alasan: ${data.reason}`,
        createdBy: data.userId,
      },
    });

    return { message: 'Waktu berhasil dikoreksi' };
  }

  /**
   * Get recent call logs for the admission display
   */
  async getRecentCalls(limit = 10) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.displayCallLog.findMany({
      where: {
        unitType: 'ADMISSION',
        calledAt: { gte: today },
      },
      orderBy: { calledAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Helper to generate a doctor ticket number using doctorInitials (or fallback to doctorCode)
   */
  async generateDoctorTicketNo(doctorId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Dokter tidak ditemukan');

    const prefix = doctor.doctorInitials || doctor.doctorCode || 'DOC';

    // Find the last visit for this doctor today where the doctorTicketNo starts with the prefix
    const lastVisit = await this.prisma.visit.findFirst({
      where: {
        visitDate: { gte: today, lt: tomorrow },
        doctorTicketNo: { startsWith: prefix },
        selectedDoctorId: doctorId,
      },
      orderBy: { doctorTicketNo: 'desc' },
    });

    let nextNumber = 1;
    if (lastVisit && lastVisit.doctorTicketNo) {
      const numberPart = lastVisit.doctorTicketNo.substring(prefix.length);
      const lastNum = parseInt(numberPart) || 0;
      nextNumber = lastNum + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Get next doctor ticket number for a specific schedule
   */
  async getNextDoctorTicket(scheduleId: string) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Jadwal tidak ditemukan');

    const nextDoctorTicketNo = await this.generateDoctorTicketNo(schedule.doctorId);
    return { nextDoctorTicketNo };
  }
}
