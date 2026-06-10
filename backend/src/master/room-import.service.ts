import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class RoomImportService {
  constructor(private prisma: PrismaService) {}

  async importExcel(file: Express.Multer.File) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('File Excel kosong');

    const errors: string[] = [];
    let success = 0, failed = 0, total = 0;

    const rows: any[] = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      total++;
      rows.push({
        rowNum,
        code: String(row.getCell(2).value || '').trim(),
        name: String(row.getCell(3).value || '').trim(),
        roomType: String(row.getCell(4).value || 'DOCTOR').trim().toUpperCase(),
        floorNum: parseInt(String(row.getCell(5).value || '')) || null,
      });
    });

    // Valid Room Types
    const validTypes = ['BDR', 'DOCTOR', 'DOCTOR_CHILD', 'CDC', 'ADMISSION', 'CASHIER', 'PHARMACY', 'OPTIC'];

    for (const r of rows) {
      try {
        if (!r.code || !r.name) {
          errors.push(`Baris ${r.rowNum}: Kode Ruangan dan Nama Ruangan wajib diisi`);
          failed++;
          continue;
        }

        const roomType = validTypes.includes(r.roomType) ? r.roomType : 'DOCTOR';

        let floorId: string | null = null;
        if (r.floorNum !== null) {
          let floor = await this.prisma.floor.findUnique({ where: { floorNumber: r.floorNum } });
          if (!floor) {
            floor = await this.prisma.floor.create({
              data: {
                floorNumber: r.floorNum,
                name: `Lantai ${r.floorNum}`,
              },
            });
          }
          floorId = floor.id;
        }

        await this.prisma.room.upsert({
          where: { code: r.code },
          update: {
            name: r.name,
            roomType: roomType as any,
            floorId,
            isActive: true,
          },
          create: {
            code: r.code,
            name: r.name,
            roomType: roomType as any,
            floorId,
            isActive: true,
          },
        });
        success++;
      } catch (err: any) {
        errors.push(`Baris ${r.rowNum}: ${err.message}`);
        failed++;
      }
    }

    return { total, success, failed, errors };
  }

  async importDefaultRooms() {
    let success = 0;
    const errors: string[] = [];

    // Ensure Floor 1 exists
    let floor1 = await this.prisma.floor.findUnique({ where: { floorNumber: 1 } });
    if (!floor1) {
      floor1 = await this.prisma.floor.create({ data: { floorNumber: 1, name: 'Lantai 1' } });
    }

    // Ensure floor 5, 6 & 7 exist
    let floor5 = await this.prisma.floor.findUnique({ where: { floorNumber: 5 } });
    if (!floor5) {
      floor5 = await this.prisma.floor.create({ data: { floorNumber: 5, name: 'Lantai 5' } });
    }
    let floor6 = await this.prisma.floor.findUnique({ where: { floorNumber: 6 } });
    if (!floor6) {
      floor6 = await this.prisma.floor.create({ data: { floorNumber: 6, name: 'Lantai 6' } });
    }
    let floor7 = await this.prisma.floor.findUnique({ where: { floorNumber: 7 } });
    if (!floor7) {
      floor7 = await this.prisma.floor.create({ data: { floorNumber: 7, name: 'Lantai 7' } });
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const allRooms: { code: string; name: string; floorId: string; roomType: string }[] = [];

    // Floor 5: A1-501 to A1-506 (Poli 5A s/d Poli 5F)
    for (let i = 1; i <= 6; i++) {
      const pad = i.toString().padStart(2, '0');
      const letter = alphabet[i - 1];
      allRooms.push({
        code: `A1-5${pad}`,
        name: `Poli 5${letter}`,
        floorId: floor5.id,
        roomType: 'DOCTOR',
      });
    }

    // Floor 6: A1-601 to A1-604 (Poli 6A s/d Poli 6D)
    for (let i = 1; i <= 4; i++) {
      const pad = i.toString().padStart(2, '0');
      const letter = alphabet[i - 1];
      allRooms.push({
        code: `A1-6${pad}`,
        name: `Poli 6${letter}`,
        floorId: floor6.id,
        roomType: 'DOCTOR',
      });
    }

    // A1-605 (Poli 6E) -> INTERNIST room (Floor 6)
    allRooms.push({
      code: 'A1-605',
      name: 'Internist',
      floorId: floor6.id,
      roomType: 'DOCTOR',
    });

    // A1-702 (Poli 7B) -> LOW VISION room (Floor 7)
    allRooms.push({
      code: 'A1-702',
      name: 'Low Vision',
      floorId: floor7.id,
      roomType: 'DOCTOR',
    });

    // B3-102 -> PEDIATRIC room (Floor 7)
    allRooms.push({
      code: 'B3-102',
      name: 'Pediatric',
      floorId: floor7.id,
      roomType: 'DOCTOR_CHILD',
    });

    for (const r of allRooms) {
      try {
        await this.prisma.room.upsert({
          where: { code: r.code },
          update: {
            name: r.name,
            roomType: r.roomType as any,
            floorId: r.floorId,
            isActive: true,
          },
          create: {
            code: r.code,
            name: r.name,
            roomType: r.roomType as any,
            floorId: r.floorId,
            isActive: true,
          },
        });
        success++;
      } catch (err: any) {
        errors.push(`Gagal mengimpor ${r.code}: ${err.message}`);
      }
    }

    return { total: allRooms.length, success, failed: allRooms.length - success, errors };
  }

  async generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Ruangan');
    sheet.columns = [
      { header: 'No', key: 'no', width: 10 },
      { header: 'Kode Ruangan', key: 'code', width: 20 },
      { header: 'Nama Ruangan', key: 'name', width: 30 },
      { header: 'Tipe Ruangan', key: 'roomType', width: 20 },
      { header: 'Nomor Lantai (Angka)', key: 'floorNum', width: 25 },
    ];
    
    // Sample rows
    sheet.addRow({ no: 1, code: 'A1-501', name: 'Poli 5A', roomType: 'DOCTOR', floorNum: 5 });
    sheet.addRow({ no: 2, code: 'A1-602', name: 'Poli 6B', roomType: 'DOCTOR', floorNum: 6 });
    sheet.addRow({ no: 3, code: 'ADMISI', name: 'Admisi Utama', roomType: 'ADMISSION', floorNum: 1 });

    return workbook.xlsx.writeBuffer();
  }
}
