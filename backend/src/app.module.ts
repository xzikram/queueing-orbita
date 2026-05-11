import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MasterModule } from './master/master.module';
import { ScheduleModule } from './schedule/schedule.module';
import { QueueModule } from './queue/queue.module';
import { JourneyModule } from './journey/journey.module';
import { AdmissionModule } from './admission/admission.module';
import { AssessmentModule } from './assessment/assessment.module';
import { BdrModule } from './bdr/bdr.module';
import { DoctorQueueModule } from './doctor-queue/doctor-queue.module';
import { CdcModule } from './cdc/cdc.module';
import { CashierModule } from './cashier/cashier.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { OpticModule } from './optic/optic.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    PrismaModule,
    AuthModule,
    MasterModule,
    ScheduleModule,
    QueueModule,
    JourneyModule,
    AdmissionModule,
    AssessmentModule,
    BdrModule,
    DoctorQueueModule,
    CdcModule,
    CashierModule,
    PharmacyModule,
    OpticModule,
    WebsocketModule,
    ReportsModule,
    AuditModule,
    VideoModule,
  ],
  providers: [
    {
      provide: 'APP_INTERCEPTOR',
      useClass: require('./common/interceptors/audit.interceptor').AuditInterceptor,
    },
  ],
})
export class AppModule {}
