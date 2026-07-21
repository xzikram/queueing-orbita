import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ScheduleService } from './schedule.service';
import { ScheduleImportService } from './schedule-import.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

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
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new Error('File tidak ditemukan');
    return this.importService.importExcel(file, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  create(@Body() body: any) {
    return this.scheduleService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const { reason, ...data } = body;
    const username = req.user?.name || req.user?.email || 'Admin';
    return this.scheduleService.update(id, data, reason, username);
  }

  @Delete('all')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  deleteAll() {
    return this.scheduleService.deleteAll();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  delete(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const username = req.user?.name || req.user?.email || 'Admin';
    // Reason might come from body.reason or query.reason depending on how frontend sends it
    return this.scheduleService.delete(id, body?.reason, username);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permission('schedules')
  syncHisSchedule(@Query('date') date?: string) {
    return this.scheduleService.syncDailySchedules(date);
  }

  @Get('appointment-tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getAppointmentArrivalTracking(@Query('date') date?: string) {
    return this.scheduleService.getAppointmentArrivalTracking(date);
  }
}

