import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BdrService } from './bdr.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('bdr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'BDR')
export class BdrController {
  constructor(private service: BdrService) {}

  @Get('queue')
  getQueue(@Query('floorId') floorId?: string) {
    return this.service.getQueue(floorId);
  }

  @Post(':visitId/call')
  call(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.callPatient(visitId, req.user.id);
  }

  @Post(':visitId/start')
  start(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.startService(visitId, req.user.id);
  }

  @Post(':visitId/finish')
  finish(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.finishService(visitId, req.user.id);
  }
}
