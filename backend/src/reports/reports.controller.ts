import { Controller, Get, Query, Param, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Response } from 'express';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('journey-summary')
  @Roles('ADMIN', 'MANAGEMENT')
  async getJourneySummary(@Query() query: any) {
    return this.reportsService.getJourneySummary(query);
  }

  @Get('unit-summary')
  @Roles('ADMIN', 'MANAGEMENT')
  async getUnitSummary(@Query() query: any) {
    return this.reportsService.getUnitSummary(query);
  }

  @Get('doctor-summary')
  @Roles('ADMIN', 'MANAGEMENT')
  async getDoctorSummary(@Query() query: any) {
    return this.reportsService.getDoctorSummary(query);
  }

  @Get('journey-detail')
  @Roles('ADMIN', 'MANAGEMENT')
  async getJourneyDetail(@Query() query: any) {
    return this.reportsService.getJourneyDetail(query);
  }

  @Get('live-stats')
  @Roles('ADMIN', 'MANAGEMENT')
  async getLiveStats() {
    return this.reportsService.getLiveStats();
  }

  @Get('unit-detailed/:unitType')
  @Roles('ADMIN', 'MANAGEMENT')
  async getUnitDetailedReport(@Param('unitType') unitType: string, @Query() query: any) {
    return this.reportsService.getUnitDetailedReport(unitType, query);
  }

  @Get('export-excel')
  @Roles('ADMIN', 'MANAGEMENT')
  async exportExcel(@Query() query: any, @Res() res: Response) {
    try {
      const buffer = await this.reportsService.exportExcel(query);
      const filename = `Laporan_Perjalanan_Pasien_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(buffer);
    } catch (error: any) {
      throw new BadRequestException('Gagal mengekspor data: ' + error.message);
    }
  }
}
