// src/data-source.ts

import { DataSource } from 'typeorm';

import { User } from './modules/auth/entities/user.entity';
import { Container } from './modules/containers/entities/container.entity';
import { Item } from './modules/items/entities/item.entity';

import * as dotenv from 'dotenv';
import * as path from 'path';

// ============================================
// 1. ZGJEDH FILE-N E DUHUR .env
// ============================================

const initialNodeEnv =
  process.env.NODE_ENV || 'development';

const envFile =
  `.env.${initialNodeEnv}`;

const envPath =
  path.join(
    process.cwd(),
    envFile,
  );

// Load environment variables
dotenv.config({
  path: envPath,
});

// Lexoji pasi dotenv është ngarkuar
const nodeEnv =
  process.env.NODE_ENV ||
  initialNodeEnv;

const dbSslEnabled =
  process.env.DB_SSL_ENABLED === 'true';

// ============================================
// 2. LOGGO KONFIGURIMIN
// ============================================

console.log(
  '========================================',
);

console.log(
  '📊 DataSource Configuration',
);

console.log(
  `🔧 NODE_ENV: ${nodeEnv}`,
);

console.log(
  `📄 Loading env from: ${envFile}`,
);

console.log(
  `📊 Database: ${
    process.env.DB_DATABASE
  }`,
);

console.log(
  `🔗 DB Host: ${
    process.env.DB_HOST
  }`,
);

console.log(
  `🔌 DB Port: ${
    process.env.DB_PORT
  }`,
);

console.log(
  '========================================',
);

// ============================================
// 3. VALIDIMI I VARIABLAVE
// ============================================

const requiredDatabaseVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
];

for (
  const variableName
  of requiredDatabaseVariables
) {
  if (!process.env[variableName]) {
    throw new Error(
      `Missing required environment variable: ${variableName}`,
    );
  }
}

// ============================================
// 4. KRIJO DATASOURCE
// ============================================

const AppDataSource =
  new DataSource({
    type: 'postgres',

    host:
      process.env.DB_HOST,

    port:
      parseInt(
        process.env.DB_PORT!,
        10,
      ),

    username:
      process.env.DB_USERNAME,

    password:
      process.env.DB_PASSWORD,

    database:
      process.env.DB_DATABASE,

    // Entities
    entities: [
      User,
      Container,
      Item,
    ],

    // Migrations
    migrations: [
      path.join(
        __dirname,
        'migrations',
        '*{.ts,.js}',
      ),
    ],

    // Gjithmonë false për migrime
    synchronize: false,

    // Logging
    logging:
      nodeEnv !==
      'production',

    logger:
      nodeEnv ===
      'development'
        ? 'advanced-console'
        : 'file',

    // Migrations table
    migrationsTableName:
      'migrations',

    migrationsTransactionMode:
      'each',

    // SSL
    ssl:
      dbSslEnabled
        ? {
            rejectUnauthorized:
              false,
          }
        : false,

    // Connection pool
    extra: {
      max:
        nodeEnv === 'test'
          ? 5
          : Number(
              process.env
                .DB_MAX_CONNECTIONS,
            ) || 20,

      idleTimeoutMillis:
        30000,

      connectionTimeoutMillis:
        2000,

      statement_timeout:
        nodeEnv === 'test'
          ? 5000
          : 10000,

      query_timeout:
        nodeEnv === 'test'
          ? 5000
          : 10000,
    },

    // Cache
    cache: {
      duration:
        nodeEnv === 'test'
          ? 1000
          : 60000,
    },
  });

// ============================================
// 5. EKSPORTO VETËM DEFAULT
// ============================================

export default AppDataSource;