import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class DoctorImportService {
  constructor(private prisma: PrismaService) {}

  async importExcel(file: Express.Multer.File) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('File Excel kosong');

    const errors: string[] = [];
    let success = 0,
      failed = 0,
      total = 0;

    // Expected columns: doctorCode, doctorName, specialty, defaultRoomCode
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      total++;
    });

    const rooms = await this.prisma.room.findMany();
    const roomMap = new Map(rooms.map((r) => [r.code, r]));

    const rows: any[] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      rows.push({
        rowNum,
        doctorCode: String(row.getCell(2).value || '').trim(),
        doctorName: String(row.getCell(3).value || '').trim(),
      });
    });

    for (const r of rows) {
      try {
        if (!r.doctorCode || !r.doctorName) {
          errors.push(
            `Row ${r.rowNum}: Kode Dokter dan Nama Dokter wajib diisi`,
          );
          failed++;
          continue;
        }

        await this.prisma.doctor.upsert({
          where: { doctorCode: r.doctorCode },
          update: {
            doctorName: r.doctorName,
            isActive: true,
          },
          create: {
            doctorCode: r.doctorCode,
            doctorName: r.doctorName,
            specialty: '-',
            isActive: true,
          },
        });
        success++;
      } catch (err: any) {
        errors.push(`Row ${r.rowNum}: ${err.message}`);
        failed++;
      }
    }

    return { total, success, failed, errors };
  }

  async generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Dokter');
    sheet.columns = [
      { header: 'No', key: 'no', width: 10 },
      { header: 'Singkatan', key: 'doctorCode', width: 20 },
      { header: 'Nama Dokter', key: 'doctorName', width: 40 },
    ];

    // Sample rows
    sheet.addRow({
      no: 1,
      doctorCode: 'AB',
      doctorName: 'dr. Muh. Abrar Ismail, Sp.M(K), M.Kes',
    });
    sheet.addRow({
      no: 2,
      doctorCode: 'AJ',
      doctorName: 'dr. Azizah M. Junus, Sp.M',
    });

    return workbook.xlsx.writeBuffer();
  }
}
