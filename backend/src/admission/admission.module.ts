import { Module } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { AdmissionController } from './admission.controller';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [JourneyModule, WebsocketModule],
  controllers: [AdmissionController],
  providers: [AdmissionService],
  exports: [AdmissionService],
})
export class AdmissionModule {}
