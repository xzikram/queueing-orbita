import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class DoctorQueueService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
    private displayGateway: DisplayGateway,
  ) {}

  async getQueue(roomId?: string, floorId?: string) {
    const where: any = {
      currentUnitType: 'DOCTOR',
      currentStatus: { in: ['WAITING', 'CALLED', 'SERVING'] },
      finishedAt: null,
    };
    if (roomId) where.selectedRoomId = roomId;
    if (floorId) where.selectedFloorId = floorId;

    return this.prisma.visit.findMany({
      where,
      include: {
        queueTicket: true,
        selectedDoctor: true,
        selectedRoom: { include: { floor: true } },
        selectedFloor: true,
        journeySessions: {
          where: { unitType: 'DOCTOR', status: { notIn: ['FINISHED', 'CANCELLED'] } },
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

    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'DOCTOR');
    if (!session) throw new BadRequestException('Sesi Dokter tidak ditemukan');

    await this.journeyService.callSession(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'CALLED' } });

    // Broadcast to floor display
    const floorNum = visit.selectedRoom?.floor?.floorNumber;
    if (floorNum) {
      const displayCode = `display_lantai_${floorNum}`;
      this.displayGateway.broadcastCall(displayCode, {
        ticketNo: visit.queueTicket.ticketNo,
        patientType: visit.queueTicket.patientType,
        roomName: visit.selectedRoom?.name,
        doctorName: visit.selectedDoctor?.doctorName,
        unitType: 'DOCTOR',
        calledAt: new Date(),
        visitId: visit.id,
      });

      const display = await this.prisma.display.findFirst({ where: { code: displayCode } });
      if (display) {
        await this.prisma.displayCallLog.create({
          data: {
            displayId: display.id,
            visitId: visit.id,
            queueTicketId: visit.queueTicketId,
            ticketNo: visit.queueTicket.ticketNo,
            targetRoom: visit.selectedRoom?.name || '',
            unitType: 'DOCTOR',
            calledAt: new Date(),
          },
        });
      }
    }

    return { message: 'Pasien dipanggil ke ruang dokter' };
  }

  async startService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'DOCTOR');
    if (!session) throw new BadRequestException('Sesi Dokter tidak ditemukan');

    await this.journeyService.startService(session.id, { createdBy: userId });
    await this.prisma.visit.update({ where: { id: visitId }, data: { currentStatus: 'SERVING' } });
    return { message: 'Pemeriksaan dokter dimulai' };
  }

  async finishService(visitId: string, userId: string) {
    const session = await this.journeyService.findSessionByVisitAndUnit(visitId, 'DOCTOR');
    if (!session) throw new BadRequestException('Sesi Dokter tidak ditemukan');

    await this.journeyService.finishService(session.id, { createdBy: userId });
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentStatus: 'WAITING_DESTINATION' },
    });
    return { message: 'Pemeriksaan selesai, pilih tujuan selanjutnya' };
  }

  async setNextDestination(visitId: string, destination: string, userId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    const validDestinations = ['CDC', 'CASHIER', 'PHARMACY', 'OPTIC', 'FINISHED'];
    if (!validDestinations.includes(destination)) {
      throw new BadRequestException('Tujuan tidak valid');
    }

    if (destination === 'FINISHED') {
      await this.prisma.visit.update({
        where: { id: visitId },
        data: {
          currentUnitType: null,
          currentStatus: 'FINISHED',
          finishedAt: new Date(),
        },
      });
      return { message: 'Kunjungan selesai' };
    }

    const unitType = destination as any;
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { currentUnitType: unitType, currentStatus: 'WAITING' },
    });

    // Find destination room
    let roomId: string | undefined;
    if (destination === 'CDC') {
      const cdcRoom = await this.prisma.room.findFirst({ where: { roomType: 'CDC' } });
      roomId = cdcRoom?.id;
    } else if (destination === 'CASHIER') {
      const kasirRoom = await this.prisma.room.findFirst({ where: { roomType: 'CASHIER' } });
      roomId = kasirRoom?.id;
    } else if (destination === 'PHARMACY') {
      const farmasiRoom = await this.prisma.room.findFirst({ where: { roomType: 'PHARMACY' } });
      roomId = farmasiRoom?.id;
    } else if (destination === 'OPTIC') {
      const optikRoom = await this.prisma.room.findFirst({ where: { roomType: 'OPTIC' } });
      roomId = optikRoom?.id;
    }

    await this.journeyService.createSession({
      visitId,
      unitType,
      roomId,
      queueTicketId: visit.queueTicketId,
      createdBy: userId,
    });

    return { message: `Pasien diarahkan ke ${destination}` };
  }
}
