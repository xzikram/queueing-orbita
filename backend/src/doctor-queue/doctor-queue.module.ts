import { Module } from '@nestjs/common';
import { DoctorQueueService } from './doctor-queue.service';
import { DoctorQueueController } from './doctor-queue.controller';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [JourneyModule, WebsocketModule],
  controllers: [DoctorQueueController],
  providers: [DoctorQueueService],
})
export class DoctorQueueModule {}
