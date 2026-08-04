// src/modules/auth/strategies/jwt.strategy.ts

import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import Redis from 'ioredis';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';
import { REDIS_CLIENT } from '../../../common/redis/redis.module';

interface JwtPayload {
  sub: string;
  sid: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwt.secret'),
      issuer: configService.getOrThrow<string>('auth.jwt.issuer'),
      audience: configService.getOrThrow<string>('auth.jwt.audience'),
      algorithms: ['HS256'],
    };

    super(options);
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const sessionKey = `session:${payload.sub}:${payload.sid}`;

    let sessionExists: number;

    try {
      sessionExists = await this.redis.exists(sessionKey);
    } catch {
      throw new ServiceUnavailableException('Authentication session service is unavailable');
    }

    if (!sessionExists) {
      throw new UnauthorizedException('Session has expired or was revoked');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', {
        id: payload.sub,
      })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || !user.isActive || user.isLocked()) {
      throw new UnauthorizedException('User account is unavailable');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      sid: payload.sid,
    };
  }
}