import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:') || dbUrl.includes('.db') || dbUrl.includes('sqlite')) {
      try {
        await this.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
        await this.$executeRawUnsafe(`PRAGMA busy_timeout = 10000;`);
        await this.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      } catch (e) {
        // Silently ignore if PRAGMA is unsupported
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
