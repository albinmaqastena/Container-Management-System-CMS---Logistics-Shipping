// items.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager'; // ✅ Shto këtë
import { ConfigModule, ConfigService } from '@nestjs/config'; // ✅ Shto këtë
import * as redisStore from 'cache-manager-redis-store'; // ✅ Shto këtë
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { ContainersModule } from '../containers/containers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item]),
    ContainersModule,
    // ✅ Shto CacheModule me të njëjtin konfigurim
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        ttl: configService.get<number>('CACHE_TTL', 3600),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}