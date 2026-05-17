import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

function parseExcelTime(value: any): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (typeof value === 'object' && value.result) {
    return parseExcelTime(value.result);
  }
  const str = String(value).trim();
  if (str.includes('GMT')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return str;
}

@Injectable()
export class ScheduleImportService {
  constructor(private prisma: PrismaService) {}

  async importExcel(file: Express.Multer.File, uploadedBy: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('File Excel kosong');

    // Create batch
    const batch = await this.prisma.scheduleImportBatch.create({
      data: { filename: file.originalname, uploadedBy, totalRows: 0 },
    });

    const errors: string[] = [];
    let success = 0, failed = 0, total = 0;

    // Expected columns: scheduleDate, doctorCode, roomCode, startTime, endTime, quota
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      total++;
    });

    const doctors = await this.prisma.doctor.findMany();
    const rooms = await this.prisma.room.findMany({ include: { floor: true } });
    const doctorMap = new Map(doctors.map(d => [d.doctorName.toLowerCase().trim(), d]));
    const roomCodeMap = new Map(rooms.map(r => [r.code.toLowerCase().trim(), r]));
    const roomNameMap = new Map(rooms.map(r => [r.name.toLowerCase().trim(), r]));

    const rows: any[] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      rows.push({
        rowNum,
        scheduleDate: row.getCell(1).value,
        doctorName: String(row.getCell(2).value || '').trim(),
        startTime: parseExcelTime(row.getCell(3).value),
        endTime: parseExcelTime(row.getCell(4).value),
        roomQuery: String(row.getCell(5).value || '').trim(),
        quota: 999, // Hardcoded since quota is no longer managed by users
      });
    });

    for (const r of rows) {
      try {
        // Skip rows that don't look like actual schedule rows (e.g. category headers like "Pagi", "Siang")
        if (!r.startTime || !r.endTime || !r.doctorName) {
          continue; // not a real schedule row
        }

        // Validate doctor by name
        const doctor = doctorMap.get(r.doctorName.toLowerCase());
        if (!doctor) { errors.push(`Row ${r.rowNum}: Dokter "${r.doctorName}" tidak ditemukan`); failed++; continue; }

        // Validate room
        const roomQ = r.roomQuery.toLowerCase();
        const room = roomCodeMap.get(roomQ) || roomNameMap.get(roomQ) || roomNameMap.get(`poli ${roomQ}`);
        if (!room) { errors.push(`Row ${r.rowNum}: Ruangan "${r.roomQuery}" tidak ditemukan`); failed++; continue; }

        // Parse date
        let date: Date;
        if (r.scheduleDate instanceof Date) {
          date = r.scheduleDate;
        } else {
          date = new Date(String(r.scheduleDate));
        }
        if (isNaN(date.getTime())) { errors.push(`Row ${r.rowNum}: Tanggal tidak valid`); failed++; continue; }
        date.setHours(0, 0, 0, 0);

        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        const dayName = dayNames[date.getDay()];

        // Check conflicts
        const existing = await this.prisma.doctorSchedule.findFirst({
          where: { doctorId: doctor.id, roomId: room.id, scheduleDate: date },
        });
        if (existing) { errors.push(`Row ${r.rowNum}: Jadwal sudah ada (${r.doctorName} @ ${r.roomQuery} @ ${date.toISOString().slice(0,10)})`); failed++; continue; }

        await this.prisma.doctorSchedule.create({
          data: {
            scheduleDate: date,
            dayName,
            doctorId: doctor.id,
            roomId: room.id,
            floorId: room.floorId || '',
            startTime: r.startTime,
            endTime: r.endTime,
            quota: r.quota,
            importBatchId: batch.id,
          },
        });
        success++;
      } catch (err: any) {
        errors.push(`Row ${r.rowNum}: ${err.message}`);
        failed++;
      }
    }

    await this.prisma.scheduleImportBatch.update({
      where: { id: batch.id },
      data: {
        totalRows: total,
        successRows: success,
        failedRows: failed,
        status: failed === 0 ? 'COMPLETED' : (success === 0 ? 'FAILED' : 'COMPLETED'),
        errorLog: errors.length > 0 ? errors.join('\n') : null,
      },
    });

    return { batchId: batch.id, total, success, failed, errors };
  }

  async getImportHistory() {
    return this.prisma.scheduleImportBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { uploader: { select: { name: true } } },
    });
  }

  async generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Jadwal Dokter');
    sheet.columns = [
      { header: 'Tanggal (YYYY-MM-DD)', key: 'date', width: 25 },
      { header: 'Nama Dokter', key: 'doctorName', width: 40 },
      { header: 'Mulai Poli (HH:mm)', key: 'startTime', width: 20 },
      { header: 'Selesai Poli (HH:mm)', key: 'endTime', width: 20 },
      { header: 'Ruangan', key: 'room', width: 15 },
    ];
    // Sample row
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    sheet.addRow({
      date: tomorrow.toISOString().slice(0, 10),
      doctorName: 'dr. Sultan Hasanuddin, Sp.M',
      startTime: '08:00',
      endTime: '12:00',
      room: '5A',
    });

    return workbook.xlsx.writeBuffer();
  }
}
