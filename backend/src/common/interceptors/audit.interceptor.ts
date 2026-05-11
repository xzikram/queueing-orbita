import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const { method, url, body, user } = req;

    // We only audit mutations (POST, PUT, PATCH, DELETE)
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async (resBody) => {
          try {
            await this.prisma.auditLog.create({
              data: {
                userId: user?.userId || 'SYSTEM',
                action: method,
                entity: this.extractEntityFromUrl(url),
                oldValue: null, // Hard to capture old value without complex pre-hooks in simple interceptor
                newValue: JSON.stringify(body || {}),
                reason: body?.reason || 'Automated via API',
              },
            });
          } catch (err) {
            this.logger.error('Failed to log audit trail', err);
          }
        },
        error: (err) => {
          this.logger.warn(`Mutation failed for ${method} ${url}: ${err.message}`);
        },
      }),
    );
  }

  private extractEntityFromUrl(url: string): string {
    // Basic extraction e.g., /api/users/123 -> users
    const parts = url.split('/').filter(Boolean);
    if (parts.length > 0) {
      return parts[0] === 'api' && parts.length > 1 ? parts[1] : parts[0];
    }
    return 'UNKNOWN';
  }
}
