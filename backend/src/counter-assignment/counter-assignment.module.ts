import { Module } from '@nestjs/common';
import { CounterAssignmentService } from './counter-assignment.service';
import { CounterAssignmentController } from './counter-assignment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, WebsocketModule],
  controllers: [CounterAssignmentController],
  providers: [CounterAssignmentService],
  exports: [CounterAssignmentService],
})
export class CounterAssignmentModule {}
