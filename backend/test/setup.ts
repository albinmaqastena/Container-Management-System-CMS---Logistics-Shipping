// test/setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';

let app: INestApplication;
let dataSource: DataSource;

/**
 * Setup që ekzekutohet para të gjitha testeve
 * ⚠️ NUK prek databazën fare - vetëm lexon të dhënat ekzistuese
 */
beforeAll(async () => {
  console.log('========================================');
  console.log('🧪 Setting up E2E Test Environment');
  console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`📊 Database: ${process.env.DB_DATABASE}`);
  console.log('ℹ️  READ-ONLY MODE: No database modifications');

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('❌ NODE_ENV must be "test" to run E2E tests!');
  }

  if (!process.env.DB_DATABASE?.includes('test')) {
    throw new Error(`❌ Test database must contain "test"! Current: ${process.env.DB_DATABASE}`);
  }

  console.log('✅ Environment check passed');
  console.log('========================================');

  // ✅ KRIJO APP-IN (NUK PREK DATABAZËN)
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  await app.init();

  // ✅ MER DATASOURCE (VETËM PËR LEXIM)
  dataSource = app.get(DataSource);

  if (!dataSource || !dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // ✅ VETËM KONTROLLO NËSE ADMINI EKZISTON (LEXIM, JO NDRYSHIM)
  const admin = await dataSource.query(
    'SELECT id, username, email FROM users WHERE email = $1',
    ['admin@example.com']
  );

  if (admin.length === 0) {
    console.warn('⚠️  Admin user not found!');
    console.warn('⚠️  Please run migrations first: npm run migration:run:test');
  } else {
    console.log(`✅ Admin found: ${admin[0].username} (${admin[0].id})`);
  }

  // ✅ STATISTIKAT E DATABAZËS (VETËM LEXIM)
  const stats = await getDatabaseStats();
  console.log(`📊 Database stats: ${stats.users} users, ${stats.containers} containers, ${stats.items} items`);
  console.log('========================================');
}, 60000);

/**
 * Setup që ekzekutohet pas të gjitha testeve
 * ⚠️ NUK prek databazën - vetëm mbyll lidhjet
 */
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  if (dataSource) {
    try {
      await dataSource.destroy();
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }

  if (app) {
    try {
      await app.close();
    } catch (error) {
      console.error('Error closing app:', error);
    }
  }

  console.log('✅ Test environment cleaned up');
}, 30000);

/**
 * Merr statistikat e database-it (VETËM LEXIM)
 */
async function getDatabaseStats() {
  const userCount = await dataSource.query('SELECT COUNT(*) FROM users');
  const containerCount = await dataSource.query('SELECT COUNT(*) FROM containers');
  const itemCount = await dataSource.query('SELECT COUNT(*) FROM items');

  return {
    users: parseInt(userCount[0].count),
    containers: parseInt(containerCount[0].count),
    items: parseInt(itemCount[0].count),
  };
}

/**
 * Helper për të marrë token-in e autentikimit
 * ⚠️ VETËM LEXIM - merr token nga admin-i ekzistues
 */
export const getAuthToken = async (email: string, password: string): Promise<string> => {
  if (!app) {
    throw new Error('❌ App is not initialized!');
  }

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  console.log(`📝 Login attempt: ${email}`);
  console.log(`📝 Response status: ${response.status}`);

  if (response.status !== 200) {
    console.error('❌ Login failed:', response.body);
    throw new Error('Failed to get auth token');
  }

  console.log('✅ Login successful');
  return response.body.accessToken;
};

export const getApp = () => app;
export const getDataSource = () => dataSource;