import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MasterService } from './master.service';
import { DoctorImportService } from './doctor-import.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Response } from 'express';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterController {
  constructor(
    private masterService: MasterService,
    private doctorImportService: DoctorImportService
  ) {}

  // ==================
  // COUNTERS
  // ==================
  @Get('counters')
  findAllCounters() {
    return this.masterService.findAllCounters();
  }

  @Get('counters/:id')
  findOneCounter(@Param('id') id: string) {
    return this.masterService.findOneCounter(id);
  }

  @Post('counters')
  @Roles('ADMIN')
  createCounter(@Body() body: any) {
    return this.masterService.createCounter(body);
  }

  @Put('counters/:id')
  @Roles('ADMIN')
  updateCounter(@Param('id') id: string, @Body() body: any) {
    return this.masterService.updateCounter(id, body);
  }

  @Delete('counters/:id')
  @Roles('ADMIN')
  deleteCounter(@Param('id') id: string) {
    return this.masterService.deleteCounter(id);
  }

  // ==================
  // FLOORS
  // ==================
  @Get('floors')
  findAllFloors() {
    return this.masterService.findAllFloors();
  }

  @Get('floors/:id')
  findOneFloor(@Param('id') id: string) {
    return this.masterService.findOneFloor(id);
  }

  // ==================
  // ROOMS
  // ==================
  @Get('rooms')
  findAllRooms() {
    return this.masterService.findAllRooms();
  }

  @Get('rooms/:id')
  findOneRoom(@Param('id') id: string) {
    return this.masterService.findOneRoom(id);
  }

  @Post('rooms')
  @Roles('ADMIN')
  createRoom(@Body() body: any) {
    return this.masterService.createRoom(body);
  }

  @Put('rooms/:id')
  @Roles('ADMIN')
  updateRoom(@Param('id') id: string, @Body() body: any) {
    return this.masterService.updateRoom(id, body);
  }

  @Delete('rooms/:id')
  @Roles('ADMIN')
  deleteRoom(@Param('id') id: string) {
    return this.masterService.deleteRoom(id);
  }

  // ==================
  // DOCTORS
  // ==================
  @Get('doctors')
  findAllDoctors() {
    return this.masterService.findAllDoctors();
  }

  @Get('doctors/template')
  @Roles('ADMIN')
  async downloadDoctorTemplate(@Res() res: Response) {
    const buffer = await this.doctorImportService.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template-master-dokter.xlsx',
    });
    res.send(buffer);
  }

  @Post('doctors/import')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  importDoctors(@UploadedFile() file: Express.Multer.File) {
    return this.doctorImportService.importExcel(file);
  }

  @Get('doctors/:id')
  findOneDoctor(@Param('id') id: string) {
    return this.masterService.findOneDoctor(id);
  }

  @Post('doctors')
  @Roles('ADMIN')
  createDoctor(@Body() body: any) {
    return this.masterService.createDoctor(body);
  }

  @Put('doctors/:id')
  @Roles('ADMIN')
  updateDoctor(@Param('id') id: string, @Body() body: any) {
    return this.masterService.updateDoctor(id, body);
  }

  @Delete('doctors/all')
  @Roles('ADMIN')
  deleteAllDoctors() {
    return this.masterService.deleteAllDoctors();
  }

  @Delete('doctors/:id')
  @Roles('ADMIN')
  deleteDoctor(@Param('id') id: string) {
    return this.masterService.deleteDoctor(id);
  }

  // ==================
  // DISPLAYS
  // ==================
  @Get('displays')
  findAllDisplays() {
    return this.masterService.findAllDisplays();
  }

  @Get('displays/code/:code')
  findDisplayByCode(@Param('code') code: string) {
    return this.masterService.findDisplayByCode(code);
  }

  @Get('displays/:id')
  findOneDisplay(@Param('id') id: string) {
    return this.masterService.findOneDisplay(id);
  }

  @Put('displays/:id')
  @Roles('ADMIN')
  updateDisplay(@Param('id') id: string, @Body() body: any) {
    return this.masterService.updateDisplay(id, body);
  }
}
