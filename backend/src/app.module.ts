// src/app.module.ts
import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import * as Joi from 'joi';
import * as redisStore from 'cache-manager-redis-store';

import { AuthModule } from './modules/auth/auth.module';
import { ContainersModule } from './modules/containers/containers.module';
import { ItemsModule } from './modules/items/items.module';
import { FilesModule } from './modules/files/files.module';

import { User } from './modules/auth/entities/user.entity';
import { Container } from './modules/containers/entities/container.entity';
import { Item } from './modules/items/entities/item.entity';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { HealthController } from './health/health.controller';

import authConfig from './config/auth.config';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { AuditModule } from './modules/audits/audit.module';
import { AuditLog } from './modules/audits/entities/audit-log.entity';

@Module({
  imports: [
    // ✅ 1. CONFIG MODULE - WITH AUTH CONFIG LOADED
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [authConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),

        PORT: Joi.number().default(3000),

        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().default('password'),
        DB_DATABASE: Joi.string().default('container_db'),
        DB_MAX_CONNECTIONS: Joi.number().default(20),

        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        JWT_ISSUER: Joi.string().default('container-management-system'),
        JWT_AUDIENCE: Joi.string().default('container-management-users'),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_TTL: Joi.number().default(3600),
        REDIS_MAX_CONNECTIONS: Joi.number().default(10),

        FRONTEND_URLS: Joi.string().default('http://localhost:3001'),

        LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('debug'),

        // Rate limiting
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(100),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),

    // ✅ 2. RATE LIMITING (mbrojtje nga brute force)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60),
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // ✅ 3. TYPEORM MODULE (Database)
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

          logging: isTest ? false : nodeEnv === 'development',
          logger: nodeEnv === 'development' ? 'advanced-console' : 'file',

          ssl: isProduction ? {
            rejectUnauthorized: false,
          } : false,

          migrations: ['dist/migrations/*{.ts,.js}'],
          migrationsRun: isProduction,
          migrationsTableName: 'migrations',
          migrationsTransactionMode: 'each',

          extra: {
            max: isTest ? 5 : (configService.get<number>('DB_MAX_CONNECTIONS') || 20),
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

    // ✅ 4. CACHE MODULE (Redis)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const isTest = configService.get<string>('NODE_ENV') === 'test';
        
        return {
          store: redisStore,
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          ttl: isTest ? 60 : configService.get<number>('REDIS_TTL', 3600),
          max: isTest ? 5 : configService.get<number>('REDIS_MAX_CONNECTIONS', 10),
          retryStrategy: (times: number) => {
            if (isProduction) {
              return Math.min(times * 50, 2000);
            }
            return Math.min(times * 100, 3000);
          },
          reconnectOnError: (err: Error) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          },
          connectTimeout: 10000,
        };
      },
    }),

    // ✅ 5. FEATURE MODULES
    AuthModule,
    ContainersModule,
    ItemsModule,
    FilesModule,
    AuditModule,
  ],

  controllers: [
    HealthController,
  ],

  // ✅ 6. PROVIDERS
  providers: [
    // 1. Rate limiting (më i pari)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 2. Authentication (JWT)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 3. Authorization (Roles)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // 4. Validation pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },
    // 5. Logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  // ✅ 7. MIDDLEWARE CONFIGURATION
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}