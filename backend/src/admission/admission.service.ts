import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class AdmissionService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
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
    const tickets = await this.prisma.queueTicket.findMany({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        status: { in: ['WAITING', 'IN_PROGRESS'] },
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

    // If no visit yet, create one
    let visit = ticket.visit;
    if (!visit) {
      const visitCode = `V${Date.now().toString(36).toUpperCase()}`;
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

    return { message: 'Layanan dimulai' };
  }

  /**
   * Finish admission and route patient to next unit
   */
  async finishService(
    ticketId: string,
    data: {
      userId: string;
      patientRmNo?: string;
      patientName?: string;
      patientDob?: string;
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

    // If visit doesn't have a schedule yet, check if it was updated
    let finalRoomId = ticket.selectedRoomId;
    let finalFloorId = ticket.selectedFloorId;
    let finalDoctorId = ticket.selectedDoctorId;
    let currentDoctorTicketNo = ticket.visit.doctorTicketNo;

    // Check if visit has selected doctor (maybe updated during updatePatientData)
    if (!finalDoctorId && ticket.visit.selectedDoctorId) {
      finalDoctorId = ticket.visit.selectedDoctorId;
      finalRoomId = ticket.visit.selectedRoomId;
      finalFloorId = ticket.visit.selectedFloorId;
    }

    // Generate doctorTicketNo if not exists and doctor is selected
    if (finalDoctorId && !currentDoctorTicketNo) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const doctor = await this.prisma.doctor.findUnique({ where: { id: finalDoctorId } });
      const prefix = doctor?.doctorCode || 'DOC';

      // Find last doctor ticket for today
      const lastVisit = await this.prisma.visit.findFirst({
        where: {
          visitDate: { gte: today, lt: tomorrow },
          doctorTicketNo: { startsWith: prefix },
          selectedDoctorId: finalDoctorId,
        },
        orderBy: { doctorTicketNo: 'desc' },
      });

      let nextNumber = 1;
      if (lastVisit && lastVisit.doctorTicketNo) {
        const numberPart = lastVisit.doctorTicketNo.replace(prefix, '');
        const lastNum = parseInt(numberPart) || 0;
        nextNumber = lastNum + 1;
      }

      currentDoctorTicketNo = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    }

    const updateData: any = {
      currentUnitType: 'ASSESSMENT',
      currentStatus: 'WAITING',
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

    // Create next journey session: ASSESSMENT
    await this.journeyService.createSession({
      visitId: ticket.visit.id,
      unitType: 'ASSESSMENT',
      roomId: finalRoomId || undefined,
      floorId: finalFloorId || undefined,
      doctorId: finalDoctorId || undefined,
      queueTicketId: ticket.id,
      createdBy: data.userId,
    });

    return { message: 'Admisi selesai, pasien diarahkan ke pengkajian' };
  }

  /**
   * Update patient data on a visit
   */
  async updatePatientData(ticketId: string, data: { patientRmNo?: string; patientName?: string; patientDob?: string; scheduleId?: string }) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { visit: true },
    });
    if (!ticket?.visit) throw new BadRequestException('Visit belum dibuat');

    const updateData: any = {};
    if (data.patientRmNo !== undefined) updateData.patientRmNo = data.patientRmNo;
    if (data.patientName !== undefined) updateData.patientName = data.patientName;
    if (data.patientDob !== undefined) updateData.patientDob = data.patientDob ? new Date(data.patientDob) : null;

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
}
