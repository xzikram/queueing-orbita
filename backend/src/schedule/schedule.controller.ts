import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Request, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ScheduleService } from './schedule.service';
import { ScheduleImportService } from './schedule-import.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('schedules')
export class ScheduleController {
  constructor(
    private scheduleService: ScheduleService,
    private importService: ScheduleImportService,
  ) {}

  @Get('active-today')
  findActiveToday() {
    return this.scheduleService.findActiveToday();
  }

  @Get('import-history')
  @UseGuards(JwtAuthGuard)
  importHistory() {
    return this.importService.getImportHistory();
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.importService.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_jadwal_dokter.xlsx',
    });
    res.send(buffer);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.scheduleService.findAll({ date, doctorId, roomId });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.scheduleService.findOne(id);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importExcel(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new Error('File tidak ditemukan');
    return this.importService.importExcel(file, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.scheduleService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.scheduleService.update(id, body);
  }

  @Delete('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deleteAll() {
    return this.scheduleService.deleteAll();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.scheduleService.delete(id);
  }
}
