import { Module } from '@nestjs/common';
import { DisplayGateway } from './display.gateway';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  providers: [DisplayGateway],
  exports: [DisplayGateway],
})
export class WebsocketModule {}
