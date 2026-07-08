const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { ScheduleService } = require('./dist/src/schedule/schedule.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scheduleService = app.get(ScheduleService);

  const dateStr = '2026-06-25';
  console.log(`Running sync for date: ${dateStr}...`);
  const result = await scheduleService.syncDailySchedules(dateStr);
  console.log('Sync Result:', result);

  await app.close();
}

main().catch(console.error);
