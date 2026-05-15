import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { RoutingService } from '../routing/routing.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class BdrService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue(floorId?: string) {
    const where: any = {
      currentUnitType: 'BDR',
      currentStatus: { in: ['WAITING', 'CALLED', 'SERVING'] },
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
          where: { unitType: 'BDR', status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async callPatient(visitId: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { queueTicket: true, selectedRoom: { include: { floor: true } }, selectedDoctor: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'BDR');
    if (!session) throw new BadRequestException('Sesi BDR tidak ditemukan');

    await this.journeyService.callSession(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'CALLED' } });

    // Broadcast to floor display
    const floorNum = visit.selectedRoom?.floor?.floorNumber;
    if (floorNum) {
      const displayCode = `display_lantai_${floorNum}`;
      this.displayGateway.broadcastCall(displayCode, {
        ticketNo: visit.queueTicket.ticketNo,
        patientType: visit.queueTicket.patientType,
        roomName: `BDR Lt.${floorNum}`,
        doctorName: visit.selectedDoctor?.doctorName,
        unitType: 'BDR',
        calledAt: new Date(),
        visitId: visit.id,
      });

      // Log to display_call_logs
      const display = await this.prisma.display.findFirst({ where: { code: displayCode } });
      if (display) {
        await this.prisma.displayCallLog.create({
          data: {
            displayId: display.id,
            visitId: visit.id,
            queueTicketId: visit.queueTicketId,
            ticketNo: visit.queueTicket.ticketNo,
            targetRoom: `BDR Lt.${floorNum}`,
            unitType: 'BDR',
            calledAt: new Date(),
          },
        });
      }
    }

    return { message: 'Pasien dipanggil ke BDR' };
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'BDR');
    if (!session) throw new BadRequestException('Sesi BDR tidak ditemukan');

    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Layanan BDR dimulai' };
  }

  async finishService(visitId: string, userId: string, nextUnitType?: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'BDR');
    if (!session) throw new BadRequestException('Sesi BDR tidak ditemukan');

    await this.journeyService.finishService(session.id, { createdBy: userId });

    // Dynamic routing — use provided nextUnitType or default (DOCTOR)
    const nextUnit = nextUnitType || this.routingService.getDefaultNextUnit('BDR') || 'DOCTOR';

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

    const destLabel = nextUnit === 'DOCTOR' ? 'Dokter/Poli' : nextUnit.toLowerCase();
    return { message: `BDR selesai, pasien diarahkan ke ${destLabel}` };
  }

  /**
   * Transfer patient from BDR to another unit
   */
  async transferPatient(visitId: string, data: { targetUnitType: string; reason: string; userId: string }) {
    return this.routingService.transferPatient(visitId, data.targetUnitType, data.reason, data.userId);
  }

  /**
   * Get available destinations from BDR
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('BDR');
  }
}
