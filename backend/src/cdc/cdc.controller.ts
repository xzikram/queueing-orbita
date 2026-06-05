import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CdcService } from './cdc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('cdc')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'CDC', 'ASSESSMENT', 'DOCTOR')
@Permission('cdc')
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
    @Body() body: { nextUnitType?: string; serviceName?: string },
    @Request() req: any,
  ) {
    return this.service.finishService(visitId, req.user.id, body?.nextUnitType, body?.serviceName);
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
