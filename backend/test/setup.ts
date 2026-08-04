// test/setup.ts
import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { MailService } from '../src/modules/mail/mail.service';

// ✅ MOCK I REDIS
const redisStore = new Map<string, string>();

const redisGlobToRegExp = (pattern: string): RegExp => {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`);
};

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

  async scan(cursor: string, ...args: unknown[]): Promise<[string, string[]]> {
    void cursor;

    const matchIndex = args.findIndex(
      (argument) => typeof argument === 'string' && argument.toUpperCase() === 'MATCH',
    );

    const pattern =
      matchIndex >= 0 && typeof args[matchIndex + 1] === 'string'
        ? (args[matchIndex + 1] as string)
        : '*';

    const regex = redisGlobToRegExp(pattern);

    const keys = [...redisStore.keys()].filter((key) => regex.test(key));

    return ['0', keys];
  },

  async keys(pattern: string): Promise<string[]> {
    const regex = redisGlobToRegExp(pattern);

    return [...redisStore.keys()].filter((key) => regex.test(key));
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
  console.log('ℹ️  NON-DESTRUCTIVE MODE: Existing database data is not cleared');

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('❌ NODE_ENV must be "test" to run E2E tests!');
  }

  if (!process.env.DB_DATABASE?.includes('test')) {
    throw new Error(`❌ Test database must contain "test"! Current: ${process.env.DB_DATABASE}`);
  }

  console.log('✅ Environment check passed');
  console.log('========================================');

  // ✅ KRIJO APP-IN DHE MBISHKRUAJ REDIS-IN ME MOCK
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('REDIS_CLIENT')
    .useValue(mockRedis)
    .overrideProvider(MailService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    });

  // ✅ ThrottlerGuard - kalon gjithmonë në teste
  moduleBuilder.overrideGuard(ThrottlerGuard).useValue({
    canActivate: jest.fn().mockResolvedValue(true),
  });

  const moduleFixture = await moduleBuilder.compile();

  app = moduleFixture.createNestApplication();

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  await app.init();

  dataSource = app.get(DataSource);

  if (!dataSource.isInitialized) {
    throw new Error('❌ DataSource was not initialized by the Nest application');
  }

  // Kontrollo emrin e databazës nga connection
  const databaseName = dataSource.options.database;
  if (typeof databaseName !== 'string' || !databaseName.includes('test')) {
    throw new Error(
      `❌ Connected database must be a test database. Current: ${String(databaseName)}`,
    );
  }

  // Kontrollo admin-in
  const admin = await dataSource.query(
    `
      SELECT
        "id",
        "username",
        "email",
        "role",
        "isActive"
      FROM "users"
      WHERE "email" = $1
      LIMIT 1
    `,
    ['admin@example.com'],
  );

  if (admin.length === 0) {
    throw new Error('❌ Test admin user was not found. Run test migrations/seeds first.');
  }

  if (admin[0].role !== 'super_admin') {
    throw new Error(
      `❌ admin@example.com must have role super_admin. Current role: ${admin[0].role}`,
    );
  }

  if (admin[0].isActive !== true) {
    throw new Error('❌ admin@example.com must be active');
  }

  console.log(`✅ Admin found: ${admin[0].username} (${admin[0].id})`);

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

  if (app) {
    try {
      await app.close();
    } catch (error) {
      console.error('Error closing app:', error);
    }
  }

  redisStore.clear();

  console.log('✅ Test environment cleaned up');
}, 30000);

async function getDatabaseStats() {
  const userCount = await dataSource.query('SELECT COUNT(*) FROM users');
  const containerCount = await dataSource.query('SELECT COUNT(*) FROM containers');
  const itemCount = await dataSource.query('SELECT COUNT(*) FROM items');

  return {
    users: Number.parseInt(userCount[0].count, 10),
    containers: Number.parseInt(containerCount[0].count, 10),
    items: Number.parseInt(itemCount[0].count, 10),
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
    throw new Error(`Failed to get auth token for ${email}`);
  }

  const accessToken = response.body.accessToken;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Login response did not contain a valid access token');
  }

  console.log('✅ Login successful');
  return accessToken;
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
