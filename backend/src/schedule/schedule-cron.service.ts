import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(private readonly scheduleService: ScheduleService) {}

  async onModuleInit() {
    this.logger.log(
      'ScheduleCronService initialized. Running initial HIS schedule sync for today...',
    );
    try {
      await this.scheduleService.syncDailySchedules();
    } catch (error) {
      this.logger.error('Failed to execute startup HIS schedule sync', error);
    }
  }

  // Run every day at 06:00 AM WITA (Asia/Makassar)
  @Cron('0 6 * * *', { timeZone: 'Asia/Makassar' })
  async handleDailySync() {
    this.logger.log(
      'Executing daily Cron Job: HIS Schedule Sync (06:00 AM WITA)',
    );
    try {
      await this.scheduleService.syncDailySchedules();
    } catch (error) {
      this.logger.error('Failed to execute daily HIS sync', error);
    }
  }
}
