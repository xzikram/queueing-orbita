import { Module } from '@nestjs/common';
import { CdcService } from './cdc.service';
import { CdcController } from './cdc.controller';
import { JourneyModule } from '../journey/journey.module';

@Module({
  imports: [JourneyModule],
  controllers: [CdcController],
  providers: [CdcService],
})
export class CdcModule {}
