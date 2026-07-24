import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await this.$queryRawUnsafe(`PRAGMA busy_timeout = 10000;`);
      await this.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await this.$queryRawUnsafe(`PRAGMA cache_size = -64000;`);
    } catch (e: any) {
      this.logger.warn(`Failed to set SQLite PRAGMAs: ${e?.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
