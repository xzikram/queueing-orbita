import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'PHARMACY')
@Permission('pharmacy')
export class PharmacyController {
  constructor(private service: PharmacyService) {}

  @Get('queue')
  getQueue() {
    return this.service.getQueue();
  }

  @Get('recent-calls')
  getRecentCalls(@Query('limit') limit?: string) {
    return this.service.getRecentCalls(limit ? parseInt(limit) : 10);
  }

  @Post(':visitId/start-process')
  startProcess(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.startProcess(visitId, req.user.id);
  }

  @Post(':visitId/ready')
  ready(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.markReady(visitId, req.user.id);
  }

  @Post(':visitId/call')
  call(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.callPatient(visitId, req.user.id);
  }

  @Post(':visitId/finish')
  finish(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.finishService(visitId, req.user.id);
  }

  @Post(':visitId/finish-visit')
  finishVisit(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.finishVisit(visitId, req.user.id);
  }

  @Public()
  @Get('ready-list')
  getReadyList() {
    return this.service.getReadyList();
  }

  @Post('manual')
  createManual(
    @Body() body: { patientName: string; ticketNo?: string },
    @Request() req: any,
  ) {
    return this.service.createManualVisit(body.patientName, body.ticketNo, req.user.id);
  }
}
