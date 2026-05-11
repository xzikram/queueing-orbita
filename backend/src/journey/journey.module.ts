import { Module } from '@nestjs/common';
import { JourneyService } from './journey.service';

@Module({
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
