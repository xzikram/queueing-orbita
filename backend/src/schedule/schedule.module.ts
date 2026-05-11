import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleImportService } from './schedule-import.service';
import { ScheduleController } from './schedule.controller';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleImportService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
