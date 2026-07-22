import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';
import { getLocalDateBoundaries } from '../common/timezone.utils';

@Injectable()
export class PharmacyService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private displayGateway: DisplayGateway,
  ) {}

  private async querySimrsBridge(sql: string): Promise<any[]> {
    const bridgeUrl = process.env.SIMRS_BRIDGE_URL || 'http://192.168.40.141:88/qc/bridge.ashx';
    const bridgeToken = process.env.SIMRS_BRIDGE_TOKEN || 'OrbitaSecureBridge2026';
    const url = new URL(bridgeUrl);
    url.searchParams.append('token', bridgeToken);

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sql }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      return [];
    }
  }

  async syncSimrsPrescriptionsToday() {
    const { today, tomorrow } = getLocalDateBoundaries();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const isoDateStr = `${year}-${month}-${day}`;

    const prescriptions = await this.querySimrsBridge(`
      SELECT 
        tp.PrescriptionNo,
        tp.PrescriptionDate,
        tp.RegistrationNo,
        tp.ParamedicID,
        tp.IsApproval,
        tp.ApprovalDateTime,
        r.MedicalNo,
        p.FirstName,
        p.LastName
      FROM TransPrescription tp
      LEFT JOIN Registration r ON tp.RegistrationNo = r.RegistrationNo
      LEFT JOIN Patient p ON r.PatientID = p.PatientID
      WHERE tp.PrescriptionDate >= '${isoDateStr} 00:00:00' AND tp.IsVoid = 0
    `);

    if (!Array.isArray(prescriptions) || prescriptions.length === 0) return;

    for (const p of prescriptions) {
      if (!p.RegistrationNo) continue;
      const patientName = `${p.FirstName || ''} ${p.LastName || ''}`.trim() || 'Pasien SIMRS';
      const medicalNo = p.MedicalNo || '-';

      let visit = await this.prisma.visit.findFirst({
        where: {
          visitDate: { gte: today, lt: tomorrow },
          ...(medicalNo !== '-' ? { patientRmNo: medicalNo } : { patientName }),
        },
      });

      if (visit) {
        let pharmacySession = await this.prisma.journeyUnitSession.findFirst({
          where: {
            visitId: visit.id,
            unitType: 'PHARMACY',
          },
        });

        if (!pharmacySession) {
          await this.prisma.journeyUnitSession.create({
            data: {
              visitId: visit.id,
              unitType: 'PHARMACY',
              status: 'SERVING',
              waitingStartedAt: new Date(),
              serviceStartedAt: new Date(),
              ...(p.IsApproval ? { readyAt: new Date() } : {}),
            },
          });
          await this.prisma.visit.update({
            where: { id: visit.id },
            data: {
              currentUnitType: 'PHARMACY',
              currentStatus: p.IsApproval ? 'READY' : 'SERVING',
            },
          });
        }
      }
    }
  }

  async getQueue() {
    try {
      await this.syncSimrsPrescriptionsToday();
    } catch (e) {
      // Ignore sync error so queue fetch never breaks
    }

    const { today, tomorrow } = getLocalDateBoundaries();
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'PHARMACY',
        currentStatus: {
          in: ['WAITING', 'SERVING', 'CALLED', 'READY', 'PHARMACY_DONE'],
        },
        finishedAt: null,
        visitDate: { gte: today, lt: tomorrow },
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        journeySessions: {
          where: {
            unitType: 'PHARMACY',
            status: { notIn: ['FINISHED', 'CANCELLED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRecentCalls(limit: number = 10) {
    const { today } = getLocalDateBoundaries();
    return this.prisma.displayCallLog.findMany({
      where: {
        unitType: 'PHARMACY',
        calledAt: { gte: today },
      },
      include: {
        visit: {
          select: {
            patientName: true,
          },
        },
      },
      orderBy: { calledAt: 'desc' },
      take: limit,
    });
  }

  async startProcess(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'PHARMACY',
    );
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Proses penyiapan obat dimulai' };
  }

  async markReady(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'PHARMACY',
    );
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');

    await this.prisma.journeyUnitSession.update({
      where: { id: session.id },
      data: { readyAt: new Date() },
    });

    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'READY' },
    });

    // Create READY event
    await this.prisma.journeyEvent.create({
      data: {
        visitId,
        journeyUnitSessionId: session.id,
        unitType: 'PHARMACY',
        eventType: 'READY',
        eventTime: new Date(),
        createdBy: userId,
      },
    });

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Obat siap, panggil pasien' };
  }

  async callPatient(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { queueTicket: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'PHARMACY',
    );
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');

    await this.journeyService.callSession(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'CALLED' },
    });

    // Broadcast to farmasi display
    const farmasiDisplay = await this.prisma.display.findFirst({
      where: { code: 'display_farmasi' },
    });
    if (farmasiDisplay) {
      this.displayGateway.broadcastCall('display_farmasi', {
        ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
        patientName: visit.patientName || undefined,
        patientType: visit.queueTicket.patientType,
        roomName: 'Farmasi',
        unitType: 'PHARMACY',
        calledAt: new Date(),
        visitId: visit.id,
      });
      await this.prisma.displayCallLog.create({
        data: {
          displayId: farmasiDisplay.id,
          visitId: visit.id,
          queueTicketId: visit.queueTicketId,
          ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
          targetRoom: 'Farmasi',
          unitType: 'PHARMACY',
          calledAt: new Date(),
        },
      });
    }

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pasien dipanggil ke farmasi' };
  }

  /**
   * Finish pharmacy session — obat sudah diserahkan
   */
  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'PHARMACY',
    );
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');
    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'PHARMACY_DONE' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Obat sudah diserahkan' };
  }

  /**
   * Finish the entire visit — pasien pulang
   * Validates that the pharmacy session is already FINISHED before finalizing the visit.
   */
  async finishVisit(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        journeySessions: {
          where: { unitType: 'PHARMACY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    // Check pharmacy session is finished
    const pharmacySession = visit.journeySessions[0];
    if (!pharmacySession || pharmacySession.status !== 'FINISHED') {
      throw new BadRequestException(
        'Sesi farmasi belum selesai. Selesaikan penyerahan obat terlebih dahulu.',
      );
    }

    // Finalize the visit
    await this.prisma.visit.update({
      where: { id: visitId },
      data: {
        currentUnitType: null,
        currentStatus: 'FINISHED',
        finishedAt: new Date(),
      },
    });

    // Update queue ticket status
    if (visit.queueTicketId) {
      await this.prisma.queueTicket.update({
        where: { id: visit.queueTicketId },
        data: { status: 'FINISHED' },
      });
    }

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Kunjungan selesai, pasien pulang' };
  }

  async getReadyList() {
    const { today, tomorrow } = getLocalDateBoundaries();
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'PHARMACY',
        currentStatus: { in: ['READY', 'CALLED'] },
        finishedAt: null,
        visitDate: { gte: today, lt: tomorrow },
      },
      select: {
        id: true,
        patientName: true,
        doctorTicketNo: true,
        queueTicket: {
          select: {
            ticketNo: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async generatePharmacyTicketNo(): Promise<string> {
    const { today, tomorrow } = getLocalDateBoundaries();
    const lastTicket = await this.prisma.queueTicket.findFirst({
      where: {
        queueDate: { gte: today, lt: tomorrow },
        ticketNo: { startsWith: 'F' },
      },
      orderBy: { ticketNo: 'desc' },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const numberPart = lastTicket.ticketNo.substring(1);
      const lastNum = parseInt(numberPart) || 0;
      nextNumber = lastNum + 1;
    }

    return `F${String(nextNumber).padStart(3, '0')}`;
  }

  async createManualVisit(patientName: string, customTicketNo: string | undefined, userId: string) {
    const { today } = getLocalDateBoundaries();
    
    let ticketNo = customTicketNo?.trim();
    if (!ticketNo) {
      ticketNo = await this.generatePharmacyTicketNo();
    }

    const existingTicket = await this.prisma.queueTicket.findFirst({
      where: {
        queueDate: today,
        ticketNo,
      },
    });
    if (existingTicket) {
      throw new BadRequestException(`Nomor antrean ${ticketNo} sudah terpakai hari ini`);
    }

    return this.prisma.$transaction(async (prisma) => {
      const ticket = await prisma.queueTicket.create({
        data: {
          ticketNo,
          queueDate: today,
          patientType: 'UMUM',
          status: 'WAITING',
        },
      });

      const visitCode = `V${Date.now().toString(36).toUpperCase()}`;
      const visit = await prisma.visit.create({
        data: {
          visitCode,
          queueTicketId: ticket.id,
          visitDate: new Date(),
          patientRmNo: 'MANUAL_PHARMACY',
          patientName,
          patientType: 'UMUM',
          currentUnitType: 'PHARMACY',
          currentStatus: 'SERVING',
          createdBy: userId,
        },
      });

      await prisma.journeyUnitSession.create({
        data: {
          visitId: visit.id,
          unitType: 'PHARMACY',
          status: 'SERVING',
          waitingStartedAt: new Date(),
          serviceStartedAt: new Date(),
          queueTicketId: ticket.id,
          createdBy: userId,
        },
      });

      this.displayGateway.triggerDashboardRefresh();

      return { ticket, visit };
    });
  }
}
