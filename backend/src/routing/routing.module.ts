import { Module, Global } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JourneyModule } from '../journey/journey.module';

@Global()
@Module({
  imports: [PrismaModule, JourneyModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
