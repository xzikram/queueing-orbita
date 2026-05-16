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
            // Extract contextual info
            let ticketNo = resBody?.ticketNo || resBody?.queueTicket?.ticketNo || body?.ticketNo;
            let patientName = resBody?.patientName || resBody?.visit?.patientName || body?.patientName;
            const entity = this.extractEntityFromUrl(url);
            
            // Build human description
            let humanDesc = `Melakukan aksi ${method} pada ${entity}`;
            let unitType = null;

            if (url.includes('/call')) {
              humanDesc = `Memanggil pasien ke counter`;
              unitType = entity.toUpperCase();
            } else if (url.includes('/start')) {
              humanDesc = `Mulai melayani pasien`;
              unitType = entity.toUpperCase();
            } else if (url.includes('/finish')) {
              humanDesc = `Selesai melayani pasien`;
              unitType = entity.toUpperCase();
            } else if (url.includes('/queue-tickets') && method === 'POST') {
              humanDesc = `Mengambil tiket antrian baru`;
            } else if (url.includes('/transfer')) {
              humanDesc = `Mentransfer pasien ke unit lain`;
              unitType = entity.toUpperCase();
            } else if (url.includes('/login')) {
              humanDesc = `Login ke sistem`;
            }

            if (ticketNo) humanDesc += ` (Tiket: ${ticketNo})`;

            await this.prisma.auditLog.create({
              data: {
                userId: user?.userId || 'SYSTEM',
                userName: user?.name || 'System',
                action: method,
                entity,
                humanDescription: humanDesc,
                ticketNo,
                patientName,
                unitType,
                oldValue: null,
                newValue: JSON.stringify(body || {}),
                reason: body?.reason || null,
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
    const parts = url.split('/').filter(Boolean);
    if (parts.length > 0) {
      return parts[0] === 'api' && parts.length > 1 ? parts[1] : parts[0];
    }
    return 'UNKNOWN';
  }
}
