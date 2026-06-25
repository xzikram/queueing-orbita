import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS } from '../master/access-group.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async getPermissionsForRole(role: string): Promise<string[]> {
    if (role === 'ADMIN') {
      return [...ALL_PERMISSIONS];
    }

    const accessGroup = await this.prisma.accessGroup.findUnique({
      where: { role: role as any },
    });

    if (!accessGroup || !accessGroup.isActive) {
      return [];
    }

    return JSON.parse(accessGroup.permissions);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const permissions = await this.getPermissionsForRole(user.role);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = await this.getPermissionsForRole(user.role);

    return {
      ...user,
      permissions,
    };
  }
}
