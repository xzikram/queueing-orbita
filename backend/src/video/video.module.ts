import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { PrismaModule } from '../prisma/prisma.module';

import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, WebsocketModule],
  providers: [VideoService],
  controllers: [VideoController],
})
export class VideoModule {}
