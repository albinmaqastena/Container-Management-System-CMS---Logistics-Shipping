// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';

    // ✅ Nëse është HttpException (e.g., NotFound, BadRequest)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      // Nëse është një objekt me message
      if (typeof exceptionResponse === 'object' && exceptionResponse.message) {
        message = Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join(', ')
          : exceptionResponse.message;
        code = exceptionResponse.error || 'HTTP_EXCEPTION';
      } else {
        message = exceptionResponse || exception.message;
        code = 'HTTP_EXCEPTION';
      }
    }

    // ✅ Loggo gabimin në server (me stack trace)
    const logMessage = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      status,
      message,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(JSON.stringify(logMessage, null, 2));
    } else {
      this.logger.warn(JSON.stringify(logMessage, null, 2));
    }

    // ✅ Response për klientin (PA stack trace!)
    const clientResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    };

    // ✅ Nëse është validation error, shto detajet
    if (exception instanceof HttpException && status === HttpStatus.BAD_REQUEST) {
      const exceptionResponse = exception.getResponse() as any;
      if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
        clientResponse.errors = exceptionResponse.message;
      }
    }

    response.status(status).json(clientResponse);
  }
}