import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { CounterAssignmentService } from './counter-assignment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('counter-assignment')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permission('counter-management')
export class CounterAssignmentController {
  constructor(private service: CounterAssignmentService) {}

  @Get()
  @Roles('ADMIN', 'KEPALA_ADMISI', 'ADMISSION', 'CASHIER')
  getAllCounters() {
    return this.service.getAllCounters();
  }

  @Put(':counterId/role')
  @Roles('ADMIN', 'KEPALA_ADMISI')
  assignRole(
    @Param('counterId') counterId: string,
    @Body() body: { role: string | null },
  ) {
    return this.service.assignRole(counterId, body.role);
  }

  @Put(':counterId/user')
  @Roles('ADMIN', 'KEPALA_ADMISI', 'ADMISSION', 'CASHIER')
  assignUser(
    @Param('counterId') counterId: string,
    @Body() body: { userId: string | null },
  ) {
    return this.service.assignUser(counterId, body.userId);
  }

  @Get('admission-counters')
  @Roles('ADMIN', 'KEPALA_ADMISI', 'ADMISSION')
  getAdmissionCounters() {
    return this.service.getCountersByRole('ADMISSION');
  }

  @Get('cashier-counters')
  @Roles('ADMIN', 'KEPALA_ADMISI', 'CASHIER')
  getCashierCounters() {
    return this.service.getCountersByRole('CASHIER');
  }

  @Put(':counterId/toggle-active')
  @Roles('ADMIN', 'KEPALA_ADMISI')
  toggleActive(
    @Param('counterId') counterId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.toggleActive(counterId, body.isActive);
  }
}
