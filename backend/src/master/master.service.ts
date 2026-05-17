import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class MasterService {
  constructor(private prisma: PrismaService, private displayGateway: DisplayGateway) {}

  // ==================
  // COUNTERS
  // ==================
  async findAllCounters() {
    return this.prisma.counter.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneCounter(id: string) {
    const counter = await this.prisma.counter.findUnique({ where: { id } });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');
    return counter;
  }

  async createCounter(data: { code: string; name: string; canHandleAdmission?: boolean; canHandleCashier?: boolean }) {
    return this.prisma.counter.create({ data: data as any });
  }

  async updateCounter(id: string, data: any) {
    await this.findOneCounter(id);
    return this.prisma.counter.update({ where: { id }, data });
  }

  async deleteCounter(id: string) {
    await this.findOneCounter(id);
    await this.prisma.counter.delete({ where: { id } });
    return { message: 'Counter berhasil dihapus' };
  }

  // ==================
  // FLOORS
  // ==================
  async findAllFloors() {
    return this.prisma.floor.findMany({
      include: { rooms: true },
      orderBy: { floorNumber: 'asc' },
    });
  }

  async findOneFloor(id: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: { rooms: true },
    });
    if (!floor) throw new NotFoundException('Lantai tidak ditemukan');
    return floor;
  }

  // ==================
  // ROOMS
  // ==================
  async findAllRooms() {
    return this.prisma.room.findMany({
      include: { floor: true, display: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOneRoom(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { floor: true, display: true },
    });
    if (!room) throw new NotFoundException('Ruangan tidak ditemukan');
    return room;
  }

  async createRoom(data: any) {
    return this.prisma.room.create({ data });
  }

  async updateRoom(id: string, data: any) {
    await this.findOneRoom(id);
    return this.prisma.room.update({ where: { id }, data });
  }

  async deleteRoom(id: string) {
    await this.findOneRoom(id);
    await this.prisma.room.delete({ where: { id } });
    return { message: 'Ruangan berhasil dihapus' };
  }

  // ==================
  // DOCTORS
  // ==================
  async findAllDoctors() {
    return this.prisma.doctor.findMany({
      include: { defaultRoom: true },
      orderBy: { doctorName: 'asc' },
    });
  }

  async findOneDoctor(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { defaultRoom: true },
    });
    if (!doctor) throw new NotFoundException('Dokter tidak ditemukan');
    return doctor;
  }

  async createDoctor(data: any) {
    return this.prisma.doctor.create({ data });
  }

  async updateDoctor(id: string, data: any) {
    await this.findOneDoctor(id);
    return this.prisma.doctor.update({ where: { id }, data });
  }

  async deleteDoctor(id: string) {
    await this.findOneDoctor(id);
    await this.prisma.doctor.delete({ where: { id } });
    return { message: 'Dokter berhasil dihapus' };
  }

  async deleteAllDoctors() {
    // Delete schedules first due to foreign key constraints
    await this.prisma.doctorSchedule.deleteMany();
    await this.prisma.doctor.deleteMany();
    return { message: 'Semua dokter dan jadwal berhasil dihapus' };
  }

  // ==================
  // DISPLAYS
  // ==================
  async findAllDisplays() {
    return this.prisma.display.findMany({
      include: { floor: true, rooms: true, videoPlaylist: { include: { items: { orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { code: 'asc' },
    });
  }

  async findOneDisplay(id: string) {
    const display = await this.prisma.display.findUnique({
      where: { id },
      include: { floor: true, rooms: true, videoPlaylist: { include: { items: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!display) throw new NotFoundException('Display tidak ditemukan');
    return display;
  }

  async findDisplayByCode(code: string) {
    const display = await this.prisma.display.findUnique({
      where: { code },
      include: { floor: true, rooms: true, videoPlaylist: { include: { items: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!display) throw new NotFoundException('Display tidak ditemukan');
    return display;
  }

  async updateDisplay(id: string, data: any) {
    const old = await this.findOneDisplay(id);
    const updated = await this.prisma.display.update({ where: { id }, data });
    
    // Broadcast if running text changed
    if (data.runningText !== undefined && data.runningText !== old.runningText) {
      this.displayGateway.server.to(updated.code).emit('runningTextUpdate', updated.runningText);
    }
    
    // Broadcast if playlist changed
    if (data.videoPlaylistId !== undefined && data.videoPlaylistId !== old.videoPlaylistId) {
      const playlistData = await this.findDisplayByCode(updated.code);
      this.displayGateway.server.to(updated.code).emit('playlistUpdate', playlistData.videoPlaylist);
    }

    // Broadcast if video volume changed
    if (data.videoVolume !== undefined && data.videoVolume !== old.videoVolume) {
      this.displayGateway.server.to(updated.code).emit('videoVolumeUpdate', updated.videoVolume);
    }

    return updated;
  }
}
