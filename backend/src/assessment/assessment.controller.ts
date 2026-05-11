import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('assessment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ASSESSMENT')
export class AssessmentController {
  constructor(private service: AssessmentService) {}

  @Get('queue')
  getQueue(@Query('floorId') floorId?: string) {
    return this.service.getQueue(floorId);
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
