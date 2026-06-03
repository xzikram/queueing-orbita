import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('cashier')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'CASHIER')
@Permission('cashier')
export class CashierController {
  constructor(private service: CashierService) {}

  @Get('queue')
  getQueue() { return this.service.getQueue(); }

  @Get('destinations')
  getDestinations() { return this.service.getDestinations(); }

  @Post(':visitId/call')
  call(@Param('visitId') visitId: string, @Body() body: { counterId: string }, @Request() req: any) {
    return this.service.callPatient(visitId, body.counterId, req.user.id);
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
  nextDestination(@Param('visitId') visitId: string, @Body() body: { destination: string }, @Request() req: any) {
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

  @Public()
  @Get('recent-calls')
  getRecentCalls(@Query('limit') limit?: string) {
    return this.service.getRecentCalls(limit ? parseInt(limit) : 10);
  }
}
