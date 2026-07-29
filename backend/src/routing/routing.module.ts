import { Module, Global } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JourneyModule } from '../journey/journey.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Global()
@Module({
  imports: [PrismaModule, JourneyModule, WebsocketModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
