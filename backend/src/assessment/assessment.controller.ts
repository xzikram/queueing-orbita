import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('assessment')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'ASSESSMENT', 'DOCTOR', 'CDC')
@Permission('assessment')
export class AssessmentController {
  constructor(private service: AssessmentService) {}

  @Get('queue')
  getQueue(@Query('floorId') floorId?: string) {
    return this.service.getQueue(floorId);
  }

  @Get('destinations')
  getDestinations() {
    return this.service.getDestinations();
  }

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
