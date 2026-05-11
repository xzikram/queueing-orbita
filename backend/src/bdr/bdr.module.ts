import { Module } from '@nestjs/common';
import { BdrService } from './bdr.service';
import { BdrController } from './bdr.controller';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [JourneyModule, WebsocketModule],
  controllers: [BdrController],
  providers: [BdrService],
})
export class BdrModule {}
