// src/modules/containers/containers.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import { Container } from './entities/container.entity';
import { Item } from '../items/entities/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Container, Item]),

    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>(
              'REDIS_HOST',
              'localhost',
            ),
            port: configService.get<number>(
              'REDIS_PORT',
              6379,
            ),
          },
          ttl: configService.get<number>(
            'CACHE_TTL',
            3600,
          ),
        }),
      }),
    }),
  ],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [ContainersService],
})
export class ContainersModule {}