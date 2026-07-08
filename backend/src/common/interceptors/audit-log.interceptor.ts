// src/common/interceptors/audit-log.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip } = request;
    
    // ✅ Regjistro veprimet e administratorëve
    if (user && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      this.logger.log({
        action: `${method} ${url}`,
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: ip,
        timestamp: new Date().toISOString(),
        data: body,
      });
    }

    return next.handle().pipe(
      tap({
        error: (error) => {
          this.logger.error({
            action: `${method} ${url}`,
            userId: user?.id,
            email: user?.email,
            error: error.message,
            status: error.status,
            timestamp: new Date().toISOString(),
          });
        },
      })
    );
  }
}