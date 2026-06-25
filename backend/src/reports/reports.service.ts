import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private parseLocalDate(dateStr: string, isEndOfDay: boolean = false): Date {
    let tzOffset = 8; // Default to Asia/Makassar (WITA, UTC+8)
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      let ms = Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000;
      if (isEndOfDay) {
        ms += 24 * 60 * 60 * 1000 - 1; // 23:59:59.999 of local day
      }
      return new Date(ms);
    }
    return new Date(dateStr);
  }

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
        gte: this.parseLocalDate(query.startDate),
        lte: this.parseLocalDate(query.endDate, true),
      };
    } else if (query.startDate) {
      where.createdAt = { gte: this.parseLocalDate(query.startDate) };
    } else if (query.endDate) {
      where.createdAt = { lte: this.parseLocalDate(query.endDate, true) };
    }

    if (query.patientType) {
      where.visit = { patientType: query.patientType };
    }
    if (query.floorId) where.floorId = query.floorId;
    if (query.unitType) where.unitType = query.unitType;
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
      where: {
        id: {
          in: groupBy.map((g) => g.doctorId).filter((id) => id !== null),
        },
      },
    });
    const docMap = new Map(doctors.map((d) => [d.id, d.doctorName]));

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
      this.prisma.user.findMany(),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const workbook = new ExcelJS.Workbook();
    const sheetsData: Record<string, any[]> = {
      Admission: [],
      Kaji: [],
      BDR: [],
      CDC: [],
      Doctor: [],
      Cashier: [],
      Pharmacy: [],
      Optic: [],
    };

    const formatDuration = (seconds: number | null) => {
      if (seconds == null) return '0:00:00';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    data.forEach((row) => {
      const ticketNo =
        row.visit?.doctorTicketNo || row.visit?.queueTicket?.ticketNo || '-';
      const patientType = row.visit?.patientType || '-';
      const date = row.createdAt.toLocaleDateString('id-ID');
      const waitStart = row.waitingStartedAt
        ? row.waitingStartedAt.toLocaleTimeString('id-ID', { hour12: false })
        : '';
      const calledAt = row.calledAt
        ? row.calledAt.toLocaleTimeString('id-ID', { hour12: false })
        : '';
      const serveStart = row.serviceStartedAt
        ? row.serviceStartedAt.toLocaleTimeString('id-ID', { hour12: false })
        : '';
      const serveEnd = row.serviceFinishedAt
        ? row.serviceFinishedAt.toLocaleTimeString('id-ID', { hour12: false })
        : '';

      const waitTime = formatDuration(row.waitingDurationSeconds);
      const serveTime = formatDuration(row.serviceDurationSeconds);

      const rmNo = row.visit?.patientRmNo || '-';
      const step = '-';
      const user = row.updatedBy
        ? userMap.get(row.updatedBy) || row.updatedBy
        : '-';

      const baseData = {
        Date: date,
        'Patient ID': ticketNo,
        'RM Pasien': rmNo,
        Step: step,
        'User Input': user,
        'Wait. Time': waitTime,
        'Serv. Time': serveTime,
      };

      switch (row.unitType) {
        case 'ADMISSION':
          sheetsData.Admission.push({
            q_number: ticketNo,
            rm_pasien: rmNo,
            q_jenisPatient: patientType,
            q_date: date,
            q_dateTime: waitStart,
            q_callingTime: calledAt,
            q_startTime: serveStart,
            q_doneTime: serveEnd,
            ServiceTime: serveTime,
            WaitingTime: waitTime,
            q_admin_Counter: row.counter?.name || '-',
            userInput: user,
          });
          break;
        case 'ASSESSMENT':
          sheetsData.Kaji.push({ ...baseData, Step: '1-Nurse Assessment' });
          break;
        case 'BDR':
          sheetsData.BDR.push({
            ...baseData,
            Step: row.floor?.name ? `BDR ${row.floor.name}` : 'BDR',
          });
          break;
        case 'CDC':
          sheetsData.CDC.push({ ...baseData, Step: row.serviceName || 'CDC' });
          break;
        case 'DOCTOR':
          sheetsData.Doctor.push({
            ...baseData,
            Step: row.doctor?.doctorName || 'Dokter',
            'User Input': row.doctor?.doctorName || user,
          });
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
          { header: 'q_number', key: 'q_number', width: 15 },
          { header: 'RM Pasien', key: 'rm_pasien', width: 15 },
          { header: 'q_jenisPatient', key: 'q_jenisPatient', width: 15 },
          { header: 'q_date', key: 'q_date', width: 15 },
          { header: 'q_dateTime', key: 'q_dateTime', width: 15 },
          { header: 'q_callingTime', key: 'q_callingTime', width: 15 },
          { header: 'q_startTime', key: 'q_startTime', width: 15 },
          { header: 'q_doneTime', key: 'q_doneTime', width: 15 },
          { header: 'ServiceTime', key: 'ServiceTime', width: 15 },
          { header: 'WaitingTime', key: 'WaitingTime', width: 15 },
          { header: 'q_admin_Counter', key: 'q_admin_Counter', width: 15 },
          { header: 'User Input', key: 'userInput', width: 25 },
        ];
        sheet.addRows(rows);
      } else {
        sheet.columns = [
          { header: 'Date', key: 'Date', width: 15 },
          { header: 'Patient ID', key: 'Patient ID', width: 20 },
          { header: 'RM Pasien', key: 'RM Pasien', width: 15 },
          { header: 'Step', key: 'Step', width: 30 },
          { header: 'User Input', key: 'User Input', width: 30 },
          { header: 'Wait. Time', key: 'Wait. Time', width: 15 },
          { header: 'Serv. Time', key: 'Serv. Time', width: 15 },
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
    let tzOffset = 8;
    if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
    else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

    const now = new Date();
    const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);

    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth();
    const day = localDate.getUTCDate();

    const today = new Date(
      Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
    );

    const [totalTickets, totalVisits, finishedVisits, activeSessions] =
      await Promise.all([
        this.prisma.queueTicket.count({ where: { queueDate: { gte: today } } }),
        this.prisma.visit.count({ where: { visitDate: { gte: today } } }),
        this.prisma.visit.count({
          where: { visitDate: { gte: today }, finishedAt: { not: null } },
        }),
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

    activeSessions.forEach((session) => {
      const key = session.unitType as string;
      if (unitCounts[key] !== undefined) {
        unitCounts[key]++;
        if (session.status === 'WAITING') {
          waitingPerUnit[key]++;
        } else if (
          session.status === 'SERVING' ||
          session.status === 'CALLED'
        ) {
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
        gte: this.parseLocalDate(query.startDate),
        lte: this.parseLocalDate(query.endDate, true),
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
    let totalWait = 0,
      totalServe = 0;
    let minWait = Infinity,
      maxWait = 0;
    let minServe = Infinity,
      maxServe = 0;

    const hourlyDistribution: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyDistribution[i] = 0;

    sessions.forEach((s) => {
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
      avgServeSeconds: totalPatients
        ? Math.round(totalServe / totalPatients)
        : 0,
      minServeSeconds: minServe,
      maxServeSeconds: maxServe,
      hourlyDistribution,
    };
  }

  /**
   * Get full patient journey list — all visits within date range with their complete journey
   */
  async getPatientJourneyList(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 30;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.startDate && query.endDate) {
      where.visitDate = {
        gte: this.parseLocalDate(query.startDate),
        lte: this.parseLocalDate(query.endDate, true),
      };
    } else if (query.startDate) {
      where.visitDate = { gte: this.parseLocalDate(query.startDate) };
    } else if (query.endDate) {
      where.visitDate = { lte: this.parseLocalDate(query.endDate, true) };
    } else {
      // Default today
      let tzOffset = 8;
      if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
      else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

      const now = new Date();
      const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
      const localDate = new Date(localTime);

      const year = localDate.getUTCFullYear();
      const month = localDate.getUTCMonth();
      const day = localDate.getUTCDate();

      const today = new Date(
        Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
      );
      where.visitDate = { gte: today };
    }

    if (query.search) {
      where.OR = [
        {
          queueTicket: {
            ticketNo: { contains: query.search, mode: 'insensitive' },
          },
        },
        { patientRmNo: { contains: query.search, mode: 'insensitive' } },
        { patientName: { contains: query.search, mode: 'insensitive' } },
        { doctorTicketNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status === 'finished') {
      where.finishedAt = { not: null };
    } else if (query.status === 'active') {
      where.finishedAt = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: {
          queueTicket: true,
          selectedDoctor: true,
          selectedRoom: { include: { floor: true } },
          journeySessions: {
            orderBy: { createdAt: 'asc' },
            include: {
              room: true,
              floor: true,
              doctor: true,
              counter: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.visit.count({ where }),
    ]);

    const unitOrder = [
      'ADMISSION',
      'ASSESSMENT',
      'BDR',
      'DOCTOR',
      'CDC',
      'CASHIER',
      'PHARMACY',
      'OPTIC',
    ];
    const unitLabels: Record<string, string> = {
      ADMISSION: 'Admisi',
      ASSESSMENT: 'Pengkajian',
      BDR: 'BDR',
      DOCTOR: 'Dokter/Poli',
      CDC: 'CDC',
      CASHIER: 'Kasir',
      PHARMACY: 'Farmasi',
      OPTIC: 'Optik',
    };

    const result = data.map((visit) => {
      const sessions = visit.journeySessions;

      // Calculate total journey time (from first session waiting to last session finish or now)
      let journeyStartTime: Date | null = null;
      let journeyEndTime: Date | null = null;

      for (const s of sessions) {
        if (s.waitingStartedAt) {
          if (!journeyStartTime || s.waitingStartedAt < journeyStartTime) {
            journeyStartTime = s.waitingStartedAt;
          }
        }
        if (s.serviceFinishedAt) {
          if (!journeyEndTime || s.serviceFinishedAt > journeyEndTime) {
            journeyEndTime = s.serviceFinishedAt;
          }
        }
      }

      let totalJourneySeconds: number | null = null;
      if (journeyStartTime) {
        const end = journeyEndTime || new Date();
        totalJourneySeconds = Math.round(
          (end.getTime() - journeyStartTime.getTime()) / 1000,
        );
      }

      // Build steps
      const steps = sessions.map((s) => ({
        unitType: s.unitType,
        unitLabel: unitLabels[s.unitType] || s.unitType,
        status: s.status,
        roomName: s.room?.name || null,
        floorName: s.floor?.name || null,
        doctorName: s.doctor?.doctorName || null,
        counterName: s.counter?.name || null,
        waitingStartedAt: s.waitingStartedAt,
        calledAt: s.calledAt,
        serviceStartedAt: s.serviceStartedAt,
        serviceFinishedAt: s.serviceFinishedAt,
        waitingDurationSeconds: s.waitingDurationSeconds,
        serviceDurationSeconds: s.serviceDurationSeconds,
      }));

      // Sort steps by unit order for display, but keep original timeline
      steps.sort((a, b) => {
        const ai = unitOrder.indexOf(a.unitType);
        const bi = unitOrder.indexOf(b.unitType);
        if (ai === bi) return 0;
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        ticketNo: visit.queueTicket?.ticketNo || '-',
        doctorTicketNo: visit.doctorTicketNo,
        patientRmNo: visit.patientRmNo,
        patientName: visit.patientName,
        patientType: visit.patientType,
        doctorName: visit.selectedDoctor?.doctorName,
        roomName: visit.selectedRoom?.name,
        floorName: visit.selectedRoom?.floor?.name,
        currentUnitType: visit.currentUnitType,
        currentStatus: visit.currentStatus,
        visitDate: visit.visitDate,
        finishedAt: visit.finishedAt,
        journeyStartTime,
        journeyEndTime,
        totalJourneySeconds,
        steps,
      };
    });

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export Patient Journey Tracking to Excel
   */
  async exportPatientJourney(query: any) {
    const where: any = {};
    if (query.startDate && query.endDate) {
      where.visitDate = {
        gte: this.parseLocalDate(query.startDate),
        lte: this.parseLocalDate(query.endDate, true),
      };
    } else if (query.startDate) {
      where.visitDate = { gte: this.parseLocalDate(query.startDate) };
    } else if (query.endDate) {
      where.visitDate = { lte: this.parseLocalDate(query.endDate, true) };
    } else {
      let tzOffset = 8;
      if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
      else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;

      const now = new Date();
      const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
      const localDate = new Date(localTime);

      const year = localDate.getUTCFullYear();
      const month = localDate.getUTCMonth();
      const day = localDate.getUTCDate();

      const today = new Date(
        Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
      );
      where.visitDate = { gte: today };
    }

    if (query.search) {
      where.OR = [
        {
          queueTicket: {
            ticketNo: { contains: query.search, mode: 'insensitive' },
          },
        },
        { patientRmNo: { contains: query.search, mode: 'insensitive' } },
        { patientName: { contains: query.search, mode: 'insensitive' } },
        { doctorTicketNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status === 'finished') {
      where.finishedAt = { not: null };
    } else if (query.status === 'active') {
      where.finishedAt = null;
    }

    const data = await this.prisma.visit.findMany({
      where,
      include: {
        queueTicket: true,
        selectedDoctor: true,
        journeySessions: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tracking Perjalanan Pasien');

    // Define columns
    sheet.columns = [
      { header: 'Tanggal', key: 'date', width: 15 },
      { header: 'No. Tiket', key: 'ticket', width: 12 },
      { header: 'RM Pasien', key: 'rm', width: 12 },
      { header: 'Nama Pasien', key: 'name', width: 25 },
      { header: 'Tipe Pasien', key: 'type', width: 12 },
      { header: 'Dokter Tujuan', key: 'doctor', width: 20 },
      { header: 'Status Kunjungan', key: 'status', width: 15 },
      { header: 'Datang', key: 'arrived', width: 12 },
      { header: 'Pulang', key: 'finished', width: 12 },
      { header: 'Total Waktu', key: 'totalTime', width: 15 },

      { header: 'Tunggu Admisi', key: 'w_adm', width: 15 },
      { header: 'Layan Admisi', key: 's_adm', width: 15 },

      { header: 'Tunggu Kaji', key: 'w_ass', width: 15 },
      { header: 'Layan Kaji', key: 's_ass', width: 15 },

      { header: 'Tunggu BDR', key: 'w_bdr', width: 15 },
      { header: 'Layan BDR', key: 's_bdr', width: 15 },

      { header: 'Tunggu Poli', key: 'w_doc', width: 15 },
      { header: 'Layan Poli', key: 's_doc', width: 15 },

      { header: 'Tunggu CDC', key: 'w_cdc', width: 15 },
      { header: 'Layan CDC', key: 's_cdc', width: 15 },

      { header: 'Tunggu Kasir', key: 'w_csh', width: 15 },
      { header: 'Layan Kasir', key: 's_csh', width: 15 },

      { header: 'Tunggu Farmasi', key: 'w_phr', width: 15 },
      { header: 'Layan Farmasi', key: 's_phr', width: 15 },

      { header: 'Tunggu Optik', key: 'w_opt', width: 15 },
      { header: 'Layan Optik', key: 's_opt', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    const formatDuration = (seconds: number | null | undefined) => {
      if (!seconds || seconds <= 0) return '-';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatTime = (dt: Date | null | undefined) => {
      if (!dt) return '-';
      return dt.toLocaleTimeString('id-ID', { hour12: false });
    };

    for (const visit of data) {
      let journeyStartTime: Date | null = null;
      let journeyEndTime: Date | null = null;

      const sessionsByUnit: Record<string, { w: number; s: number }> = {
        ADMISSION: { w: 0, s: 0 },
        ASSESSMENT: { w: 0, s: 0 },
        BDR: { w: 0, s: 0 },
        DOCTOR: { w: 0, s: 0 },
        CDC: { w: 0, s: 0 },
        CASHIER: { w: 0, s: 0 },
        PHARMACY: { w: 0, s: 0 },
        OPTIC: { w: 0, s: 0 },
      };

      for (const s of visit.journeySessions) {
        if (
          s.waitingStartedAt &&
          (!journeyStartTime || s.waitingStartedAt < journeyStartTime)
        ) {
          journeyStartTime = s.waitingStartedAt;
        }
        if (
          s.serviceFinishedAt &&
          (!journeyEndTime || s.serviceFinishedAt > journeyEndTime)
        ) {
          journeyEndTime = s.serviceFinishedAt;
        }

        if (sessionsByUnit[s.unitType]) {
          sessionsByUnit[s.unitType].w += s.waitingDurationSeconds || 0;
          sessionsByUnit[s.unitType].s += s.serviceDurationSeconds || 0;
        }
      }

      let totalJourneySeconds = 0;
      if (journeyStartTime && visit.finishedAt) {
        totalJourneySeconds = Math.round(
          (visit.finishedAt.getTime() - journeyStartTime.getTime()) / 1000,
        );
      } else if (journeyStartTime) {
        totalJourneySeconds = Math.round(
          (new Date().getTime() - journeyStartTime.getTime()) / 1000,
        );
      }

      sheet.addRow({
        date: visit.visitDate.toLocaleDateString('id-ID'),
        ticket: visit.queueTicket?.ticketNo || '-',
        rm: visit.patientRmNo || '-',
        name: visit.patientName || '-',
        type: visit.patientType,
        doctor: visit.selectedDoctor?.doctorName || '-',
        status: visit.finishedAt ? 'Selesai' : 'Aktif',
        arrived: formatTime(journeyStartTime),
        finished: formatTime(visit.finishedAt),
        totalTime: formatDuration(totalJourneySeconds),

        w_adm: formatDuration(sessionsByUnit.ADMISSION.w),
        s_adm: formatDuration(sessionsByUnit.ADMISSION.s),
        w_ass: formatDuration(sessionsByUnit.ASSESSMENT.w),
        s_ass: formatDuration(sessionsByUnit.ASSESSMENT.s),
        w_bdr: formatDuration(sessionsByUnit.BDR.w),
        s_bdr: formatDuration(sessionsByUnit.BDR.s),
        w_doc: formatDuration(sessionsByUnit.DOCTOR.w),
        s_doc: formatDuration(sessionsByUnit.DOCTOR.s),
        w_cdc: formatDuration(sessionsByUnit.CDC.w),
        s_cdc: formatDuration(sessionsByUnit.CDC.s),
        w_csh: formatDuration(sessionsByUnit.CASHIER.w),
        s_csh: formatDuration(sessionsByUnit.CASHIER.s),
        w_phr: formatDuration(sessionsByUnit.PHARMACY.w),
        s_phr: formatDuration(sessionsByUnit.PHARMACY.s),
        w_opt: formatDuration(sessionsByUnit.OPTIC.w),
        s_opt: formatDuration(sessionsByUnit.OPTIC.s),
      });
    }

    return workbook.xlsx.writeBuffer();
  }
}
