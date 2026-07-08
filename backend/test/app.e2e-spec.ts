// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getAuthToken } from './setup';

describe('AppController (e2e) - Full Test Suite', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let testContainerId: string;
  let testItemId: string;

  // ============================================
  // SETUP - KRIJO USER-A DHE TOKEN-A
  // ============================================
  beforeAll(async () => {
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

    // Marrim token-in e admin-it ekzistues
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');

    // Krijojmë një user normal për testim
    try {
      userToken = await getAuthToken('testuser@example.com', 'password123');
    } catch {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'testuser',
          email: 'testuser@example.com',
          password: 'password123',
          role: 'user',
        })
        .expect(201);
      userToken = await getAuthToken('testuser@example.com', 'password123');
    }

    console.log('✅ Test setup complete');
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  // ============================================
  // 1. AUTHENTICATION TESTS
  // ============================================
  describe('Authentication', () => {
    describe('POST /auth/login', () => {
      it('should login with valid credentials (admin)', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@example.com', password: 'Admin@123' })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body.user).toHaveProperty('email', 'admin@example.com');
        expect(response.body.user.role).toBe('admin');
      });

      it('should login with valid credentials (user)', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'testuser@example.com', password: 'password123' })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body.user).toHaveProperty('email', 'testuser@example.com');
        expect(response.body.user.role).toBe('user');
      });

      it('should fail with invalid password', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@example.com', password: 'wrongpassword' })
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toBe('Invalid credentials');
          });
      });

      it('should fail with non-existent email', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'password' })
          .expect(401);
      });

      it('should fail with missing email', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ password: 'password123' })
          .expect(400);
      });

      it('should fail with missing password', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@example.com' })
          .expect(400);
      });
    });

    describe('POST /auth/register', () => {
      it('should register a new user (admin only)', async () => {
        const uniqueEmail = `newuser_${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: `newuser_${Date.now()}`,
            email: uniqueEmail,
            password: 'password123',
            role: 'user',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe(uniqueEmail);
        expect(response.body.role).toBe('user');
      });

      it('should fail to register user with existing email', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: 'anotheruser',
            email: 'admin@example.com',
            password: 'password123',
            role: 'user',
          })
          .expect(409);
      });

      it('should fail to register user with existing username', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: 'admin',
            email: 'unique@example.com',
            password: 'password123',
            role: 'user',
          })
          .expect(409);
      });

      it('should fail to register without token', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            username: 'unauthorized',
            email: 'unauth@example.com',
            password: 'password123',
            role: 'user',
          })
          .expect(401);
      });

      it('should fail to register with invalid token', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .set('Authorization', 'Bearer invalidtoken')
          .send({
            username: 'invalidtokenuser',
            email: 'invalid@example.com',
            password: 'password123',
            role: 'user',
          })
          .expect(401);
      });

      it('should fail to register with missing fields', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ email: 'missing@example.com', password: 'password123' })
          .expect(400);
      });
    });

    describe('POST /auth/logout', () => {
      it('should logout successfully', async () => {
        const token = await getAuthToken('admin@example.com', 'Admin@123');
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.message).toBe('Logged out successfully');
          });
      });

      it('should fail logout without token', async () => {
        await request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);
      });

      it('should fail logout with invalid token', async () => {
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', 'Bearer invalidtoken')
          .expect(401);
      });
    });

    describe('GET /auth/sessions', () => {
      it('should get active sessions for authenticated user', async () => {
        const token = await getAuthToken('admin@example.com', 'Admin@123');
        const response = await request(app.getHttpServer())
          .get('/auth/sessions')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('sessions');
        expect(Array.isArray(response.body.sessions)).toBe(true);
      });

      it('should fail getting sessions without token', async () => {
        await request(app.getHttpServer())
          .get('/auth/sessions')
          .expect(401);
      });
    });
  });

  // ============================================
  // 2. CONTAINER TESTS
  // ============================================
  describe('Containers', () => {
    describe('POST /containers', () => {
      it('should create a container (admin)', async () => {
        const response = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Test Container Alpha',
            totalVolume: 100,
            description: 'Test container created by admin',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe('Test Container Alpha');
        expect(response.body.totalVolume).toBe(100);
        expect(response.body.status).toBe('active');
        expect(response.body.containerCode).toBeDefined();
        testContainerId = response.body.id;
      });

      it('should create a container with only required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Minimal Container',
            totalVolume: 50,
          })
          .expect(201);

        expect(response.body.name).toBe('Minimal Container');
        testContainerId = response.body.id;
      });

      it('should fail to create container without token', async () => {
        await request(app.getHttpServer())
          .post('/containers')
          .send({
            customName: 'No Token Container',
            totalVolume: 100,
          })
          .expect(401);
      });

      it('should fail to create container with user role', async () => {
        await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            customName: 'User Container',
            totalVolume: 100,
          })
          .expect(401);
      });

      it('should fail to create container with negative volume', async () => {
        await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Negative Volume Container',
            totalVolume: -10,
          })
          .expect(400);
      });

      it('should fail to create container with missing name', async () => {
        await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            totalVolume: 100,
          })
          .expect(400);
      });

      it('should fail to create container with missing volume', async () => {
        await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Missing Volume',
          })
          .expect(400);
      });
    });

    describe('GET /containers', () => {
      it('should get all containers (admin)', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      it('should get all containers (user)', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter containers by status (active)', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers?status=active')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((c: any) => c.status === 'active')).toBe(true);
      });

      it('should filter containers by status (archived)', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers?status=archived')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((c: any) => c.status === 'archived')).toBe(true);
      });

      it('should fail with invalid status value', async () => {
        await request(app.getHttpServer())
          .get('/containers?status=invalid')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('GET /containers/active', () => {
      it('should get active containers', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers/active')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((c: any) => c.status === 'active')).toBe(true);
      });

      it('should return 200 even if no active containers', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers/active')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /containers/archived', () => {
      it('should get archived containers', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers/archived')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((c: any) => c.status === 'archived')).toBe(true);
      });
    });

    describe('GET /containers/search', () => {
      it('should search containers by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers/search?query=Alpha')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.some((c: any) => c.name?.includes('Alpha'))).toBe(true);
      });

      it('should search containers by containerCode', async () => {
        const containerList = await request(app.getHttpServer())
          .get('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (containerList.body.length > 0) {
          const code = containerList.body[0].containerCode;
          const response = await request(app.getHttpServer())
            .get(`/containers/search?query=${code}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body.length).toBeGreaterThan(0);
          expect(response.body[0].containerCode).toBe(code);
        }
      });

      it('should return empty array for non-existent search', async () => {
        const response = await request(app.getHttpServer())
          .get('/containers/search?query=NonExistentContainer')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });

      it('should fail with missing query parameter', async () => {
        await request(app.getHttpServer())
          .get('/containers/search')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('GET /containers/:id', () => {
      it('should get a container by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/containers/${testContainerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).toBe(testContainerId);
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it('should return 404 for non-existent container', async () => {
        await request(app.getHttpServer())
          .get('/containers/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should fail with invalid UUID format', async () => {
        await request(app.getHttpServer())
          .get('/containers/not-a-uuid')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('PUT /containers/:id', () => {
      it('should update a container (admin)', async () => {
        const response = await request(app.getHttpServer())
          .put(`/containers/${testContainerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Container Name',
            description: 'Updated description',
          })
          .expect(200);

        expect(response.body.name).toBe('Updated Container Name');
        expect(response.body.description).toBe('Updated description');
      });

      it('should update container status to archived', async () => {
        const response = await request(app.getHttpServer())
          .put(`/containers/${testContainerId}/status?status=archived`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.status).toBe('archived');
      });

      it('should update container status back to active', async () => {
        const response = await request(app.getHttpServer())
          .put(`/containers/${testContainerId}/status?status=active`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.status).toBe('active');
      });

      it('should fail to update container (user)', async () => {
        await request(app.getHttpServer())
          .put(`/containers/${testContainerId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Hacked Name',
          })
          .expect(401);
      });

      it('should fail to update non-existent container', async () => {
        await request(app.getHttpServer())
          .put('/containers/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Non Existent',
          })
          .expect(404);
      });
    });

    describe('DELETE /containers/:id', () => {
      it('should delete an empty container', async () => {
        const newContainer = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'To Delete',
            totalVolume: 50,
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/containers/${newContainer.body.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);
      });

      it('should fail to delete a container with items', async () => {
        const container = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Container With Items',
            totalVolume: 100,
          })
          .expect(201);

        const itemSuffix = Date.now();
        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-DELETE-TEST-${itemSuffix}`,
            name: 'Test Item for Delete',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: container.body.id,
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/containers/${container.body.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      }, 15000);

      it('should fail to delete container (user)', async () => {
        const container = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'User Delete Attempt',
            totalVolume: 50,
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/containers/${container.body.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(401);
      });
    });
  });

  // ============================================
  // 3. ITEM TESTS
  // ============================================
  describe('Items', () => {
    let containerId: string;
    let itemId: string;

    beforeAll(async () => {
      const container = await request(app.getHttpServer())
        .post('/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Item Test Container',
          totalVolume: 500,
        })
        .expect(201);
      containerId = container.body.id;
    });

    describe('POST /items', () => {
      it('should create an item (admin)', async () => {
        const itemSuffix = Date.now();
        const response = await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-${itemSuffix}`,
            name: 'Test Item One',
            packageQuantity: 5,
            productsPerPackage: 10,
            packagePrice: 100.50,
            volume: 2.5,
            containerId: containerId,
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.uniqueNumber).toBe(`ITEM-${itemSuffix}`);
        expect(response.body.totalVolume).toBe(12.5);
        itemId = response.body.id;
      });

      it('should create an item with photo', async () => {
        const photoSuffix = Date.now();
        const response = await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-PHOTO-${photoSuffix}`,
            name: 'Item With Photo',
            photo: 'https://example.com/photo.jpg',
            packageQuantity: 3,
            productsPerPackage: 20,
            packagePrice: 200.00,
            volume: 5.0,
            containerId: containerId,
          })
          .expect(201);

        expect(response.body.photo).toBe('https://example.com/photo.jpg');
      });

      it('should fail to create item without token', async () => {
        await request(app.getHttpServer())
          .post('/items')
          .send({
            uniqueNumber: 'ITEM-003',
            name: 'No Token Item',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(401);
      });

      it('should fail to create item with user role', async () => {
        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            uniqueNumber: 'ITEM-004',
            name: 'User Item',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(401);
      });

      it('should fail to create item with duplicate uniqueNumber', async () => {
        const dupSuffix = Date.now();
        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-DUP-${dupSuffix}`,
            name: 'Original Item',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-DUP-${dupSuffix}`,
            name: 'Duplicate Item',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(409);
      });

      it('should fail to create item with insufficient volume', async () => {
        const smallContainer = await request(app.getHttpServer())
          .post('/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: 'Small Container',
            totalVolume: 1,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: 'ITEM-005',
            name: 'Too Large Item',
            packageQuantity: 10,
            productsPerPackage: 10,
            packagePrice: 100,
            volume: 10,
            containerId: smallContainer.body.id,
          })
          .expect(400);
      });

      it('should fail to create item with missing required fields', async () => {
        await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Missing Fields',
            containerId: containerId,
          })
          .expect(400);
      });
    });

    describe('GET /items', () => {
      it('should get all items (admin)', async () => {
        const response = await request(app.getHttpServer())
          .get('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      it('should get items by containerId', async () => {
        const response = await request(app.getHttpServer())
          .get(`/items?containerId=${containerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((item: any) => item.containerId === containerId)).toBe(true);
      });

      it('should return empty array for non-existent containerId', async () => {
        const response = await request(app.getHttpServer())
          .get('/items?containerId=00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });
    });

    describe('GET /items/search', () => {
      it('should search items by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/items/search?query=Test')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body.some((item: any) => item.name?.includes('Test'))).toBe(true);
      });

      it('should search items by uniqueNumber', async () => {
        const response = await request(app.getHttpServer())
          .get('/items/search?query=ITEM-001')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0].uniqueNumber).toBe('ITEM-001');
      });

      it('should search items in specific container', async () => {
        const response = await request(app.getHttpServer())
          .get(`/items/search?query=Test&containerId=${containerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((item: any) => item.containerId === containerId || item.container?.id === containerId)).toBe(true);
      });

      it('should return empty array for non-existent search', async () => {
        const response = await request(app.getHttpServer())
          .get('/items/search?query=NonExistentItem')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.length).toBe(0);
      });
    });

    describe('GET /items/:id', () => {
      it('should get an item by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/items/${itemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).toBe(itemId);
        expect(response.body).toHaveProperty('container');
        expect(response.body.container.id).toBe(containerId);
      });

      it('should fail for non-existent item', async () => {
        await request(app.getHttpServer())
          .get('/items/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });

    describe('PUT /items/:id', () => {
      it('should update an item (admin)', async () => {
        const response = await request(app.getHttpServer())
          .put(`/items/${itemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Item Name',
            packagePrice: 200.00,
          })
          .expect(200);

        expect(response.body.name).toBe('Updated Item Name');
        expect(response.body.packagePrice).toBe(200.00);
      });

      it('should update item volume and recalculate totalVolume', async () => {
        const response = await request(app.getHttpServer())
          .put(`/items/${itemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            volume: 5.0,
            packageQuantity: 10,
          })
          .expect(200);

        expect(response.body.totalVolume).toBe(50.0);
      });

      it('should fail to update item (user)', async () => {
        await request(app.getHttpServer())
          .put(`/items/${itemId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Hacked Name',
          })
          .expect(401);
      });

      it('should fail to update non-existent item', async () => {
        await request(app.getHttpServer())
          .put('/items/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Non Existent',
          })
          .expect(404);
      });
    });

    describe('DELETE /items/:id', () => {
      it('should delete an item (admin)', async () => {
        const deleteSuffix = Date.now();
        const newItem = await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-DELETE-${deleteSuffix}`,
            name: 'Item to Delete',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/items/${newItem.body.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);
      });

      it('should fail to delete item (user)', async () => {
        const deleteSuffix = Date.now() + 1;
        const newItem = await request(app.getHttpServer())
          .post('/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: `ITEM-USER-DELETE-${deleteSuffix}`,
            name: 'User Delete Attempt',
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId: containerId,
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/items/${newItem.body.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(401);
      });

      it('should fail to delete non-existent item', async () => {
        await request(app.getHttpServer())
          .delete('/items/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .delete(`/containers/${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  // ============================================
  // 4. AUTHORIZATION TESTS
  // ============================================
  describe('Authorization', () => {
    it('should allow admin to access admin-only endpoints', async () => {
      await request(app.getHttpServer())
        .post('/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Admin Container',
          totalVolume: 100,
        })
        .expect(201);
    });

    it('should deny user access to admin-only endpoints', async () => {
      await request(app.getHttpServer())
        .post('/containers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          customName: 'User Admin Endpoint',
          totalVolume: 100,
        })
        .expect(401);
    });

    it('should allow user to view containers', async () => {
      await request(app.getHttpServer())
        .get('/containers')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should allow user to view items', async () => {
      await request(app.getHttpServer())
        .get('/items')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should deny user to create items', async () => {
      const container = await request(app.getHttpServer())
        .post('/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Container for Auth Test',
          totalVolume: 100,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          uniqueNumber: 'AUTH-ITEM-001',
          name: 'Auth Test Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: container.body.id,
        })
        .expect(401);
    });
  });
});