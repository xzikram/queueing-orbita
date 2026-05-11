import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue-tickets')
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Post()
  generateTicket(@Body() body: { patientType: 'UMUM' | 'ASURANSI' | 'BARU' | 'LAMA' | 'ONLINE'; scheduleId: string }) {
    return this.queueService.generateTicket(body);
  }

  @Post('admission')
  generateAdmissionTicket(@Body() body: { patientType: 'BARU' | 'LAMA' | 'ASURANSI' | 'ONLINE'; scheduleId?: string }) {
    return this.queueService.generateAdmissionTicket(body);
  }

  @Get('today')
  findTodayTickets() {
    return this.queueService.findTodayTickets();
  }

  @Get('floor-display/:floorNumber')
  getFloorDisplayData(@Param('floorNumber') floorNumber: string) {
    return this.queueService.getFloorDisplayData(Number(floorNumber));
  }

  @Get(':id')
  findTicket(@Param('id') id: string) {
    return this.queueService.findTicket(id);
  }
}
