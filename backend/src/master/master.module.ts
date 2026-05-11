import { Module } from '@nestjs/common';
import { MasterService } from './master.service';
import { MasterController } from './master.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { DoctorImportService } from './doctor-import.service';

@Module({
  imports: [WebsocketModule],
  controllers: [MasterController, UsersController],
  providers: [MasterService, UsersService, DoctorImportService],
  exports: [MasterService, UsersService],
})
export class MasterModule {}
