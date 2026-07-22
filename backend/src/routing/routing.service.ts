import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JourneyService } from '../journey/journey.service';

/**
 * Destination option returned by getAvailableDestinations
 */
export interface UnitDestination {
  unitType: string;
  label: string;
  icon: string;
  isDefault: boolean;
}

/**
 * Centralized routing service for dynamic patient journey flow.
 *
 * All unit services delegate their "finish → route to next" logic here,
 * instead of hardcoding the next unit type.
 *
 * Prepared for future HIS/SIMRS integration via adapter pattern.
 */
@Injectable()
export class RoutingService {
  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
  ) {}

  /**
   * Map of valid destinations from each unit type.
   * First entry is the default destination.
   */
  private readonly destinationMap: Record<string, UnitDestination[]> = {
    ADMISSION: [
      {
        unitType: 'ASSESSMENT',
        label: 'Pengkajian',
        icon: '📋',
        isDefault: true,
      },
      {
        unitType: 'DOCTOR',
        label: 'Dokter/Poli',
        icon: '👨‍⚕️',
        isDefault: false,
      },
      { unitType: 'BDR', label: 'BDR', icon: '🏥', isDefault: false },
      { unitType: 'CDC', label: 'CDC', icon: '🔬', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: false,
      },
    ],
    ASSESSMENT: [
      { unitType: 'BDR', label: 'BDR', icon: '🏥', isDefault: true },
      {
        unitType: 'DOCTOR',
        label: 'Dokter/Poli',
        icon: '👨‍⚕️',
        isDefault: false,
      },
      { unitType: 'CDC', label: 'CDC', icon: '🔬', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: false,
      },
    ],
    BDR: [
      { unitType: 'DOCTOR', label: 'Dokter/Poli', icon: '👨‍⚕️', isDefault: true },
      {
        unitType: 'ASSESSMENT',
        label: 'Pengkajian',
        icon: '📋',
        isDefault: false,
      },
      { unitType: 'CDC', label: 'CDC', icon: '🔬', isDefault: false },
      { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: false,
      },
    ],
    CDC: [
      { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: true },
      {
        unitType: 'DOCTOR',
        label: 'Dokter/Poli',
        icon: '👨‍⚕️',
        isDefault: false,
      },
      { unitType: 'PHARMACY', label: 'Farmasi', icon: '💊', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: false,
      },
    ],
    DOCTOR: [
      { unitType: 'CDC', label: 'CDC', icon: '🔬', isDefault: false },
      { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: false },
      { unitType: 'PHARMACY', label: 'Farmasi', icon: '💊', isDefault: false },
      { unitType: 'OPTIC', label: 'Optik', icon: '👓', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: false,
      },
    ],
    CASHIER: [
      { unitType: 'OPTIC', label: 'Optik', icon: '👓', isDefault: false },
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: true,
      },
    ],
    PHARMACY: [
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: true,
      },
      { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: false },
      { unitType: 'OPTIC', label: 'Optik', icon: '👓', isDefault: false },
    ],
    OPTIC: [
      {
        unitType: 'FINISHED',
        label: 'Selesai (Pulang)',
        icon: '🏠',
        isDefault: true,
      },
      { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: false },
      { unitType: 'PHARMACY', label: 'Farmasi', icon: '💊', isDefault: false },
    ],
  };

  /**
   * All possible unit types for transfer (any-to-any)
   */
  private readonly allUnits: UnitDestination[] = [
    { unitType: 'ADMISSION', label: 'Admisi', icon: '🏢', isDefault: false },
    {
      unitType: 'ASSESSMENT',
      label: 'Pengkajian',
      icon: '📋',
      isDefault: false,
    },
    { unitType: 'BDR', label: 'BDR', icon: '🏥', isDefault: false },
    { unitType: 'CDC', label: 'CDC', icon: '🔬', isDefault: false },
    { unitType: 'DOCTOR', label: 'Dokter/Poli', icon: '👨‍⚕️', isDefault: false },
    { unitType: 'CASHIER', label: 'Kasir', icon: '💳', isDefault: false },
    { unitType: 'PHARMACY', label: 'Farmasi', icon: '💊', isDefault: false },
    { unitType: 'OPTIC', label: 'Optik', icon: '👓', isDefault: false },
    {
      unitType: 'FINISHED',
      label: 'Selesai (Pulang)',
      icon: '🏠',
      isDefault: false,
    },
  ];

  /**
   * Get available destinations from a specific unit type
   */
  getAvailableDestinations(fromUnit: string): UnitDestination[] {
    return this.destinationMap[fromUnit] || [];
  }

  /**
   * Get all possible transfer destinations (excluding current unit)
   */
  getTransferDestinations(currentUnit: string): UnitDestination[] {
    return this.allUnits.filter((u) => u.unitType !== currentUnit);
  }

  /**
   * Get the default next unit from a unit type
   */
  getDefaultNextUnit(fromUnit: string): string | null {
    const destinations = this.destinationMap[fromUnit];
    if (!destinations) return null;
    const defaultDest = destinations.find((d) => d.isDefault);
    return defaultDest?.unitType || null;
  }

  /**
   * Route a patient to the next unit after finishing service.
   *
   * This is the core routing method — called by all unit services
   * when they finish serving a patient.
   */
  async routeToNextUnit(
    visitId: string,
    nextUnitType: string,
    options: {
      roomId?: string | null;
      floorId?: string | null;
      doctorId?: string | null;
      queueTicketId?: string;
    },
    userId: string,
  ) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');

    if (nextUnitType === 'FINISHED') {
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

    // Resolve room for the target unit if not provided
    let roomId = options.roomId || undefined;
    let floorId = options.floorId || undefined;

    if (!roomId) {
      const resolvedRoom = await this.resolveRoomForUnit(nextUnitType, visit);
      if (resolvedRoom) {
        roomId = resolvedRoom.roomId;
        floorId = resolvedRoom.floorId || floorId;
      }
    }

    // Update visit current state
    await this.prisma.visit.update({
      where: { id: visitId },
      data: {
        currentUnitType: nextUnitType as any,
        currentStatus: nextUnitType === 'PHARMACY' ? 'SERVING' : 'WAITING',
      },
    });

    // Create journey session at the new unit
    const session = await this.journeyService.createSession({
      visitId,
      unitType: nextUnitType,
      roomId: roomId || undefined,
      floorId: floorId || undefined,
      doctorId: options.doctorId || undefined,
      queueTicketId: options.queueTicketId || visit.queueTicketId,
      createdBy: userId,
    });

    if (nextUnitType === 'PHARMACY') {
      await this.prisma.journeyUnitSession.update({
        where: { id: session.id },
        data: {
          status: 'SERVING',
          serviceStartedAt: new Date(),
        },
      });
    }

    const destLabel =
      this.allUnits.find((u) => u.unitType === nextUnitType)?.label ||
      nextUnitType;
    return { message: `Pasien diarahkan ke ${destLabel}` };
  }

  /**
   * Transfer a patient from their current unit to a different unit.
   *
   * This cancels the current active session and creates a new one
   * at the target unit, with full audit trail.
   */
  async transferPatient(
    visitId: string,
    targetUnitType: string,
    reason: string,
    userId: string,
    options?: { roomId?: string; floorId?: string; doctorId?: string },
  ) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { queueTicket: true },
    });
    if (!visit) throw new NotFoundException('Visit tidak ditemukan');
    if (!visit.currentUnitType)
      throw new BadRequestException('Visit tidak memiliki unit aktif');

    const fromUnit = visit.currentUnitType;

    if (targetUnitType === fromUnit) {
      throw new BadRequestException('Unit tujuan sama dengan unit saat ini');
    }

    // 1. Find and mark current active session as TRANSFERRED
    const currentSession = await this.journeyService.findSessionByVisitAndUnit(
      visitId,
      fromUnit,
    );
    if (currentSession) {
      await this.journeyService.transferSession(currentSession.id, {
        reason,
        targetUnitType,
        createdBy: userId,
      });
    }

    // 2. Handle FINISHED destination
    if (targetUnitType === 'FINISHED') {
      await this.prisma.visit.update({
        where: { id: visitId },
        data: {
          currentUnitType: null,
          currentStatus: 'FINISHED',
          finishedAt: new Date(),
        },
      });
      return { message: 'Pasien ditransfer — kunjungan selesai' };
    }

    // 3. Resolve room for target unit
    let roomId = options?.roomId;
    let floorId = options?.floorId;

    if (!roomId) {
      const resolved = await this.resolveRoomForUnit(targetUnitType, visit);
      if (resolved) {
        roomId = resolved.roomId;
        floorId = resolved.floorId || floorId;
      }
    }

    // 4. Update visit to new unit
    await this.prisma.visit.update({
      where: { id: visitId },
      data: {
        currentUnitType: targetUnitType as any,
        currentStatus: targetUnitType === 'PHARMACY' ? 'SERVING' : 'WAITING',
      },
    });

    // 5. Create new session at target unit
    const session = await this.journeyService.createSession({
      visitId,
      unitType: targetUnitType,
      roomId: roomId || undefined,
      floorId: floorId || undefined,
      doctorId: options?.doctorId || visit.selectedDoctorId || undefined,
      queueTicketId: visit.queueTicketId,
      createdBy: userId,
    });

    if (targetUnitType === 'PHARMACY') {
      await this.prisma.journeyUnitSession.update({
        where: { id: session.id },
        data: {
          status: 'SERVING',
          serviceStartedAt: new Date(),
        },
      });
    }

    const fromLabel =
      this.allUnits.find((u) => u.unitType === fromUnit)?.label || fromUnit;
    const toLabel =
      this.allUnits.find((u) => u.unitType === targetUnitType)?.label ||
      targetUnitType;
    return { message: `Pasien ditransfer dari ${fromLabel} ke ${toLabel}` };
  }

  /**
   * Try to resolve the appropriate room for a unit type.
   *
   * Future: this method will be extended to query external HIS/SIMRS
   * via an adapter for room assignment.
   */
  private async resolveRoomForUnit(
    unitType: string,
    visit: any,
  ): Promise<{ roomId: string; floorId?: string } | null> {
    // For units that use the patient's selected room (DOCTOR, ASSESSMENT, BDR)
    if (['DOCTOR', 'ASSESSMENT', 'BDR'].includes(unitType)) {
      if (visit.selectedRoomId) {
        return { roomId: visit.selectedRoomId, floorId: visit.selectedFloorId };
      }
    }

    // For specific unit types, find the first room of matching type
    const roomTypeMap: Record<string, string> = {
      CDC: 'CDC',
      CASHIER: 'CASHIER',
      PHARMACY: 'PHARMACY',
      OPTIC: 'OPTIC',
      ADMISSION: 'ADMISSION',
    };

    const roomType = roomTypeMap[unitType];
    if (roomType) {
      const room = await this.prisma.room.findFirst({
        where: { roomType: roomType as any, isActive: true },
        include: { floor: true },
      });
      if (room) {
        return { roomId: room.id, floorId: room.floorId || undefined };
      }
    }

    return null;
  }
}
