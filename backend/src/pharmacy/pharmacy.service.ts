import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class PharmacyService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue() {
    return this.prisma.visit.findMany({
      where: {
        currentUnitType: 'PHARMACY',
        currentStatus: { in: ['WAITING', 'SERVING', 'CALLED', 'READY'] },
        finishedAt: null,
      },
      include: {
        queueTicket: true,
        selectedDoctor: true,
        journeySessions: {
          where: { unitType: 'PHARMACY', status: { notIn: ['FINISHED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startProcess(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'PHARMACY');
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');
    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Proses penyiapan obat dimulai' };
  }

  async markReady(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'PHARMACY');
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');

    await this.prisma.journeyUnitSession.update({
      where: { id: session.id },
      data: { readyAt: new Date() },
    });

    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'READY' } });

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

    return { message: 'Obat siap, panggil pasien' };
  }

  async callPatient(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { queueTicket: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'PHARMACY');
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');

    await this.journeyService.callSession(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'CALLED' } });

    // Broadcast to farmasi display
    const farmasiDisplay = await this.prisma.display.findFirst({ where: { code: 'display_farmasi' } });
    if (farmasiDisplay) {
      this.displayGateway.broadcastCall('display_farmasi', {
        ticketNo: visit.queueTicket.ticketNo,
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
          ticketNo: visit.queueTicket.ticketNo,
          targetRoom: 'Farmasi',
          unitType: 'PHARMACY',
          calledAt: new Date(),
        },
      });
    }

    return { message: 'Pasien dipanggil ke farmasi' };
  }

  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'PHARMACY');
    if (!session) throw new BadRequestException('Sesi Farmasi tidak ditemukan');
    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: null, currentStatus: 'FINISHED', finishedAt: new Date() },
    });
    return { message: 'Kunjungan selesai' };
  }
}
