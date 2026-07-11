// src/common/interceptors/logging.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface HttpRequestLike {
  method: string;
  originalUrl?: string;
  url: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class LoggingInterceptor
  implements NestInterceptor
{
  private readonly logger =
    new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context
        .switchToHttp()
        .getRequest<HttpRequestLike>();

    const method = request.method;
    const url =
      request.originalUrl ||
      request.url;
    const userAgent =
      request.headers?.['user-agent'] ||
      'unknown';
    const ip =
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown';
    const startedAt = Date.now();

    this.logger.log(
      `${method} ${url} - ${ip} - ${userAgent}`,
    );

    if (
      process.env.NODE_ENV ===
        'development' &&
      ['POST', 'PUT', 'PATCH'].includes(
        method,
      )
    ) {
      this.logger.debug(
        `Body: ${this.safeStringify(
          this.sanitizeBody(
            request.body,
          ),
          1000,
        )}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration =
            Date.now() - startedAt;

          this.logger.log(
            `${method} ${url} - ${duration}ms`,
          );

          if (
            process.env.NODE_ENV ===
            'development'
          ) {
            this.logger.debug(
              `Response: ${this.safeStringify(
                data,
                1000,
              )}`,
            );
          }
        },
        error: (error: unknown) => {
          const duration =
            Date.now() - startedAt;

          this.logger.error(
            `${method} ${url} - ${duration}ms - ${
              error instanceof Error
                ? error.message
                : 'Unknown error'
            }`,
          );
        },
      }),
    );
  }

  private sanitizeBody(
    body?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
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

    return Object.fromEntries(
      Object.entries(body).filter(
        ([key]) =>
          !sensitiveKeys.has(key),
      ),
    );
  }

  private safeStringify(
    value: unknown,
    maxLength: number,
  ): string {
    try {
      const serialized =
        JSON.stringify(value);

      if (!serialized) {
        return String(value);
      }

      return serialized.length >
        maxLength
        ? `${serialized.slice(
            0,
            maxLength,
          )}…`
        : serialized;
    } catch {
      return '[Unserializable value]';
    }
  }
}