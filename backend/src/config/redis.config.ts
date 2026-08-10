import { registerAs } from '@nestjs/config';

export interface RedisConfiguration {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;

  ttl: number;
  maxConnections: number;

  connectionName: string;

  tls: boolean;
  tlsRejectUnauthorized: boolean;
  tlsServername?: string;
  tlsCa?: string;
}

export default registerAs(
  'redis',
  (): RedisConfiguration => ({
    host:
      process.env.REDIS_HOST?.trim() ||
      'localhost',

    port: Number(
      process.env.REDIS_PORT || 6379,
    ),

    username:
      process.env.REDIS_USERNAME?.trim() ||
      undefined,

    password:
      process.env.REDIS_PASSWORD ||
      undefined,

    db: Number(
      process.env.REDIS_DB || 0,
    ),

    ttl: Number(
      process.env.REDIS_TTL || 3600,
    ),

    maxConnections: Number(
      process.env.REDIS_MAX_CONNECTIONS ||
        10,
    ),

    connectionName:
      process.env.REDIS_CONNECTION_NAME ||
      'container-management-backend',

    tls:
      process.env.REDIS_TLS === 'true',

    tlsRejectUnauthorized:
      process.env
        .REDIS_TLS_REJECT_UNAUTHORIZED !==
      'false',

    tlsServername:
      process.env.REDIS_TLS_SERVERNAME?.trim() ||
      undefined,

    tlsCa:
      process.env.REDIS_TLS_CA ||
      undefined,
  }),
);