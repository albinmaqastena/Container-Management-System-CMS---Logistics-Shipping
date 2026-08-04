// src/common/guards/jwt-auth.guard.ts

import {
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser | false | null,
    info: unknown,
  ): TUser {
    if (error instanceof HttpException) {
      throw error;
    }

    if (error instanceof Error) {
      this.logger.error(`JWT authentication error: ${error.message}`, error.stack);

      throw new UnauthorizedException('Authentication failed');
    }

    if (!user) {
      if (info instanceof Error) {
        this.logger.warn(`JWT rejected: ${info.name}: ${info.message}`);
      }

      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}
