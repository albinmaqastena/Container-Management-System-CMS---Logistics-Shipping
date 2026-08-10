// src/common/redis/redis.module.ts

import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import Redis from 'ioredis';

export const REDIS_CLIENT =
  Symbol('REDIS_CLIENT');

@Injectable()
class RedisShutdownService
  implements OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      RedisShutdownService.name,
    );

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    if (
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      return;
    }

    let timeoutId:
      | NodeJS.Timeout
      | null = null;

    try {
      await Promise.race([
        this.redis.quit(),

        new Promise<never>(
          (_, reject) => {
            timeoutId =
              setTimeout(() => {
                reject(
                  new Error(
                    'Redis quit timeout',
                  ),
                );
              }, 3000);
          },
        ),
      ]);

      this.logger.log(
        'Redis connection closed gracefully',
      );
    } catch (error) {
      this.logger.warn(
        `Redis quit failed; disconnecting: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );

      this.redis.disconnect();
    } finally {
      if (timeoutId) {
        clearTimeout(
          timeoutId,
        );
      }
    }
  }
}

@Global()
@Module({
  imports: [
    ConfigModule,
  ],

  providers: [
    {
      provide:
        REDIS_CLIENT,

      inject: [
        ConfigService,
      ],

      useFactory: async (
        configService:
          ConfigService,
      ): Promise<Redis> => {
        const logger =
          new Logger(
            'RedisModule',
          );

        const isTest =
          configService.get<string>(
            'NODE_ENV',
          ) === 'test';

        const isProduction =
          configService.get<string>(
            'NODE_ENV',
          ) === 'production';

        const tlsEnabled =
          configService.get<boolean>(
            'redis.tls',
            false,
          );

        const tlsRejectUnauthorized =
          configService.get<boolean>(
            'redis.tlsRejectUnauthorized',
            true,
          );

        if (
          isProduction &&
          tlsEnabled &&
          !tlsRejectUnauthorized
        ) {
          throw new Error(
            'Redis TLS certificate verification cannot be disabled in production',
          );
        }

        const tlsCaRaw =
          configService.get<string>(
            'redis.tlsCa',
          );

        const tlsCa =
          tlsCaRaw?.replace(
            /\\n/g,
            '\n',
          );

        const redis =
          new Redis({
            host:
              configService.get<string>(
                'redis.host',
                'localhost',
              ),

            port:
              configService.get<number>(
                'redis.port',
                6379,
              ),

            username:
              configService.get<string>(
                'redis.username',
              ) || undefined,

            password:
              configService.get<string>(
                'redis.password',
              ) || undefined,

            db:
              configService.get<number>(
                'redis.db',
                isTest
                  ? 1
                  : 0,
              ),

            lazyConnect: true,

            enableReadyCheck: true,

            enableOfflineQueue: false,

            connectionName:
              configService.get<string>(
                'redis.connectionName',
                'container-management-backend',
              ),

            maxRetriesPerRequest:
              isTest
                ? 1
                : 3,

            connectTimeout:
              isTest
                ? 5000
                : 10000,

            commandTimeout:
              isTest
                ? 3000
                : 5000,

            tls:
              tlsEnabled
                ? {
                    servername:
                      configService.get<string>(
                        'redis.tlsServername',
                      ) ||
                      undefined,

                    rejectUnauthorized:
                      tlsRejectUnauthorized,

                    ca:
                      tlsCa ||
                      undefined,
                  }
                : undefined,

            retryStrategy: (
              times: number,
            ) => {
              const maxAttempts =
                isTest
                  ? 2
                  : 10;

              if (
                times >
                maxAttempts
              ) {
                return null;
              }

              return Math.min(
                times * 100,
                2000,
              );
            },
          });

        redis.on(
          'error',
          (
            error:
              NodeJS.ErrnoException,
          ) => {
            const expectedTestError =
              isTest &&
              [
                'ECONNRESET',
                'ECONNREFUSED',
              ].includes(
                error.code || '',
              );

            if (
              expectedTestError
            ) {
              logger.warn(
                `Redis test connection interrupted: ${error.code}`,
              );

              return;
            }

            logger.error(
              `Redis error: ${error.message}`,
              error.stack,
            );
          },
        );

        redis.on(
          'connect',
          () => {
            logger.debug(
              'Redis connection established (socket connected)',
            );
          },
        );

        let reconnectCount = 0;

        redis.on(
          'ready',
          () => {
            reconnectCount = 0;

            logger.log(
              'Redis connection ready',
            );
          },
        );

        redis.on(
          'close',
          () => {
            if (!isTest) {
              logger.warn(
                'Redis connection closed',
              );
            }
          },
        );

        redis.on(
          'reconnecting',
          (delay: number) => {
            reconnectCount++;

            if (
              reconnectCount % 5 ===
                0 ||
              reconnectCount === 1
            ) {
              logger.warn(
                `Redis reconnecting in ${delay}ms (attempt ${reconnectCount})`,
              );
            } else {
              logger.debug(
                `Redis reconnecting in ${delay}ms (attempt ${reconnectCount})`,
              );
            }
          },
        );

        redis.on(
          'end',
          () => {
            logger.warn(
              'Redis connection ended',
            );
          },
        );

        try {
          if (
            redis.status ===
            'wait'
          ) {
            await redis.connect();
          }
        } catch (
          error: unknown
        ) {
          logger.error(
            'Initial Redis connection failed',

            error instanceof Error
              ? error.stack
              : undefined,
          );

          throw error;
        }

        return redis;
      },
    },

    RedisShutdownService,
  ],

  exports: [
    REDIS_CLIENT,
  ],
})
export class RedisModule {}