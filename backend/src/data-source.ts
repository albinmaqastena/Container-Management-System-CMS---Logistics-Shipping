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
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.join(process.cwd(), envFile);

// Load environment variables
dotenv.config({ path: envPath });

// ============================================
// 2. LOGGO KONFIGURIMIN
// ============================================
console.log('========================================');
console.log('📊 DataSource Configuration');
console.log(`🔧 NODE_ENV: ${nodeEnv}`);
console.log(`📄 Loading env from: ${envFile}`);
console.log(`📊 Database: ${process.env.DB_DATABASE}`);
console.log(`🔗 DB Host: ${process.env.DB_HOST}`);
console.log(`🔌 DB Port: ${process.env.DB_PORT}`);
console.log('========================================');

// ============================================
// 3. VALIDIMI I VARIABLAVE (Shto këtë)
// ============================================
if (!process.env.DB_DATABASE) {
  console.error('❌ DB_DATABASE is not defined!');
  console.error('📄 Please check your .env file.');
  process.exit(1);
}

// ============================================
// 4. KRIJO DATASOURCE (VETËM NJË EKSPORT)
// ============================================
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'container_db',

  // Entities
  entities: [User, Container, Item],

  // Migrations
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],

  // ✅ Gjithmonë false për migrime
  synchronize: false,

  // Logging
  logging: nodeEnv !== 'production',
  logger: nodeEnv === 'development' ? 'advanced-console' : 'file',

  // Migrations table
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'each',

  // SSL për production
  ssl:
    nodeEnv === 'production'
      ? {
          rejectUnauthorized: false,
        }
      : false,

  // ✅ Connection pool
  extra: {
    max: nodeEnv === 'test' ? 5 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: nodeEnv === 'test' ? 5000 : 10000,
    query_timeout: nodeEnv === 'test' ? 5000 : 10000,
  },

  // ✅ Cache
  cache: {
    duration: nodeEnv === 'test' ? 1000 : 60000,
  },
});

// ============================================
// 5. EKSPORTO VETËM DEFAULT (HOQA eksportin me emër)
// ============================================
export default AppDataSource;
