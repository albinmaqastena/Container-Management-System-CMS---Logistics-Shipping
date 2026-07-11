// src/modules/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { Repository } from 'typeorm';

import { User, UserRole } from '../entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
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

  async validate(payload: JwtPayload): Promise<User> {
    if (!payload?.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', {
        id: payload.sub,
      })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    if (user.isLocked()) {
      throw new UnauthorizedException('User account is temporarily locked');
    }

    return user;
  }
}
