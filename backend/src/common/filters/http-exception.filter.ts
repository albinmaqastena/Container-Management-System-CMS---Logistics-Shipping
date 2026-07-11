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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();

    const response = context.getResponse<Response>();

    const request = context.getRequest<Request>();

    const normalized = this.normalizeException(exception);

    const timestamp = new Date().toISOString();

    const logPayload = {
      timestamp,
      method: request.method,
      url: request.originalUrl || request.url,
      statusCode: normalized.statusCode,
      code: normalized.code,
      message: normalized.message,
      ip: request.ip || request.socket?.remoteAddress,
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
      path: request.originalUrl || request.url,
      message: normalized.message,
      code: normalized.code,
    };

    if (normalized.errors?.length) {
      body.errors = normalized.errors;
    }

    response.status(normalized.statusCode).json(body);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    message: string;
    code: string;
    errors?: string[];
  } {
    if (exception instanceof BaseException) {
      return {
        statusCode: exception.status,
        message: exception.message,
        code: exception.code,
        errors:
          'errors' in exception && Array.isArray(exception.errors) ? exception.errors : undefined,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode,
          message: response,
          code: HttpStatus[statusCode] || 'HTTP_EXCEPTION',
        };
      }

      const payload = response as Record<string, unknown>;

      const rawMessage = payload.message;

      const errors = Array.isArray(rawMessage) ? rawMessage.map(String) : undefined;

      return {
        statusCode,
        message: errors ? errors.join(', ') : String(rawMessage || exception.message),
        code:
          typeof payload.code === 'string'
            ? payload.code
            : typeof payload.error === 'string'
              ? payload.error.toUpperCase().replace(/\s+/g, '_')
              : 'HTTP_EXCEPTION',
        errors,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }
}
