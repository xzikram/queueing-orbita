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
export class DoctorQueueService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private routingService: RoutingService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue(roomId?: string, floorId?: string) {
    const { today, tomorrow } = getLocalDateBoundaries();

    const where: any = {
      currentUnitType: 'DOCTOR',
      currentStatus: {
        in: ['WAITING', 'CALLED', 'SERVING'],
      },
      finishedAt: null,
      visitDate: { gte: today, lt: tomorrow },
    };

    if (roomId && roomId !== 'ALL') {
      const targetRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
      });

      if (targetRoom) {
        const matchingRooms = await this.prisma.room.findMany({
          where: {
            OR: [
              { name: targetRoom.name },
              { code: targetRoom.code },
              { id: roomId },
            ],
          },
          select: { id: true },
        });
        const matchingRoomIds = matchingRooms.map((r) => r.id);

        where.OR = [
          { selectedRoomId: { in: matchingRoomIds } },
          { currentRoomId: { in: matchingRoomIds } },
          { selectedRoom: { name: targetRoom.name } },
        ];
      } else {
        where.OR = [
          { selectedRoomId: roomId },
          { currentRoomId: roomId },
        ];
      }
    } else if (floorId) {
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
        selectedFloor: true,
        journeySessions: {
          where: {
            unitType: 'DOCTOR',
            status: { notIn: ['FINISHED', 'CANCELLED', 'TRANSFERRED'] },
          },
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
      include: {
        queueTicket: true,
        selectedRoom: { include: { floor: true } },
        selectedDoctor: true,
      },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'DOCTOR',
    );
    if (!session) throw new BadRequestException('Sesi Dokter tidak ditemukan');

    await this.journeyService.callSession(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'CALLED' },
    });

    // Broadcast to floor display
    const floorNum = visit.selectedRoom?.floor?.floorNumber;
    if (floorNum) {
      const displayCode = `display_lantai_${floorNum}`;
      this.displayGateway.broadcastCall(displayCode, {
        ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
        patientType: visit.queueTicket.patientType,
        roomName: visit.selectedRoom?.name,
        doctorName: visit.selectedDoctor?.doctorName,
        unitType: 'DOCTOR',
        calledAt: new Date(),
        visitId: visit.id,
      });

      const display = await this.prisma.display.findFirst({
        where: { code: displayCode },
      });
      if (display) {
        await this.prisma.displayCallLog.create({
          data: {
            displayId: display.id,
            visitId: visit.id,
            queueTicketId: visit.queueTicketId,
            ticketNo: visit.doctorTicketNo || visit.queueTicket.ticketNo,
            targetRoom: visit.selectedRoom?.name || '',
            unitType: 'DOCTOR',
            calledAt: new Date(),
          },
        });
      }
    }

    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pasien dipanggil ke ruang dokter' };
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'DOCTOR',
    );
    if (!session) throw new BadRequestException('Sesi Dokter tidak ditemukan');

    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'SERVING' },
    });
    this.displayGateway.triggerDashboardRefresh();
    return { message: 'Pemeriksaan dokter dimulai' };
  }

  async finishService(visitId: string, userId: string, nextUnitType?: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      'DOCTOR',
    );
    if (session) {
      await this.journeyService.finishService(session.id, { createdBy: userId });
    }

    const nextUnit = nextUnitType || 'FINISHED';

    if (nextUnit === 'FINISHED') {
      await this.prisma.visit.update({
        where: { id: visitId },
        data: { currentStatus: 'FINISHED', finishedAt: new Date() },
      });
      if (session?.queueTicketId) {
        await this.prisma.queueTicket.update({
          where: { id: session.queueTicketId },
          data: { status: 'FINISHED' },
        }).catch(() => {});
      }
    } else {
      const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
      if (visit) {
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
      }
    }

    this.displayGateway.triggerDashboardRefresh();
    return { message: `Pemeriksaan dokter selesai (${nextUnit})` };
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
   * Transfer patient from doctor to another unit
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
   * Get available destinations from doctor
   */
  getDestinations() {
    return this.routingService.getAvailableDestinations('DOCTOR');
  }
}
