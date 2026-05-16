import { Module } from '@nestjs/common';
import { CdcService } from './cdc.service';
import { CdcController } from './cdc.controller';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [JourneyModule, WebsocketModule],
  controllers: [CdcController],
  providers: [CdcService],
})
export class CdcModule {}
