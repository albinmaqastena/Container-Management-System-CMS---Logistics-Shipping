// src/app.module.ts

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import * as Joi from 'joi';
import * as redisStore from 'cache-manager-redis-store';

import { AuthModule } from './modules/auth/auth.module';
import { ContainersModule } from './modules/containers/containers.module';
import { ItemsModule } from './modules/items/items.module';
import { FilesModule } from './modules/files/files.module';
import { AuditModule } from './modules/audits/audit.module';
import { RedisModule } from './common/redis/redis.module';

import { User } from './modules/auth/entities/user.entity';
import { Container } from './modules/containers/entities/container.entity';
import { Item } from './modules/items/entities/item.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { AuditLog } from './modules/audits/entities/audit-log.entity';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthController } from './health/health.controller';

import authConfig from './config/auth.config';
import fileConfig from './config/file.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [authConfig, fileConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

        PORT: Joi.number().integer().min(1).max(65535).default(3000),

        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
        DB_USERNAME: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default('password'),
        DB_DATABASE: Joi.string().default('container_db'),
        DB_MAX_CONNECTIONS: Joi.number().integer().min(1).default(20),

        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        JWT_ISSUER: Joi.string().default('container-management-system'),
        JWT_AUDIENCE: Joi.string().default('container-management-users'),

        AUTH_LOGIN_ATTEMPTS: Joi.number().integer().min(1).default(5),
        AUTH_BLOCK_DURATION_MS: Joi.number()
          .integer()
          .min(1000)
          .default(15 * 60 * 1000),

        ENCRYPTION_KEY: Joi.string().min(32).required(),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_DB: Joi.number().integer().min(0).default(0),
        REDIS_TTL: Joi.number().integer().min(1).default(3600),
        REDIS_MAX_CONNECTIONS: Joi.number().integer().min(1).default(10),

        FILE_MAX_SIZE_BYTES: Joi.number()
          .integer()
          .min(1)
          .default(5 * 1024 * 1024),
        FILE_UPLOAD_DESTINATION: Joi.string().default('./uploads'),
        FILE_URL_PREFIX: Joi.string().default('/uploads'),

        IMAGE_OPTIMIZATION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
        IMAGE_MAX_WIDTH: Joi.number().integer().min(1).default(1200),
        IMAGE_MAX_HEIGHT: Joi.number().integer().min(1).default(1200),
        IMAGE_QUALITY: Joi.number().integer().min(1).max(100).default(80),

        FRONTEND_URLS: Joi.string().default('http://localhost:3001'),

        LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('debug'),

        THROTTLE_TTL: Joi.number().integer().min(1).default(60),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get<string>('NODE_ENV') === 'test';

        return [
          {
            ttl: isTest ? 1000 : configService.get<number>('THROTTLE_TTL', 60),
            limit: isTest ? 100000 : configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ];
      },
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');

        const isTest = nodeEnv === 'test';

        const isProduction = nodeEnv === 'production';

        return {
          type: 'postgres',
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.getOrThrow<number>('DB_PORT'),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_DATABASE'),

          entities: [User, Container, Item, RefreshToken, AuditLog],

          synchronize: false,
          dropSchema: false,

          logging: !isTest && nodeEnv === 'development',

          logger: nodeEnv === 'development' ? 'advanced-console' : 'file',

          ssl: isProduction
            ? {
                rejectUnauthorized: false,
              }
            : false,

          migrations: ['dist/migrations/*{.ts,.js}'],
          migrationsRun: isProduction,
          migrationsTableName: 'migrations',
          migrationsTransactionMode: 'each',

          extra: {
            max: isTest ? 5 : configService.get<number>('DB_MAX_CONNECTIONS', 20),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            statement_timeout: 10000,
            query_timeout: 10000,
          },

          retryAttempts: isTest ? 1 : 3,
          retryDelay: isTest ? 1000 : 3000,

          cache: {
            duration: 60000,
          },
        };
      },
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get<string>('NODE_ENV') === 'test';

        return {
          store: redisStore,
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          ttl: isTest ? 60 : configService.get<number>('REDIS_TTL', 3600),
          max: configService.get<number>('REDIS_MAX_CONNECTIONS', 10),
          retryStrategy: (times: number) => (isTest ? null : Math.min(times * 100, 3000)),
          reconnectOnError: (error: Error) => error.message.includes('READONLY'),
          connectTimeout: 10000,
        };
      },
    }),

    RedisModule,
    AuthModule,
    ContainersModule,
    ItemsModule,
    FilesModule,
    AuditModule,
  ],

  controllers: [HealthController],

  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
