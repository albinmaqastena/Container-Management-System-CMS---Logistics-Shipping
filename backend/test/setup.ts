// test/setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';

// ✅ MOCK I REDIS
const redisStore = new Map<string, string>();

const mockRedis = {
  async set(key: string, value: string, ...args: unknown[]) {
    void args;
    redisStore.set(key, value);
    return 'OK';
  },

  async get(key: string) {
    return redisStore.get(key) ?? null;
  },

  async del(key: string) {
    redisStore.delete(key);
    return 1;
  },

  async exists(key: string) {
    return redisStore.has(key) ? 1 : 0;
  },

  async scan(cursor: string, ...args: any[]) {
    const pattern = args[1];
    const prefix = pattern.replace('*', '');

    const keys = [...redisStore.keys()].filter((k) => k.startsWith(prefix));

    return ['0', keys];
  },

  async keys(pattern: string) {
    const prefix = pattern.replace('*', '');

    return [...redisStore.keys()].filter((k) => k.startsWith(prefix));
  },
};

let app: INestApplication;
let dataSource: DataSource;
let isSetupDone = false;

/**
 * Setup që ekzekutohet para të gjitha testeve
 */
beforeAll(async () => {
  if (isSetupDone) {
    console.log('✅ Setup already done, skipping...');
    return;
  }

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

  console.log('TYPEORM PATH:', require.resolve('typeorm'));
  console.log('PG PATH:', require.resolve('pg'));

  // ✅ KRIJO APP-IN DHE MBISHKRUAJ REDIS-IN ME MOCK
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('REDIS_CLIENT')
    .useValue(mockRedis)
    .compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  await app.init();

  dataSource = app.get(DataSource);

  if (!dataSource || !dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // Kontrollo admin-in
  const admin = await dataSource.query('SELECT id, username, email FROM users WHERE email = $1', [
    'admin@example.com',
  ]);

  if (admin.length === 0) {
    console.warn('⚠️  Admin user not found!');
    console.warn('⚠️  Please run migrations first: npm run migration:run:test');
  } else {
    console.log(`✅ Admin found: ${admin[0].username} (${admin[0].id})`);
  }

  const stats = await getDatabaseStats();
  console.log(
    `📊 Database stats: ${stats.users} users, ${stats.containers} containers, ${stats.items} items`,
  );
  console.log('========================================');

  isSetupDone = true;
}, 60000);

/**
 * Pastrimi pas të gjitha testeve
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

export const getAuthToken = async (email: string, password: string): Promise<string> => {
  if (!app) {
    throw new Error('❌ App is not initialized!');
  }

  const response = await request(app.getHttpServer())
    .post('/v1/auth/login')
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

export const getApp = () => {
  if (!app) {
    throw new Error('❌ App is not initialized! Call beforeAll first.');
  }
  return app;
};

export const getDataSource = () => {
  if (!dataSource) {
    throw new Error('❌ DataSource is not initialized!');
  }
  return dataSource;
};
