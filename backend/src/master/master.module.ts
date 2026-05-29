import { Module } from '@nestjs/common';
import { MasterService } from './master.service';
import { MasterController } from './master.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccessGroupService } from './access-group.service';
import { AccessGroupController } from './access-group.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { DoctorImportService } from './doctor-import.service';

@Module({
  imports: [WebsocketModule],
  controllers: [MasterController, UsersController, AccessGroupController],
  providers: [MasterService, UsersService, AccessGroupService, DoctorImportService],
  exports: [MasterService, UsersService, AccessGroupService],
})
export class MasterModule {}

