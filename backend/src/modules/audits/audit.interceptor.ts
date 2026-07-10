// src/modules/audits/audit.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';
import { SKIP_AUDIT_KEY, AUDIT_ACTION_KEY } from './decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // ✅ Kontrollo nëse auditimi është i çaktivizuar për këtë endpoint
    const skipAudit = this.reflector.get<boolean>(SKIP_AUDIT_KEY, context.getHandler());
    if (skipAudit) {
      return next.handle();
    }

    if (process.env.NODE_ENV === 'test') {
        return next.handle();
    }

    // ✅ Merr veprimin nga decoratori ose përcakto automatikisht
    let action = this.reflector.get<AuditAction>(AUDIT_ACTION_KEY, context.getHandler());
    if (!action) {
      action = this.detectAction(request.method, request.url);
    }

    const userId = request.user?.id;
    const method = request.method;
    const url = request.url;
    const ip = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const startTime = Date.now();

    // ✅ Ruaj të dhënat e kërkesës për auditim
    let requestBody = {};
    try {
      if (request.body && Object.keys(request.body).length > 0) {
        // ✅ Mos ruaj password-et në audit log
        const { password, currentPassword, newPassword, ...safeBody } = request.body;
        requestBody = safeBody;
      }
    } catch {
      // Nëse nuk mund të lexohet body, vazhdo
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 200;

          // ✅ Përcakto targetId dhe targetType nga përgjigja
          let targetId: string | undefined;
          let targetType: string | undefined;

          if (data && data.id) {
            targetId = data.id;
            targetType = this.getTargetType(url);
          }

          // ✅ Ruaj audit log në background (jo-blocking) me error handling
          this.auditService
            .log(
              action,
              userId,
              targetId,
              targetType,
              Object.keys(requestBody).length > 0 ? requestBody : undefined,
              {
                ip,
                userAgent,
                method,
                url,
                statusCode,
                duration,
              },
              AuditStatus.SUCCESS,
            )
            .catch((err) => {
              // ✅ Nëse është gabim i lidhjes me databazën (Connection terminated),
              // thjesht logojmë pa e hedhur më tej
              if (err.message?.includes('Connection terminated')) {
                console.debug('Audit log skipped: Database connection closed');
                return;
              }
              console.error('Error saving audit log:', err);
            });
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // ✅ Ruaj audit log edhe për gabime
        this.auditService
          .log(
            action,
            userId,
            undefined,
            this.getTargetType(url),
            Object.keys(requestBody).length > 0 ? requestBody : undefined,
            {
              ip,
              userAgent,
              method,
              url,
              statusCode,
              duration,
            },
            AuditStatus.FAILED,
            error.message,
          )
          .catch((err) => {
            // ✅ Nëse është gabim i lidhjes me databazën (Connection terminated),
            // thjesht logojmë pa e hedhur më tej
            if (err.message?.includes('Connection terminated')) {
              console.debug('Audit log (error) skipped: Database connection closed');
              return;
            }
            console.error('Error saving audit log:', err);
          });

        throw error;
      }),
    );
  }

  private detectAction(method: string, url: string): AuditAction {
    const path = url.split('?')[0];

    if (path === '/auth/login') return AuditAction.LOGIN;
    if (path === '/auth/logout') return AuditAction.LOGOUT;
    if (path === '/auth/register') return AuditAction.REGISTER;
    if (path === '/auth/change-password') return AuditAction.PASSWORD_CHANGE;
    if (path === '/auth/reset-password') return AuditAction.PASSWORD_RESET;

    if (path.startsWith('/auth/users/')) {
      if (path.endsWith('/restore')) return AuditAction.USER_RESTORE;
      if (path.endsWith('/permanent')) return AuditAction.USER_PERMANENT_DELETE;
      return AuditAction.USER_DELETE;
    }

    if (path === '/containers' && method === 'POST') return AuditAction.CONTAINER_CREATE;
    if (path.startsWith('/containers/') && method === 'PUT') {
      if (path.includes('/status')) return AuditAction.CONTAINER_STATUS_CHANGE;
      if (path.includes('/restore')) return AuditAction.CONTAINER_RESTORE;
      return AuditAction.CONTAINER_UPDATE;
    }
    if (path.startsWith('/containers/') && method === 'DELETE') {
      if (path.includes('/permanent')) return AuditAction.CONTAINER_PERMANENT_DELETE;
      return AuditAction.CONTAINER_DELETE;
    }

    if (path === '/items' && method === 'POST') return AuditAction.ITEM_CREATE;
    if (path.startsWith('/items/') && method === 'PUT') {
      if (path.includes('/restore')) return AuditAction.ITEM_RESTORE;
      return AuditAction.ITEM_UPDATE;
    }
    if (path.startsWith('/items/') && method === 'DELETE') {
      if (path.includes('/permanent')) return AuditAction.ITEM_PERMANENT_DELETE;
      return AuditAction.ITEM_DELETE;
    }

    // Default
    return AuditAction.LOGIN;
  }

  private getTargetType(url: string): string {
    if (url.startsWith('/auth/users')) return 'User';
    if (url.startsWith('/containers')) return 'Container';
    if (url.startsWith('/items')) return 'Item';
    if (url.startsWith('/auth')) return 'Auth';
    return 'Unknown';
  }
}