import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildWhereClause(query: any): Prisma.JourneyUnitSessionWhereInput {
    const where: Prisma.JourneyUnitSessionWhereInput = {
      status: 'FINISHED',
      waitingStartedAt: { not: null },
      serviceStartedAt: { not: null },
      serviceFinishedAt: { not: null },
      waitingDurationSeconds: { not: null },
      serviceDurationSeconds: { not: null },
    };

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    } else if (query.startDate) {
      where.createdAt = { gte: new Date(query.startDate) };
    } else if (query.endDate) {
      where.createdAt = { lte: new Date(query.endDate) };
    }

    if (query.patientType) {
      where.visit = { patientType: query.patientType as any };
    }
    if (query.floorId) where.floorId = query.floorId;
    if (query.unitType) where.unitType = query.unitType as any;
    if (query.doctorId) where.doctorId = query.doctorId;
    if (query.roomId) where.roomId = query.roomId;
    if (query.counterId) where.counterId = query.counterId;

    return where;
  }

  async getJourneySummary(query: any) {
    const where = this.buildWhereClause(query);
    
    const aggregations = await this.prisma.journeyUnitSession.aggregate({
      where,
      _count: { id: true },
      _avg: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
      },
      _max: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
      },
      _min: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
      },
    });

    return {
      totalPatients: aggregations._count.id,
      avgWaitSeconds: aggregations._avg.waitingDurationSeconds || 0,
      avgServeSeconds: aggregations._avg.serviceDurationSeconds || 0,
      maxWaitSeconds: aggregations._max.waitingDurationSeconds || 0,
      maxServeSeconds: aggregations._max.serviceDurationSeconds || 0,
      minWaitSeconds: aggregations._min.waitingDurationSeconds || 0,
      minServeSeconds: aggregations._min.serviceDurationSeconds || 0,
    };
  }

  async getUnitSummary(query: any) {
    const where = this.buildWhereClause(query);
    
    const groupBy = await this.prisma.journeyUnitSession.groupBy({
      by: ['unitType'],
      where,
      _count: { id: true },
      _avg: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
      },
    });

    return groupBy.map((item) => ({
      unitType: item.unitType,
      totalPatients: item._count.id,
      avgWaitSeconds: item._avg.waitingDurationSeconds || 0,
      avgServeSeconds: item._avg.serviceDurationSeconds || 0,
    }));
  }

  async getDoctorSummary(query: any) {
    const where = this.buildWhereClause(query);
    where.doctorId = { not: null };
    
    const groupBy = await this.prisma.journeyUnitSession.groupBy({
      by: ['doctorId'],
      where,
      _count: { id: true },
      _avg: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
      },
    });

    const doctors = await this.prisma.doctor.findMany({
      where: { id: { in: groupBy.map(g => g.doctorId).filter(id => id !== null) as string[] } }
    });
    const docMap = new Map(doctors.map(d => [d.id, d.doctorName]));

    return groupBy.map((item) => ({
      doctorId: item.doctorId,
      doctorName: item.doctorId ? docMap.get(item.doctorId) : 'Unknown',
      totalPatients: item._count.id,
      avgWaitSeconds: item._avg.waitingDurationSeconds || 0,
      avgServeSeconds: item._avg.serviceDurationSeconds || 0,
    }));
  }

  async getJourneyDetail(query: any) {
    const where = this.buildWhereClause(query);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.journeyUnitSession.findMany({
        where,
        include: {
          visit: { include: { queueTicket: true } },
          room: true,
          floor: true,
          doctor: true,
          counter: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journeyUnitSession.count({ where }),
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

  async exportExcel(query: any) {
    // ... existing exportExcel code ...
    const where = this.buildWhereClause(query);
    
    const data = await this.prisma.journeyUnitSession.findMany({
      where,
      include: {
        visit: { include: { queueTicket: true } },
        room: true,
        floor: true,
        doctor: true,
        counter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laporan Perjalanan Pasien');

    sheet.columns = [
      { header: 'No. Tiket', key: 'ticket', width: 15 },
      { header: 'Tipe Pasien', key: 'type', width: 15 },
      { header: 'Unit', key: 'unit', width: 15 },
      { header: 'Lantai', key: 'floor', width: 15 },
      { header: 'Ruangan', key: 'room', width: 20 },
      { header: 'Dokter', key: 'doctor', width: 25 },
      { header: 'Loket', key: 'counter', width: 15 },
      { header: 'Waktu Daftar', key: 'waitStart', width: 20 },
      { header: 'Waktu Dipanggil', key: 'calledAt', width: 20 },
      { header: 'Mulai Layanan', key: 'serveStart', width: 20 },
      { header: 'Selesai Layanan', key: 'serveEnd', width: 20 },
      { header: 'Durasi Tunggu (Mnt)', key: 'waitMins', width: 20 },
      { header: 'Durasi Layanan (Mnt)', key: 'serveMins', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    data.forEach((row) => {
      sheet.addRow({
        ticket: row.visit?.queueTicket?.ticketNo || '-',
        type: row.visit?.patientType || '-',
        unit: row.unitType,
        floor: row.floor?.name || '-',
        room: row.room?.name || '-',
        doctor: row.doctor?.doctorName || '-',
        counter: row.counter?.name || '-',
        waitStart: row.waitingStartedAt ? row.waitingStartedAt.toLocaleString('id-ID') : '-',
        calledAt: row.calledAt ? row.calledAt.toLocaleString('id-ID') : '-',
        serveStart: row.serviceStartedAt ? row.serviceStartedAt.toLocaleString('id-ID') : '-',
        serveEnd: row.serviceFinishedAt ? row.serviceFinishedAt.toLocaleString('id-ID') : '-',
        waitMins: row.waitingDurationSeconds ? Math.round(row.waitingDurationSeconds / 60) : 0,
        serveMins: row.serviceDurationSeconds ? Math.round(row.serviceDurationSeconds / 60) : 0,
      });
    });

    return workbook.xlsx.writeBuffer();
  }

  async getLiveStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalTickets, totalVisits, finishedVisits, activeSessions] = await Promise.all([
      this.prisma.queueTicket.count({ where: { queueDate: { gte: today } } }),
      this.prisma.visit.count({ where: { visitDate: { gte: today } } }),
      this.prisma.visit.count({ where: { visitDate: { gte: today }, finishedAt: { not: null } } }),
      this.prisma.journeyUnitSession.findMany({
        where: {
          createdAt: { gte: today },
          status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        },
      }),
    ]);

    const unitCounts: Record<string, number> = {
      ADMISSION: 0,
      ASSESSMENT: 0,
      BDR: 0,
      DOCTOR: 0,
      CDC: 0,
      CASHIER: 0,
      PHARMACY: 0,
      OPTIC: 0,
    };

    const waitingPerUnit: Record<string, number> = { ...unitCounts };
    const servingPerUnit: Record<string, number> = { ...unitCounts };

    activeSessions.forEach(session => {
      const key = session.unitType as string;
      if (unitCounts[key] !== undefined) {
        unitCounts[key]++;
        if (session.status === 'WAITING') {
          waitingPerUnit[key]++;
        } else if (session.status === 'SERVING' || session.status === 'CALLED') {
          servingPerUnit[key]++;
        }
      }
    });

    return {
      todayTickets: totalTickets,
      todayVisits: totalVisits,
      finishedVisits,
      activePatients: activeSessions.length,
      unitCounts,
      waitingPerUnit,
      servingPerUnit,
    };
  }

  async getUnitDetailedReport(unitType: string, query: any) {
    const where: Prisma.JourneyUnitSessionWhereInput = {
      unitType,
      status: 'FINISHED',
      waitingDurationSeconds: { not: null },
      serviceDurationSeconds: { not: null },
    };

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate + 'T23:59:59.999Z'),
      };
    }

    const sessions = await this.prisma.journeyUnitSession.findMany({
      where,
      select: {
        waitingDurationSeconds: true,
        serviceDurationSeconds: true,
        createdAt: true,
      },
    });

    const totalPatients = sessions.length;
    let totalWait = 0, totalServe = 0;
    let minWait = Infinity, maxWait = 0;
    let minServe = Infinity, maxServe = 0;

    const hourlyDistribution: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyDistribution[i] = 0;

    sessions.forEach(s => {
      const wait = s.waitingDurationSeconds || 0;
      const serve = s.serviceDurationSeconds || 0;

      totalWait += wait;
      totalServe += serve;

      if (wait < minWait) minWait = wait;
      if (wait > maxWait) maxWait = wait;

      if (serve < minServe) minServe = serve;
      if (serve > maxServe) maxServe = serve;

      const hour = s.createdAt.getHours();
      hourlyDistribution[hour]++;
    });

    if (totalPatients === 0) {
      minWait = 0;
      minServe = 0;
    }

    return {
      totalPatients,
      avgWaitSeconds: totalPatients ? Math.round(totalWait / totalPatients) : 0,
      minWaitSeconds: minWait,
      maxWaitSeconds: maxWait,
      avgServeSeconds: totalPatients ? Math.round(totalServe / totalPatients) : 0,
      minServeSeconds: minServe,
      maxServeSeconds: maxServe,
      hourlyDistribution,
    };
  }
}
