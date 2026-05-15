import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CdcService } from './cdc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('cdc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CDC')
export class CdcController {
  constructor(private service: CdcService) {}

  @Get('queue')
  getQueue() { return this.service.getQueue(); }

  @Get('destinations')
  getDestinations() { return this.service.getDestinations(); }

  @Post(':visitId/start')
  start(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.startService(visitId, req.user.id);
  }

  @Post(':visitId/finish')
  finish(
    @Param('visitId') visitId: string,
    @Body() body: { nextUnitType?: string },
    @Request() req: any,
  ) {
    return this.service.finishService(visitId, req.user.id, body?.nextUnitType);
  }

  @Post(':visitId/transfer')
  transfer(
    @Param('visitId') visitId: string,
    @Body() body: { targetUnitType: string; reason: string },
    @Request() req: any,
  ) {
    return this.service.transferPatient(visitId, {
      targetUnitType: body.targetUnitType,
      reason: body.reason,
      userId: req.user.id,
    });
  }
}
