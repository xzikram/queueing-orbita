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
    const where = this.buildWhereClause(query);
    
    const [data, users] = await Promise.all([
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
      }),
      this.prisma.user.findMany()
    ]);

    const userMap = new Map(users.map(u => [u.id, u.name]));

    const workbook = new ExcelJS.Workbook();
    const sheetsData: Record<string, any[]> = {
      Admission: [], Kaji: [], BDR: [], CDC: [], Doctor: [], Cashier: [], Pharmacy: [], Optic: []
    };

    const formatDuration = (seconds: number | null) => {
      if (seconds == null) return '0:00:00';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    data.forEach((row) => {
      const ticketNo = row.visit?.doctorTicketNo || row.visit?.queueTicket?.ticketNo || '-';
      const patientType = row.visit?.patientType || '-';
      const date = row.createdAt.toLocaleDateString('id-ID'); 
      const waitStart = row.waitingStartedAt ? row.waitingStartedAt.toLocaleTimeString('id-ID', { hour12: false }) : '';
      const calledAt = row.calledAt ? row.calledAt.toLocaleTimeString('id-ID', { hour12: false }) : '';
      const serveStart = row.serviceStartedAt ? row.serviceStartedAt.toLocaleTimeString('id-ID', { hour12: false }) : '';
      const serveEnd = row.serviceFinishedAt ? row.serviceFinishedAt.toLocaleTimeString('id-ID', { hour12: false }) : '';
      
      const waitTime = formatDuration(row.waitingDurationSeconds);
      const serveTime = formatDuration(row.serviceDurationSeconds);
      
      const rmNo = row.visit?.patientRmNo || '-';
      let step = '-';
      let user = row.updatedBy ? (userMap.get(row.updatedBy) || row.updatedBy) : '-';

      const baseData = { Date: date, 'Patient ID': ticketNo, 'RM Pasien': rmNo, Step: step, 'User Input': user, 'Wait. Time': waitTime, 'Serv. Time': serveTime };

      switch (row.unitType) {
        case 'ADMISSION':
          sheetsData.Admission.push({
            q_number: ticketNo, rm_pasien: rmNo, q_jenisPatient: patientType, q_date: date, q_dateTime: waitStart,
            q_callingTime: calledAt, q_startTime: serveStart, q_doneTime: serveEnd,
            ServiceTime: serveTime, WaitingTime: waitTime, q_admin_Counter: row.counter?.name || '-', userInput: user
          });
          break;
        case 'ASSESSMENT':
          sheetsData.Kaji.push({ ...baseData, Step: '1-Nurse Assessment' });
          break;
        case 'BDR':
          sheetsData.BDR.push({ ...baseData, Step: row.floor?.name ? `BDR ${row.floor.name}` : 'BDR' });
          break;
        case 'CDC':
          sheetsData.CDC.push({ ...baseData, Step: row.serviceName || 'CDC' });
          break;
        case 'DOCTOR':
          sheetsData.Doctor.push({ ...baseData, Step: row.doctor?.doctorName || 'Dokter', 'User Input': row.doctor?.doctorName || user });
          break;
        case 'CASHIER':
          sheetsData.Cashier.push({ ...baseData, Step: 'Cashier' });
          break;
        case 'PHARMACY':
          sheetsData.Pharmacy.push({ ...baseData, Step: 'Pharmacy' });
          break;
        case 'OPTIC':
          sheetsData.Optic.push({ ...baseData, Step: 'Optic' });
          break;
      }
    });

    // Helper to add standard sheet
    const addStandardSheet = (name: string, rows: any[]) => {
      const sheet = workbook.addWorksheet(name);
      
      if (name === 'Admission') {
        sheet.columns = [
          { header: 'q_number', key: 'q_number', width: 15 }, { header: 'RM Pasien', key: 'rm_pasien', width: 15 }, { header: 'q_jenisPatient', key: 'q_jenisPatient', width: 15 },
          { header: 'q_date', key: 'q_date', width: 15 }, { header: 'q_dateTime', key: 'q_dateTime', width: 15 },
          { header: 'q_callingTime', key: 'q_callingTime', width: 15 }, { header: 'q_startTime', key: 'q_startTime', width: 15 },
          { header: 'q_doneTime', key: 'q_doneTime', width: 15 }, { header: 'ServiceTime', key: 'ServiceTime', width: 15 },
          { header: 'WaitingTime', key: 'WaitingTime', width: 15 }, { header: 'q_admin_Counter', key: 'q_admin_Counter', width: 15 },
          { header: 'User Input', key: 'userInput', width: 25 },
        ];
        sheet.addRows(rows);
      } else {
        sheet.columns = [
          { header: 'Date', key: 'Date', width: 15 }, { header: 'Patient ID', key: 'Patient ID', width: 20 },
          { header: 'RM Pasien', key: 'RM Pasien', width: 15 },
          { header: 'Step', key: 'Step', width: 30 }, { header: 'User Input', key: 'User Input', width: 30 },
          { header: 'Wait. Time', key: 'Wait. Time', width: 15 }, { header: 'Serv. Time', key: 'Serv. Time', width: 15 }
        ];
        sheet.addRows(rows);
      }
      sheet.getRow(1).font = { bold: true };
    };

    Object.entries(sheetsData).forEach(([name, rows]) => {
      if (rows.length > 0) {
        addStandardSheet(name, rows);
      }
    });

    if (workbook.worksheets.length === 0) {
      addStandardSheet('Data Kosong', []);
    }

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
      unitType: unitType as any,
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
