// src/modules/audits/audit.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  Observable,
  catchError,
  tap,
  throwError,
} from 'rxjs';

import { AuditService } from './audit.service';
import {
  AuditAction,
  AuditStatus,
} from './entities/audit-log.entity';
import {
  AUDIT_ACTION_KEY,
  SKIP_AUDIT_KEY,
} from './decorators/audit.decorator';

@Injectable()
export class AuditInterceptor
  implements NestInterceptor
{
  private readonly logger =
    new Logger(
      AuditInterceptor.name,
    );

  constructor(
    private readonly auditService:
      AuditService,
    private readonly reflector:
      Reflector,
    private readonly configService:
      ConfigService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const skipAudit =
      this.reflector
        .getAllAndOverride<boolean>(
          SKIP_AUDIT_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    const isTest =
      this.configService.get<string>(
        'NODE_ENV',
      ) === 'test';

    if (skipAudit || isTest) {
      return next.handle();
    }

    const request =
      context.switchToHttp()
        .getRequest();

    const response =
      context.switchToHttp()
        .getResponse();

    const rawUrl =
      request.originalUrl ||
      request.url;

    const explicitAction =
      this.reflector
        .getAllAndOverride<AuditAction>(
          AUDIT_ACTION_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    const action =
      explicitAction ??
      this.detectAction(
        request.method,
        rawUrl,
      );

    /*
     * Read-only endpoints and unrelated routes must not fill
     * the audit table with UNKNOWN records.
     */
    if (
      action ===
      AuditAction.UNKNOWN
    ) {
      return next.handle();
    }

    const userId =
      request.user?.id;

    const method =
      request.method;

    const url = rawUrl;

    const ip =
      request.ip ||
      request.socket
        ?.remoteAddress;

    const userAgent =
      request.headers?.[
        'user-agent'
      ];

    const startedAt =
      Date.now();

    const requestBody =
      this.sanitizeValue(
        request.body,
      );

    return next.handle().pipe(
      tap((data) => {
        void this.auditService
          .log(
            action,
            userId,
            this.extractTargetId(
              data,
              request.params,
            ),
            this.getTargetType(
              url,
            ),
            requestBody,
            {
              ip,
              userAgent,
              method,
              url,
              statusCode:
                response.statusCode ??
                200,
              duration:
                Date.now() -
                startedAt,
            },
            AuditStatus.SUCCESS,
          )
          .catch(
            (
              error: unknown,
            ) =>
              this.logAuditFailure(
                error,
              ),
          );
      }),

      catchError(
        (error: unknown) => {
          const httpError =
            error as {
              status?: number;
              statusCode?: number;
              message?: string;
            };

          void this.auditService
            .log(
              action,
              userId,
              request.params?.id ||
                request.params
                  ?.userId,
              this.getTargetType(
                url,
              ),
              requestBody,
              {
                ip,
                userAgent,
                method,
                url,
                statusCode:
                  httpError.status ??
                  httpError.statusCode ??
                  500,
                duration:
                  Date.now() -
                  startedAt,
              },
              AuditStatus.FAILED,
              error instanceof Error
                ? error.message
                : 'Unknown error',
            )
            .catch(
              (
                auditError:
                  unknown,
              ) =>
                this.logAuditFailure(
                  auditError,
                ),
            );

          return throwError(
            () => error,
          );
        },
      ),
    );
  }

  private sanitizeValue(
    value: unknown,
  ):
    | Record<string, unknown>
    | undefined {
    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      return undefined;
    }

    const sanitized =
      this.sanitizeObject(
        value as Record<
          string,
          unknown
        >,
      );

    return Object.keys(
      sanitized,
    ).length
      ? sanitized
      : undefined;
  }

  private sanitizeObject(
    value: Record<
      string,
      unknown
    >,
  ): Record<string, unknown> {
    const sensitiveKeys =
      new Set([
        'password',
        'currentPassword',
        'newPassword',
        'refreshToken',
        'accessToken',
        'token',
        'resetPasswordToken',
      ]);

    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !sensitiveKeys.has(
              key,
            ),
        )
        .map(
          ([key, item]) => {
            if (
              Array.isArray(item)
            ) {
              return [
                key,
                item.map(
                  (entry) =>
                    entry &&
                    typeof entry ===
                      'object'
                      ? this.sanitizeObject(
                          entry as Record<
                            string,
                            unknown
                          >,
                        )
                      : entry,
                ),
              ];
            }

            if (
              item &&
              typeof item ===
                'object'
            ) {
              return [
                key,
                this.sanitizeObject(
                  item as Record<
                    string,
                    unknown
                  >,
                ),
              ];
            }

            return [
              key,
              item,
            ];
          },
        ),
    );
  }

  private extractTargetId(
    data: unknown,
    params?: Record<
      string,
      string
    >,
  ): string | undefined {
    if (
      data &&
      typeof data ===
        'object' &&
      'id' in data &&
      typeof (
        data as {
          id?: unknown;
        }
      ).id === 'string'
    ) {
      return (
        data as {
          id: string;
        }
      ).id;
    }

    return (
      params?.id ||
      params?.userId
    );
  }

  private detectAction(
    method: string,
    rawUrl: string,
  ): AuditAction {
    const path = rawUrl
      .split('?')[0]
      .replace(
        /^\/v\d+/,
        '',
      );

    if (
      path ===
      '/auth/login'
    ) {
      return AuditAction.LOGIN;
    }

    if (
      path ===
      '/auth/logout'
    ) {
      return AuditAction.LOGOUT;
    }

    if (
      path ===
      '/auth/register'
    ) {
      return AuditAction.REGISTER;
    }

    if (
      path ===
      '/auth/change-password'
    ) {
      return AuditAction.PASSWORD_CHANGE;
    }

    if (
      path ===
      '/auth/reset-password'
    ) {
      return AuditAction.PASSWORD_RESET;
    }

    if (
      path.startsWith(
        '/auth/users/',
      )
    ) {
      if (
        path.endsWith(
          '/restore',
        )
      ) {
        return AuditAction.USER_RESTORE;
      }

      if (
        path.endsWith(
          '/permanent',
        )
      ) {
        return AuditAction.USER_PERMANENT_DELETE;
      }

      if (
        method === 'DELETE'
      ) {
        return AuditAction.USER_DELETE;
      }

      if (
        method === 'PUT' ||
        method === 'PATCH'
      ) {
        return AuditAction.USER_UPDATE;
      }
    }

    if (
      path ===
        '/containers' &&
      method === 'POST'
    ) {
      return AuditAction.CONTAINER_CREATE;
    }

    if (
      path.startsWith(
        '/containers/',
      ) &&
      (
        method === 'PUT' ||
        method === 'PATCH'
      )
    ) {
      if (
        path.endsWith(
          '/status',
        )
      ) {
        return AuditAction.CONTAINER_STATUS_CHANGE;
      }

      if (
        path.endsWith(
          '/restore',
        )
      ) {
        return AuditAction.CONTAINER_RESTORE;
      }

      return AuditAction.CONTAINER_UPDATE;
    }

    if (
      path.startsWith(
        '/containers/',
      ) &&
      method === 'DELETE'
    ) {
      return path.endsWith(
        '/permanent',
      )
        ? AuditAction.CONTAINER_PERMANENT_DELETE
        : AuditAction.CONTAINER_DELETE;
    }

    if (
      path === '/items' &&
      method === 'POST'
    ) {
      return AuditAction.ITEM_CREATE;
    }

    if (
      path.startsWith(
        '/items/',
      ) &&
      (
        method === 'PUT' ||
        method === 'PATCH'
      )
    ) {
      return path.endsWith(
        '/restore',
      )
        ? AuditAction.ITEM_RESTORE
        : AuditAction.ITEM_UPDATE;
    }

    if (
      path.startsWith(
        '/items/',
      ) &&
      method === 'DELETE'
    ) {
      return path.endsWith(
        '/permanent',
      )
        ? AuditAction.ITEM_PERMANENT_DELETE
        : AuditAction.ITEM_DELETE;
    }

    if (
      path.startsWith(
        '/files/upload',
      ) &&
      method === 'POST'
    ) {
      return AuditAction.FILE_UPLOAD;
    }

    if (
      path.startsWith(
        '/files/',
      ) &&
      method === 'DELETE'
    ) {
      return AuditAction.FILE_DELETE;
    }

    return AuditAction.UNKNOWN;
  }

  private getTargetType(
    rawUrl: string,
  ): string {
    const path = rawUrl
      .split('?')[0]
      .replace(
        /^\/v\d+/,
        '',
      );

    if (
      path.startsWith(
        '/auth/users',
      )
    ) {
      return 'User';
    }

    if (
      path.startsWith(
        '/containers',
      )
    ) {
      return 'Container';
    }

    if (
      path.startsWith(
        '/items',
      )
    ) {
      return 'Item';
    }

    if (
      path.startsWith(
        '/files',
      )
    ) {
      return 'File';
    }

    if (
      path.startsWith(
        '/auth',
      )
    ) {
      return 'Auth';
    }

    return 'Unknown';
  }

  private logAuditFailure(
    error: unknown,
  ): void {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    this.logger.warn(
      `Unable to save audit log: ${message}`,
    );
  }
}