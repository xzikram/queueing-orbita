import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';

@Injectable()
export class ScheduleCronService {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(private readonly scheduleService: ScheduleService) {}

  // Run every day at 06:00 AM
  @Cron('0 6 * * *')
  async handleDailySync() {
    this.logger.log('Executing daily Cron Job: HIS Schedule Sync (06:00 AM)');
    try {
      await this.scheduleService.syncDailySchedules();
    } catch (error) {
      this.logger.error('Failed to execute daily HIS sync', error);
    }
  }
}
