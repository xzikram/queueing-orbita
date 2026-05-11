import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PHARMACY')
export class PharmacyController {
  constructor(private service: PharmacyService) {}

  @Get('queue')
  getQueue() { return this.service.getQueue(); }

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
}
