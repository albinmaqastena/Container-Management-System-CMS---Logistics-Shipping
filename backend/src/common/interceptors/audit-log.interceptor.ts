// src/common/interceptors/audit-log.interceptor.ts

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface AuditRequest {
  method: string;
  originalUrl?: string;
  url: string;
  body?: Record<string, unknown>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();

    const method = request.method;
    const url = request.originalUrl || request.url;

    const user = request.user;
    const startedAt = Date.now();

    const shouldLog = Boolean(user) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (shouldLog) {
      this.logger.log(
        JSON.stringify({
          action: `${method} ${url}`,
          userId: user?.id,
          email: user?.email,
          role: user?.role,
          ip: request.ip || request.socket?.remoteAddress,
          timestamp: new Date().toISOString(),
          data: this.sanitizeBody(request.body),
        }),
      );
    }

    return next.handle().pipe(
      tap({
        next: () => {
          if (!shouldLog) {
            return;
          }

          this.logger.debug(
            JSON.stringify({
              action: `${method} ${url}`,
              userId: user?.id,
              status: 'success',
              duration: Date.now() - startedAt,
            }),
          );
        },
        error: (error: unknown) => {
          this.logger.error(
            JSON.stringify({
              action: `${method} ${url}`,
              userId: user?.id,
              email: user?.email,
              status: 'failed',
              duration: Date.now() - startedAt,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        },
      }),
    );
  }

  private sanitizeBody(body?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!body) {
      return undefined;
    }

    const sensitiveKeys = new Set([
      'password',
      'currentPassword',
      'newPassword',
      'refreshToken',
      'accessToken',
      'token',
      'resetPasswordToken',
    ]);

    return Object.fromEntries(Object.entries(body).filter(([key]) => !sensitiveKeys.has(key)));
  }
}
