// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../modules/auth/entities/user.entity';
import { Container } from '../modules/containers/entities/container.entity';
import { Item } from '../modules/items/entities/item.entity';

/**
 * Database configuration
 */
export const createDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isTest = nodeEnv === 'test';
  const isProduction = nodeEnv === 'production';

  // Validimi i variablave kritike
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
  for (const varName of requiredVars) {
    if (!configService.get(varName)) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    
    // Entities
    entities: [User, Container, Item],
    
    // Sync & Schema
    synchronize: !isProduction && !isTest,
    dropSchema: isTest,
    
    // Logging
    logging: nodeEnv === 'development',
    logger: 'advanced-console',
    
    // SSL
    ssl: isProduction ? {
      rejectUnauthorized: false,
      ca: configService.get('DB_SSL_CA'),
      key: configService.get('DB_SSL_KEY'),
      cert: configService.get('DB_SSL_CERT'),
    } : false,
    
    // Connection Pool
    extra: {
      max: isTest ? 5 : (configService.get<number>('DB_MAX_CONNECTIONS') || 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    
    // Retry
    retryAttempts: isTest ? 1 : 3,
    retryDelay: isTest ? 1000 : 3000,
    
    // Migrations
    migrations: ['dist/migrations/*{.ts,.js}'],
    migrationsRun: isProduction,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    
    // Cache
    cache: {
      duration: 60000, // 1 minute
    },
    
    // ✅ HOQA namingStrategy - Nuk është e nevojshme
    // namingStrategy: ... // ← HOQE KËTË!
  };
};

// Default export për përdorim të thjeshtë
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'container_db',
  entities: [User, Container, Item],
  synchronize: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
  } : false,
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  retryAttempts: 3,
  retryDelay: 3000,
  migrations: ['dist/migrations/*{.ts,.js}'],
  migrationsRun: process.env.NODE_ENV === 'production',
  migrationsTableName: 'migrations',
};