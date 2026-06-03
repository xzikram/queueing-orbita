import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Permission() decorator is set, allow access
    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Akses ditolak');
    }

    // ADMIN (Super Admin) always has full access
    if (user.role === 'ADMIN') {
      return true;
    }

    // Lookup the access group for this role
    const accessGroup = await this.prisma.accessGroup.findUnique({
      where: { role: user.role },
    });

    if (!accessGroup || !accessGroup.isActive) {
      throw new ForbiddenException('Access group tidak aktif atau belum dikonfigurasi untuk role Anda');
    }

    const permissions: string[] = JSON.parse(accessGroup.permissions);
    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Anda tidak memiliki akses ke fitur "${requiredPermission}"`);
    }

    return true;
  }
}
