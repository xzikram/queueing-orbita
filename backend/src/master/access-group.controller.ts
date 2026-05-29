import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AccessGroupService, ALL_PERMISSIONS } from './access-group.service';
import { UpdateAccessGroupDto } from './dto/access-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('access-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AccessGroupController {
  constructor(private accessGroupService: AccessGroupService) {}

  @Get()
  findAll() {
    return this.accessGroupService.findAll();
  }

  @Get('permissions')
  getAvailablePermissions() {
    return ALL_PERMISSIONS;
  }

  @Get(':role')
  findByRole(@Param('role') role: string) {
    return this.accessGroupService.findByRole(role);
  }

  @Put(':role')
  update(@Param('role') role: string, @Body() dto: UpdateAccessGroupDto) {
    return this.accessGroupService.update(role, dto);
  }

  @Post('sync')
  syncDefaults() {
    return this.accessGroupService.syncDefaults();
  }
}
