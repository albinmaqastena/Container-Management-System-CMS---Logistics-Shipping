// src/config/redis.config.ts

import type { CacheModuleOptions } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

export const redisConfig = (): CacheModuleOptions => ({
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  ttl: Number(process.env.REDIS_TTL || 3600),
});
