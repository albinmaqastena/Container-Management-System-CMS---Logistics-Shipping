// src/common/guards/jwt-auth.guard.ts

import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(error: unknown, user: TUser | false | null, info: unknown): TUser {
    if (error) {
      throw error;
    }

    if (!user) {
      const message =
        info instanceof Error && info.message ? info.message : 'Invalid or expired token';

      throw new UnauthorizedException(message);
    }

    return user;
  }
}
