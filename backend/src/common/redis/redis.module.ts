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
    new Logger(RedisShutdownService.name);

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

    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn(
        `Redis quit failed; disconnecting: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );

      this.redis.disconnect();
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<Redis> => {
        const logger =
          new Logger('RedisModule');

        const isTest =
          configService.get<string>(
            'NODE_ENV',
          ) === 'test';

        const redis = new Redis({
          host:
            configService.get<string>(
              'REDIS_HOST',
              'localhost',
            ),
          port:
            configService.get<number>(
              'REDIS_PORT',
              6379,
            ),
          password:
            configService.get<string>(
              'REDIS_PASSWORD',
            ) || undefined,
          db:
            configService.get<number>(
              'REDIS_DB',
              isTest ? 1 : 0,
            ),

          lazyConnect: true,
          enableOfflineQueue: true,
          maxRetriesPerRequest:
            isTest ? 1 : 3,
          connectTimeout:
            isTest ? 5000 : 10000,

          retryStrategy: (
            times: number,
          ) => {
            const maxAttempts =
              isTest ? 2 : 10;

            if (times > maxAttempts) {
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
            error: NodeJS.ErrnoException,
          ) => {
            const expectedTestError =
              isTest &&
              [
                'ECONNRESET',
                'ECONNREFUSED',
              ].includes(
                error.code || '',
              );

            if (expectedTestError) {
              logger.warn(
                `Redis test connection interrupted: ${
                  error.code
                }`,
              );
              return;
            }

            logger.error(
              `Redis error: ${error.message}`,
            );
          },
        );

        redis.on('connect', () => {
          logger.log(
            'Redis connection established',
          );
        });

        redis.on('close', () => {
          if (!isTest) {
            logger.warn(
              'Redis connection closed',
            );
          }
        });

        if (redis.status === 'wait') {
          await redis.connect();
        }

        return redis;
      },
    },
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}