import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
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

  @Post(':visitId/start')
  start(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.startService(visitId, req.user.id);
  }

  @Post(':visitId/finish')
  finish(@Param('visitId') visitId: string, @Request() req: any) {
    return this.service.finishService(visitId, req.user.id);
  }
}
