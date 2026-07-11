// src/common/filters/http-exception.filter.ts

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { BaseException } from '../exceptions/base.exception';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  code: string;
  errors?: string[];
}

interface NormalizedException {
  statusCode: number;
  message: string;
  code: string;
  errors?: string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const normalized = this.normalizeException(exception);
    const timestamp = new Date().toISOString();
    const path = request.originalUrl || request.url;

    const logPayload = {
      timestamp,
      method: request.method,
      url: path,
      statusCode: normalized.statusCode,
      code: normalized.code,
      message: normalized.message,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (normalized.statusCode >= 500) {
      this.logger.error(JSON.stringify(logPayload));
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    const body: ErrorResponseBody = {
      statusCode: normalized.statusCode,
      timestamp,
      path,
      message: normalized.message,
      code: normalized.code,
    };

    if (normalized.errors?.length) {
      body.errors = normalized.errors;
    }

    response.status(normalized.statusCode).json(body);
  }

  private normalizeException(exception: unknown): NormalizedException {
    if (exception instanceof BaseException) {
      return {
        statusCode: exception.status,
        message: exception.message,
        code: exception.code,
        errors: this.getBaseExceptionErrors(exception),
      };
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  private normalizeHttpException(exception: HttpException): NormalizedException {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        statusCode,
        message: response,
        code: this.getStatusCodeName(statusCode),
      };
    }

    const payload = response as Record<string, unknown>;
    const rawMessage = payload.message;
    const errors = Array.isArray(rawMessage)
      ? rawMessage.map((item) => this.toSafeMessage(item))
      : undefined;

    return {
      statusCode,
      message: errors?.join(', ') || this.toSafeMessage(rawMessage, exception.message),
      code: this.getErrorCode(payload),
      errors,
    };
  }

  private getBaseExceptionErrors(exception: BaseException): string[] | undefined {
    if (!('errors' in exception)) {
      return undefined;
    }

    const errors = (
      exception as BaseException & {
        errors?: unknown;
      }
    ).errors;

    return Array.isArray(errors) ? errors.map((item) => this.toSafeMessage(item)) : undefined;
  }

  private getErrorCode(payload: Record<string, unknown>): string {
    if (typeof payload.code === 'string') {
      return payload.code;
    }

    if (typeof payload.error === 'string') {
      return payload.error.toUpperCase().replace(/\s+/g, '_');
    }

    return 'HTTP_EXCEPTION';
  }

  private getStatusCodeName(statusCode: number): string {
    const statusName = HttpStatus[statusCode];

    return typeof statusName === 'string' ? statusName : 'HTTP_EXCEPTION';
  }

  private toSafeMessage(value: unknown, fallback = 'Request failed'): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    if (value instanceof Error) {
      return value.message;
    }

    if (value === null || value === undefined) {
      return fallback;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
}
