import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleImportService } from './schedule-import.service';
import { ScheduleController } from './schedule.controller';
import { HisApiService } from '../adapters/his-api.service';
import { ScheduleCronService } from './schedule-cron.service';

@Module({
  controllers: [ScheduleController],
  providers: [
    ScheduleService,
    ScheduleImportService,
    HisApiService,
    ScheduleCronService,
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}
