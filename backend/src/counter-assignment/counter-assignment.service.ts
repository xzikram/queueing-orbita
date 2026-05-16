import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayGateway } from '../websocket/display.gateway';

@Injectable()
export class CounterAssignmentService {
  constructor(
    private prisma: PrismaService,
    private displayGateway: DisplayGateway,
  ) {}

  /**
   * Get all counters with their assignment and active user info
   */
  async getAllCounters() {
    return this.prisma.counter.findMany({
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Assign a role (ADMISSION or CASHIER) to a counter
   */
  async assignRole(counterId: string, role: string | null) {
    const counter = await this.prisma.counter.findUnique({ where: { id: counterId } });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');

    const updated = await this.prisma.counter.update({
      where: { id: counterId },
      data: {
        assignedRole: role, // "ADMISSION", "CASHIER", or null
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Broadcast to all clients
    const allCounters = await this.getAllCounters();
    this.displayGateway.broadcastCounterUpdate(allCounters);

    return updated;
  }

  /**
   * Assign a user to a counter (when user logs into a counter)
   */
  async assignUser(counterId: string, userId: string | null) {
    const counter = await this.prisma.counter.findUnique({ where: { id: counterId } });
    if (!counter) throw new NotFoundException('Counter tidak ditemukan');

    // If assigning user, ensure they're not assigned to another counter
    if (userId) {
      await this.prisma.counter.updateMany({
        where: { assignedUserId: userId, id: { not: counterId } },
        data: { assignedUserId: null },
      });
    }

    const updated = await this.prisma.counter.update({
      where: { id: counterId },
      data: { assignedUserId: userId },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const allCounters = await this.getAllCounters();
    this.displayGateway.broadcastCounterUpdate(allCounters);

    return updated;
  }

  /**
   * Get counters assigned to a specific role
   */
  async getCountersByRole(role: string) {
    return this.prisma.counter.findMany({
      where: {
        assignedRole: role,
        isActive: true,
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Toggle counter active/inactive
   */
  async toggleActive(counterId: string, isActive: boolean) {
    const updated = await this.prisma.counter.update({
      where: { id: counterId },
      data: { isActive },
    });

    const allCounters = await this.getAllCounters();
    this.displayGateway.broadcastCounterUpdate(allCounters);

    return updated;
  }
}
