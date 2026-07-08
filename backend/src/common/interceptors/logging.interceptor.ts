// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();

    // ✅ Log request
    this.logger.log(`📥 ${method} ${url} - ${ip} - ${userAgent}`);

    // ✅ Log body (vetëm në development, vetëm POST/PUT/PATCH)
    if (process.env.NODE_ENV !== 'production') {
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        this.logger.debug(`📦 Body: ${JSON.stringify(body)}`);
      }
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.logger.log(`📤 ${method} ${url} - ${duration}ms`);
          
          // ✅ Log response (vetëm në development)
          if (process.env.NODE_ENV !== 'production') {
            try {
              const safeData = JSON.parse(JSON.stringify(data));
              this.logger.debug(`📦 Response: ${JSON.stringify(safeData).substring(0, 500)}`);
            } catch {
              this.logger.debug('📦 Response: [Circular structure]');
            }
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`❌ ${method} ${url} - ${duration}ms - ${error.message}`);
        },
      }),
    );
  }
}