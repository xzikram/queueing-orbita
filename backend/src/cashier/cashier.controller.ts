import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CASHIER')
export class CashierController {
  constructor(private service: CashierService) {}

  @Get('queue')
  getQueue() { return this.service.getQueue(); }

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
}
