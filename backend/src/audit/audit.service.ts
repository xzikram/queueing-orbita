import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  private parseLocalDate(dateStr: string, isEndOfDay: boolean = false): Date {
    let tzOffset = 8; // Default to WITA (UTC+8)
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      
      let ms = Date.UTC(y, m, d) - (tzOffset * 60 * 60 * 1000);
      if (isEndOfDay) {
        ms += (24 * 60 * 60 * 1000) - 1; // 23:59:59.999 of local day
      }
      return new Date(ms);
    }
    return new Date(dateStr);
  }

  async getLogs(query: { page?: number; limit?: number; action?: string; entity?: string; search?: string; unitType?: string; startDate?: string; endDate?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.unitType) where.unitType = query.unitType;
    if (query.search) {
      where.OR = [
        { userName: { contains: query.search } },
        { ticketNo: { contains: query.search } },
        { patientName: { contains: query.search } },
        { humanDescription: { contains: query.search } },
      ];
    }
    if (query.startDate && query.endDate) {
      where.timestamp = {
        gte: this.parseLocalDate(query.startDate),
        lte: this.parseLocalDate(query.endDate, true),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
