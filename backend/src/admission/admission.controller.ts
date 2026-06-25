import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permission } from '../common/decorators/permission.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('admission')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'KEPALA_ADMISI', 'ADMISSION', 'CASHIER', 'FRONT_DESK')
@Permission('admission')
export class AdmissionController {
  constructor(private admissionService: AdmissionService) {}

  @Get('queue')
  getQueue() {
    return this.admissionService.getQueue();
  }

  @Get('destinations')
  getDestinations() {
    return this.admissionService.getDestinations();
  }

  @Post(':ticketId/call')
  callPatient(
    @Param('ticketId') ticketId: string,
    @Body() body: { counterId: string },
    @Request() req: any,
  ) {
    return this.admissionService.callPatient(ticketId, {
      counterId: body.counterId,
      userId: req.user.id,
    });
  }

  @Post(':ticketId/start')
  startService(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.admissionService.startService(ticketId, {
      userId: req.user.id,
    });
  }

  @Post(':ticketId/finish')
  finishService(
    @Param('ticketId') ticketId: string,
    @Body()
    body: {
      patientRmNo?: string;
      patientName?: string;
      patientDob?: string;
      nextUnitType?: string;
    },
    @Request() req: any,
  ) {
    return this.admissionService.finishService(ticketId, {
      userId: req.user.id,
      ...body,
    });
  }

  @Post(':ticketId/transfer')
  transferPatient(
    @Param('ticketId') ticketId: string,
    @Body() body: { targetUnitType: string; reason: string },
    @Request() req: any,
  ) {
    return this.admissionService.transferPatient(ticketId, {
      targetUnitType: body.targetUnitType,
      reason: body.reason,
      userId: req.user.id,
    });
  }

  @Post(':ticketId/cancel')
  cancelTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.admissionService.cancelTicket(ticketId, {
      reason: body.reason,
      userId: req.user.id,
    });
  }

  @Post(':ticketId/hold')
  holdTicket(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.admissionService.holdTicket(ticketId, {
      userId: req.user.id,
    });
  }

  @Get('next-doctor-ticket')
  getNextDoctorTicket(@Query('scheduleId') scheduleId: string) {
    return this.admissionService.getNextDoctorTicket(scheduleId);
  }

  @Put(':ticketId/patient-data')
  updatePatientData(
    @Param('ticketId') ticketId: string,
    @Body()
    body: {
      patientRmNo?: string;
      patientName?: string;
      patientDob?: string;
      doctorTicketNo?: string;
    },
  ) {
    return this.admissionService.updatePatientData(ticketId, body);
  }

  @Post(':ticketId/correct-time')
  correctTime(
    @Param('ticketId') ticketId: string,
    @Body() body: { field: string; correctedTime: string; reason: string },
    @Request() req: any,
  ) {
    return this.admissionService.correctTime(ticketId, {
      field: body.field as any,
      correctedTime: body.correctedTime,
      reason: body.reason,
      userId: req.user.id,
    });
  }

  @Public()
  @Get('recent-calls')
  getRecentCalls(@Query('limit') limit?: string) {
    return this.admissionService.getRecentCalls(limit ? parseInt(limit) : 10);
  }
}
