import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permission('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles('ADMIN', 'MANAGEMENT')
  async getLogs(@Query() query: any) {
    return this.auditService.getLogs(query);
  }
}
