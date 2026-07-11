// src/common/middleware/logger.middleware.ts

import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      const userAgent = request.get('user-agent') || 'unknown';

      const contentLength = response.getHeader('content-length') || 0;

      const ip = request.ip || request.socket.remoteAddress || 'unknown';

      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${contentLength}B ${durationMs.toFixed(
          2,
        )}ms - ${ip} - ${userAgent}`,
      );
    });

    next();
  }
}
