import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    try {
      await this.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await this.$queryRawUnsafe(`PRAGMA busy_timeout = 10000;`);
      await this.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    } catch (e) {}
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
