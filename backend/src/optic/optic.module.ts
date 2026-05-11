import { Module } from '@nestjs/common';
import { OpticService } from './optic.service';
import { OpticController } from './optic.controller';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [JourneyModule],
  controllers: [OpticController],
  providers: [OpticService],
})
export class OpticModule {}
