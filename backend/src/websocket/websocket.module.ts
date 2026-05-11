import { Module } from '@nestjs/common';
import { DisplayGateway } from './display.gateway';

@Module({
  providers: [DisplayGateway],
  exports: [DisplayGateway],
})
export class WebsocketModule {}
