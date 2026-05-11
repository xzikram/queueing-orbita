import { Module } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { PharmacyController } from './pharmacy.controller';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [JourneyModule, WebsocketModule],
  controllers: [PharmacyController],
  providers: [PharmacyService],
})
export class PharmacyModule {}
