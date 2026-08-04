// src/modules/audits/audit.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { AUDIT_ACTION_KEY, SKIP_AUDIT_KEY } from './decorators/audit.decorator';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

interface AuditRequest {
  method: string;
  originalUrl?: string;
  url: string;
  body?: unknown;
  user?: {
    id?: string;
  };
  params?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface AuditResponse {
  statusCode?: number;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private readonly isTest: boolean;

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.isTest = this.configService.get<string>('NODE_ENV') === 'test';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAudit || this.isTest) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const response = context.switchToHttp().getResponse<AuditResponse>();

    const rawUrl = request.originalUrl || request.url;
    const normalizedPath = this.normalizePath(rawUrl);
    const method = request.method?.toUpperCase() || 'UNKNOWN';

    const explicitAction = this.reflector.getAllAndOverride<AuditAction>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Use explicit @Audit() decorator when possible; detectAction is fallback for endpoints without decorator.
    const action = explicitAction ?? this.detectAction(method, normalizedPath);

    if (action === AuditAction.UNKNOWN) {
      return next.handle();
    }

    const userId = request.user?.id;
    const url = rawUrl;
    const ip = request.ip || request.socket?.remoteAddress;
    const userAgent = this.normalizeHeader(request.headers?.['user-agent']);
    const startedAt = Date.now();

    // Pass raw body to service for sanitization (service handles circular refs, redaction, size limits)
    const requestBody =
      request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : undefined;

    // Only include request body in changes if it exists
    const changes = requestBody ? { request: requestBody } : undefined;

    let auditWritten = false;

    return next.handle().pipe(
      tap((data: unknown) => {
        if (auditWritten) {
          return;
        }
        auditWritten = true;

        void this.auditService
          .log(
            action,
            userId,
            this.extractTargetId(data, request.params),
            this.getTargetType(normalizedPath),
            changes,
            {
              ip,
              userAgent,
              method,
              url,
              statusCode: response.statusCode ?? 200,
              duration: Date.now() - startedAt,
            },
            AuditStatus.SUCCESS,
          )
          .catch((error: unknown) => {
            this.logAuditFailure(error);
          });
      }),
      catchError((error: unknown) => {
        if (!auditWritten) {
          auditWritten = true;

          void this.auditService
            .log(
              action,
              userId,
              request.params?.id || request.params?.userId,
              this.getTargetType(normalizedPath),
              changes,
              {
                ip,
                userAgent,
                method,
                url,
                statusCode: this.getErrorStatusCode(error),
                duration: Date.now() - startedAt,
              },
              AuditStatus.FAILED,
              error instanceof Error ? error.message : 'Unknown error',
            )
            .catch((auditError: unknown) => {
              this.logAuditFailure(auditError);
            });
        }

        return throwError(() => error);
      }),
    );
  }

  private normalizePath(rawUrl: string): string {
    const normalized = rawUrl
      .split('?')[0]
      .replace(/\/{2,}/g, '/')
      .replace(/^\/api\/?/, '/')
      .replace(/^\/v\d+/, '')
      .replace(/\/+$/, '');

    return normalized || '/';
  }

  private normalizeHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value;
  }

  private getErrorStatusCode(error: unknown): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    if (!error || typeof error !== 'object') {
      return 500;
    }

    const value = error as { status?: unknown; statusCode?: unknown };

    if (typeof value.status === 'number' && value.status >= 100 && value.status <= 599) {
      return value.status;
    }

    if (
      typeof value.statusCode === 'number' &&
      value.statusCode >= 100 &&
      value.statusCode <= 599
    ) {
      return value.statusCode;
    }

    return 500;
  }

  private extractTargetId(
    data: unknown,
    params?: Record<string, string | undefined>,
  ): string | undefined {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;

      if (typeof record.id === 'string') {
        return record.id;
      }

      if (
        record.data &&
        typeof record.data === 'object' &&
        typeof (record.data as Record<string, unknown>).id === 'string'
      ) {
        return (record.data as { id: string }).id;
      }

      if (
        record.user &&
        typeof record.user === 'object' &&
        typeof (record.user as Record<string, unknown>).id === 'string'
      ) {
        return (record.user as { id: string }).id;
      }
    }

    return params?.id || params?.userId;
  }

  private detectAction(method: string, path: string): AuditAction {
    // Auth endpoints
    if (path === '/auth/login') {
      return AuditAction.LOGIN;
    }
    if (path === '/auth/logout') {
      return AuditAction.LOGOUT;
    }
    if (path === '/auth/logout-all') {
      return AuditAction.LOGOUT_ALL;
    }
    if (path === '/auth/register') {
      return AuditAction.REGISTER;
    }
    if (path === '/auth/change-password') {
      return AuditAction.PASSWORD_CHANGE;
    }
    if (path === '/auth/forgot-password') {
      return AuditAction.PASSWORD_RESET_REQUEST;
    }
    if (path === '/auth/reset-password') {
      return AuditAction.PASSWORD_RESET;
    }
    if (path.startsWith('/auth/sessions/') && method === 'DELETE') {
      return AuditAction.SESSION_REVOKE;
    }

    // User management
    if (path.startsWith('/auth/users/')) {
      if (path.endsWith('/restore')) {
        return AuditAction.USER_RESTORE;
      }
      if (path.endsWith('/permanent')) {
        return AuditAction.USER_PERMANENT_DELETE;
      }
      if (method === 'DELETE') {
        return AuditAction.USER_DELETE;
      }
      if (method === 'PUT' || method === 'PATCH') {
        return AuditAction.USER_UPDATE;
      }
    }

    // Containers
    if (path === '/containers' && method === 'POST') {
      return AuditAction.CONTAINER_CREATE;
    }
    if (path.startsWith('/containers/') && (method === 'PUT' || method === 'PATCH')) {
      if (path.endsWith('/status')) {
        return AuditAction.CONTAINER_STATUS_CHANGE;
      }
      if (path.endsWith('/restore')) {
        return AuditAction.CONTAINER_RESTORE;
      }
      return AuditAction.CONTAINER_UPDATE;
    }
    if (path.startsWith('/containers/') && method === 'DELETE') {
      return path.endsWith('/permanent')
        ? AuditAction.CONTAINER_PERMANENT_DELETE
        : AuditAction.CONTAINER_DELETE;
    }

    // Items
    if (path === '/items' && method === 'POST') {
      return AuditAction.ITEM_CREATE;
    }
    if (path.startsWith('/items/') && (method === 'PUT' || method === 'PATCH')) {
      return path.endsWith('/restore') ? AuditAction.ITEM_RESTORE : AuditAction.ITEM_UPDATE;
    }
    if (path.startsWith('/items/') && method === 'DELETE') {
      return path.endsWith('/permanent')
        ? AuditAction.ITEM_PERMANENT_DELETE
        : AuditAction.ITEM_DELETE;
    }

    // Files
    if (path.startsWith('/files/upload') && method === 'POST') {
      return AuditAction.FILE_UPLOAD;
    }
    if (path.startsWith('/files/') && method === 'DELETE') {
      return AuditAction.FILE_DELETE;
    }

    return AuditAction.UNKNOWN;
  }

  private getTargetType(path: string): string {
    if (path.startsWith('/auth/users')) {
      return 'User';
    }
    if (path.startsWith('/auth/sessions')) {
      return 'Session';
    }
    if (path.startsWith('/containers')) {
      return 'Container';
    }
    if (path.startsWith('/items')) {
      return 'Item';
    }
    if (path.startsWith('/files')) {
      return 'File';
    }
    if (path.startsWith('/auth')) {
      return 'Auth';
    }
    return 'Unknown';
  }

  private logAuditFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : this.safeErrorString(error);
    this.logger.warn(`Unable to save audit log: ${message}`);
  }

  private safeErrorString(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    try {
      return JSON.stringify(value);
    } catch {
      return 'Unknown error';
    }
  }
}
