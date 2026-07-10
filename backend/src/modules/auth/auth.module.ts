// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
    ]),
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ) => ({
        secret:
          configService.getOrThrow<string>(
            'auth.jwt.secret',
          ),
        signOptions: {
          expiresIn:
            configService.getOrThrow<StringValue>(
              'auth.jwt.accessTokenExpiresIn',
            ),
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    JwtModule,
  ],
})
export class AuthModule {}
