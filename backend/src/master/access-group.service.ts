import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccessGroupDto } from './dto/access-group.dto';

// All available permission keys — must match frontend menu keys
export const ALL_PERMISSIONS = [
  'dashboard',
  'admission',
  'assessment',
  'bdr',
  'doctor',
  'cdc',
  'cashier',
  'pharmacy',
  'optic',
  'counter-management',
  'master',
  'schedules',
  'live',
  'reports',
  'audit',
] as const;

// Default permissions per role (used for initial seed/sync)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  ADMISSION: ['dashboard', 'admission'],
  CASHIER: ['dashboard', 'cashier'],
  ASSESSMENT: ['dashboard', 'assessment'],
  BDR: ['dashboard', 'bdr'],
  DOCTOR: ['dashboard', 'doctor'],
  CDC: ['dashboard', 'cdc'],
  PHARMACY: ['dashboard', 'pharmacy'],
  OPTIC: ['dashboard', 'optic'],
  MANAGEMENT: ['dashboard', 'live', 'reports'],
  QUEUE_OFFICER: ['dashboard'],
  KEPALA_ADMISI: ['dashboard', 'admission', 'counter-management'],
};

@Injectable()
export class AccessGroupService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const groups = await this.prisma.accessGroup.findMany({
      orderBy: { role: 'asc' },
    });
    return groups.map((g) => ({
      ...g,
      permissions: JSON.parse(g.permissions),
    }));
  }

  async findByRole(role: string) {
    const group = await this.prisma.accessGroup.findUnique({
      where: { role: role as any },
    });
    if (!group) {
      // Return default permissions if no record exists
      return {
        role,
        name: role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
      };
    }
    return {
      ...group,
      permissions: JSON.parse(group.permissions),
    };
  }

  async getPermissionsForRole(role: string): Promise<string[]> {
    // ADMIN always has full access
    if (role === 'ADMIN') {
      return [...ALL_PERMISSIONS];
    }

    const group = await this.prisma.accessGroup.findUnique({
      where: { role: role as any },
    });

    if (!group || !group.isActive) {
      return DEFAULT_ROLE_PERMISSIONS[role] || [];
    }

    return JSON.parse(group.permissions);
  }

  async update(role: string, dto: UpdateAccessGroupDto) {
    // Prevent editing ADMIN
    if (role === 'ADMIN') {
      return this.findByRole(role);
    }

    const existing = await this.prisma.accessGroup.findUnique({
      where: { role: role as any },
    });

    if (!existing) {
      throw new NotFoundException(`Access group untuk role ${role} tidak ditemukan. Silakan sync terlebih dahulu.`);
    }

    const updated = await this.prisma.accessGroup.update({
      where: { role: role as any },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        permissions: JSON.stringify(dto.permissions),
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    return {
      ...updated,
      permissions: JSON.parse(updated.permissions),
    };
  }

  /**
   * Sync/seed default access groups for all roles that don't have a record yet.
   */
  async syncDefaults() {
    const allRoles = Object.keys(DEFAULT_ROLE_PERMISSIONS);
    const existing = await this.prisma.accessGroup.findMany();
    const existingRoles = new Set(existing.map((g) => g.role));

    const toCreate = allRoles.filter((r) => !existingRoles.has(r as any));

    for (const role of toCreate) {
      await this.prisma.accessGroup.create({
        data: {
          role: role as any,
          name: this.getRoleDisplayName(role),
          description: `Default access group untuk role ${role}`,
          permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role]),
        },
      });
    }

    return {
      message: `Sync selesai. ${toCreate.length} access group baru dibuat.`,
      created: toCreate,
    };
  }

  private getRoleDisplayName(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'Super Admin',
      ADMISSION: 'Admisi',
      CASHIER: 'Kasir',
      ASSESSMENT: 'Pengkajian',
      BDR: 'BDR',
      DOCTOR: 'Dokter',
      CDC: 'CDC',
      PHARMACY: 'Farmasi',
      OPTIC: 'Optik',
      MANAGEMENT: 'Manajemen',
      QUEUE_OFFICER: 'Petugas Antrian',
      KEPALA_ADMISI: 'Kepala Admisi',
    };
    return map[role] || role;
  }
}
