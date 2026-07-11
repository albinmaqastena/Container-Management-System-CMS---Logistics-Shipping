// src/modules/audits/audit.interceptor.ts

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
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

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isTest = this.configService.get<string>('NODE_ENV') === 'test';

    if (skipAudit || isTest) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const response = context.switchToHttp().getResponse<AuditResponse>();

    const rawUrl = request.originalUrl || request.url;

    const explicitAction = this.reflector.getAllAndOverride<AuditAction>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const action = explicitAction ?? this.detectAction(request.method, rawUrl);

    if (action === AuditAction.UNKNOWN) {
      return next.handle();
    }

    const userId = request.user?.id;
    const method = request.method;
    const url = rawUrl;
    const ip = request.ip || request.socket?.remoteAddress;
    const userAgent = this.normalizeHeader(request.headers?.['user-agent']);
    const startedAt = Date.now();
    const requestBody = this.sanitizeValue(request.body);

    return next.handle().pipe(
      tap((data: unknown) => {
        void this.auditService
          .log(
            action,
            userId,
            this.extractTargetId(data, request.params),
            this.getTargetType(url),
            requestBody,
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
        void this.auditService
          .log(
            action,
            userId,
            request.params?.id || request.params?.userId,
            this.getTargetType(url),
            requestBody,
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

        return throwError(() => error);
      }),
    );
  }

  private normalizeHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value;
  }

  private getErrorStatusCode(error: unknown): number {
    if (!error || typeof error !== 'object') {
      return 500;
    }

    const value = error as {
      status?: unknown;
      statusCode?: unknown;
    };

    if (typeof value.status === 'number') {
      return value.status;
    }

    if (typeof value.statusCode === 'number') {
      return value.statusCode;
    }

    return 500;
  }

  private sanitizeValue(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const sanitized = this.sanitizeObject(value as Record<string, unknown>);

    return Object.keys(sanitized).length ? sanitized : undefined;
  }

  private sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      'password',
      'currentPassword',
      'newPassword',
      'refreshToken',
      'accessToken',
      'token',
      'resetPasswordToken',
    ]);

    const entries: Array<[string, unknown]> = [];

    for (const [key, item] of Object.entries(value)) {
      if (sensitiveKeys.has(key)) {
        continue;
      }

      entries.push([key, this.sanitizeNestedValue(item)]);
    }

    return Object.fromEntries(entries);
  }

  private sanitizeNestedValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeNestedValue(item));
    }

    if (value && typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return value;
  }

  private extractTargetId(
    data: unknown,
    params?: Record<string, string | undefined>,
  ): string | undefined {
    if (data && typeof data === 'object' && 'id' in data) {
      const id = (data as { id?: unknown }).id;

      if (typeof id === 'string') {
        return id;
      }
    }

    return params?.id || params?.userId;
  }

  private detectAction(method: string, rawUrl: string): AuditAction {
    const path = rawUrl.split('?')[0].replace(/^\/v\d+/, '');

    if (path === '/auth/login') {
      return AuditAction.LOGIN;
    }

    if (path === '/auth/logout') {
      return AuditAction.LOGOUT;
    }

    if (path === '/auth/register') {
      return AuditAction.REGISTER;
    }

    if (path === '/auth/change-password') {
      return AuditAction.PASSWORD_CHANGE;
    }

    if (path === '/auth/reset-password') {
      return AuditAction.PASSWORD_RESET;
    }

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

    if (path.startsWith('/files/upload') && method === 'POST') {
      return AuditAction.FILE_UPLOAD;
    }

    if (path.startsWith('/files/') && method === 'DELETE') {
      return AuditAction.FILE_DELETE;
    }

    return AuditAction.UNKNOWN;
  }

  private getTargetType(rawUrl: string): string {
    const path = rawUrl.split('?')[0].replace(/^\/v\d+/, '');

    if (path.startsWith('/auth/users')) {
      return 'User';
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
