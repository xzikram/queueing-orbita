import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { DoctorQueueService } from './doctor-queue.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('doctor-queue')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'DOCTOR', 'ASSESSMENT', 'CDC')
@Permission('doctor')
export class DoctorQueueController {
  constructor(private service: DoctorQueueService) {}

  @Get('queue')
  getQueue(@Query('roomId') roomId?: string, @Query('floorId') floorId?: string) {
    return this.service.getQueue(roomId, floorId);
  }

  @Get('destinations')
  getDestinations() {
    return this.service.getDestinations();
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

  @Post(':visitId/next-destination')
  nextDestination(
    @Param('visitId') visitId: string,
    @Body() body: { destination: string },
    @Request() req: any,
  ) {
    return this.service.setNextDestination(visitId, body.destination, req.user.id);
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
