import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OpticService } from './optic.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('optic')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'OPTIC')
@Permission('optic')
export class OpticController {
  constructor(private service: OpticService) {}

  @Get('queue')
  getQueue() {
    return this.service.getQueue();
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
