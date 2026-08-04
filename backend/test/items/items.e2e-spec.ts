// test/items/items.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { getApp, getAuthToken } from '../setup';

interface ItemResponse {
  id: string;
  uniqueNumber: string;
  name: string;
  containerId: string;
  deletedAt: string | null;
  deletedByContainer: boolean;
  createdAt: string;
  photo?: string | null;
  packageQuantity: number;
  productsPerPackage: number;
  packagePrice: string | number;
  volume: string | number;
  totalVolume: string | number;
}

const createSuffix = (): string => randomUUID().replace(/-/g, '').slice(0, 12);

const createUniqueNumber = (prefix: string): string => {
  const normalizedPrefix = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 25);
  return `${normalizedPrefix}-${createSuffix()}`;
};

describe('Items E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let containerId: string;
  let testItemId: string;

  beforeAll(async () => {
    app = getApp();
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'Password@123');

    const uniqueContainerName = `Item Test Container ${createSuffix()}`;
    const container = await request(app.getHttpServer())
      .post('/v1/containers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customName: uniqueContainerName,
        totalVolume: 500,
        description: 'Container for E2E item tests',
      })
      .expect(201);

    containerId = container.body.id;
  });

  afterAll(async () => {
    if (!containerId) {
      return;
    }

    const softDeleteResponse = await request(app.getHttpServer())
      .delete(`/v1/containers/${containerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (softDeleteResponse.status !== 204 && softDeleteResponse.status !== 404) {
      console.warn(
        `Container cleanup failed: ${softDeleteResponse.status}`,
        softDeleteResponse.body,
      );
      return;
    }

    if (softDeleteResponse.status === 204) {
      const permanentResponse = await request(app.getHttpServer())
        .delete(`/v1/containers/${containerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (permanentResponse.status !== 204 && permanentResponse.status !== 404) {
        console.warn(
          `Permanent cleanup failed: ${permanentResponse.status}`,
          permanentResponse.body,
        );
      }
    }
  });

  // ================================================================
  // CREATE ITEM
  // ================================================================
  describe('POST /v1/items', () => {
    it('should create an item with all fields', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-E2E');

      const response = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Test Item Full',
          photo: 'http://localhost:3000/uploads/items/photos/test-photo.jpg',
          packageQuantity: 5,
          productsPerPackage: 10,
          packagePrice: 100.5,
          volume: 2.5,
          containerId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.uniqueNumber).toBe(uniqueNumber);
      expect(response.body.name).toBe('Test Item Full');
      expect(response.body.photo).toBe('http://localhost:3000/uploads/items/photos/test-photo.jpg');
      expect(response.body.packageQuantity).toBe(5);
      expect(response.body.productsPerPackage).toBe(10);
      expect(Number(response.body.packagePrice)).toBe(100.5);
      expect(Number(response.body.volume)).toBe(2.5);
      expect(Number(response.body.totalVolume)).toBe(12.5);
      expect(response.body.containerId).toBe(containerId);
      testItemId = response.body.id;
      expect(typeof testItemId).toBe('string');
    });

    it('should trim item text fields', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-TRIM');
      const response = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `  ${uniqueNumber}  `,
          name: '  Trimmed Item Name  ',
          photo: '  http://localhost:3000/uploads/items/photos/trimmed.jpg  ',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      expect(response.body.uniqueNumber).toBe(uniqueNumber);
      expect(response.body.name).toBe('Trimmed Item Name');
      expect(response.body.photo).toBe('http://localhost:3000/uploads/items/photos/trimmed.jpg');
    });

    it('should create an item without photo', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-NO-PHOTO');
      const response = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item Without Photo',
          packageQuantity: 3,
          productsPerPackage: 5,
          packagePrice: 50.0,
          volume: 1.0,
          containerId,
        })
        .expect(201);

      expect(response.body.photo == null).toBe(true);
      expect(Number(response.body.totalVolume)).toBe(3);
    });

    it('should fail to create with user role', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-USER');
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          uniqueNumber,
          name: 'Forbidden Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(403);
    });

    it('should reject creation in an archived container', async () => {
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Archived Item Container ${createSuffix()}`,
          totalVolume: 100,
        })
        .expect(201);
      const tempContainerId = container.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/containers/${tempContainerId}/status?status=archived`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-ARCHIVED'),
          name: 'Archived Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail without token', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-NO-TOKEN');
      await request(app.getHttpServer())
        .post('/v1/items')
        .send({
          uniqueNumber,
          name: 'No Token Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(401);
    });

    it('should fail with duplicate uniqueNumber', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-DUP');
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Original Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Duplicate Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(409);
    });

    it('should fail if volume exceeds container capacity', async () => {
      const smallContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Small Container ${createSuffix()}`,
          totalVolume: 1,
        })
        .expect(201);
      const tempContainerId = smallContainer.body.id;

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-TOO-LARGE'),
          name: 'Too Large Item',
          packageQuantity: 10,
          productsPerPackage: 10,
          packagePrice: 100,
          volume: 10,
          containerId: tempContainerId,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail with non-existent containerId', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-NO-CONT'),
          name: 'Invalid Container',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: '123e4567-e89b-42d3-a456-426614174000',
        })
        .expect(404);
    });

    it('should fail with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Fields',
          containerId,
        })
        .expect(400);
    });

    it('should fail with negative packageQuantity', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-NEGATIVE'),
          name: 'Negative Quantity',
          packageQuantity: -5,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(400);
    });

    it('should fail when packageQuantity is not an integer', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-DECIMAL-QTY'),
          name: 'Decimal Quantity',
          packageQuantity: 1.5,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(400);
    });

    it('should fail when packagePrice has more than 2 decimal places', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-PRICE-PRECISION'),
          name: 'Price Precision',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10.123,
          volume: 1,
          containerId,
        })
        .expect(400);
    });

    it('should fail when volume has more than 2 decimal places', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-VOLUME-PRECISION'),
          name: 'Volume Precision',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1.123,
          containerId,
        })
        .expect(400);
    });

    it('should fail with zero volume', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-ZERO-VOL'),
          name: 'Zero Volume',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 0,
          containerId,
        })
        .expect(400);
    });

    it('should fail with negative volume', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-NEGATIVE-VOL'),
          name: 'Negative Volume',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: -1,
          containerId,
        })
        .expect(400);
    });
  });

  // ================================================================
  // GET ALL ITEMS
  // ================================================================
  describe('GET /v1/items', () => {
    it('should return all items', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('hasMore');
    });

    it('should reject unknown query parameters', async () => {
      await request(app.getHttpServer())
        .get('/v1/items?unknown=value')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should filter items by containerId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items?containerId=${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        response.body.data.every((item: ItemResponse) => item.containerId === containerId),
      ).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items?limit=2&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should sort by name ASC', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items?sort=name:ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const names = (response.body.data as ItemResponse[]).map((item) => item.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });

    it('should sort by createdAt DESC', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items?sort=createdAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const timestamps = (response.body.data as ItemResponse[]).map((item) =>
        new Date(item.createdAt).getTime(),
      );
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should include deleted items when includeDeleted=true', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-DEL-LIST');
      const itemToDelete = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item for Deleted List',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemToDelete.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(
          `/v1/items?containerId=${containerId}&includeDeleted=true&limit=100&sort=deletedAt:DESC`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('hasMore');
      expect(
        (response.body.data as ItemResponse[]).some(
          (item) => item.id === itemToDelete.body.id && item.deletedAt !== null,
        ),
      ).toBe(true);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/items').expect(401);
    });
  });

  // ================================================================
  // GET DELETED ITEMS
  // ================================================================
  describe('GET /v1/items/deleted', () => {
    let itemForDeletedId: string;

    beforeAll(async () => {
      const uniqueNumber = createUniqueNumber('ITEM-DEL-API');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item for Deleted API',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);
      itemForDeletedId = item.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemForDeletedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should return deleted items (admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items/deleted?limit=100&sort=deletedAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('hasMore');
      expect(
        (response.body.data as ItemResponse[]).some((item) => item.id === itemForDeletedId),
      ).toBe(true);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/deleted')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/items/deleted').expect(401);
    });
  });

  // ================================================================
  // GET ITEM BY ID
  // ================================================================
  describe('GET /v1/items/:id', () => {
    it('should get item by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items/${testItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(testItemId);
      expect(response.body).toHaveProperty('container');
      expect(response.body.container.id).toBe(containerId);
    });

    it('should reject invalid includeDeleted value', async () => {
      await request(app.getHttpServer())
        .get(`/v1/items/${testItemId}?includeDeleted=invalid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should get deleted item with includeDeleted=true', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-GET-DELETED');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Get Deleted Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const itemId = item.body.id;
      await request(app.getHttpServer())
        .delete(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/v1/items/${itemId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(itemId);
      expect(response.body.deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get(`/v1/items/${testItemId}`).expect(401);
    });
  });

  // ================================================================
  // SEARCH ITEMS
  // ================================================================
  describe('GET /v1/items/search', () => {
    it('should search items by name', async () => {
      const searchTerm = `SearchName-${createSuffix()}`;
      const created = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-SEARCH-NAME'),
          name: searchTerm,
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${encodeURIComponent(searchTerm)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        (response.body.data as ItemResponse[]).some((item) => item.id === created.body.id),
      ).toBe(true);
    });

    it('should search items by uniqueNumber', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-SEARCH');
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Search By Unique Number',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${uniqueNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        (response.body.data as ItemResponse[]).some((item) => item.uniqueNumber === uniqueNumber),
      ).toBe(true);
    });

    it('should search items in specific container', async () => {
      const searchTerm = `ContainerSearch-${createSuffix()}`;
      const created = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-CSEARCH'),
          name: searchTerm,
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${encodeURIComponent(searchTerm)}&containerId=${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        (response.body.data as ItemResponse[]).some((item) => item.id === created.body.id),
      ).toBe(true);
      expect(
        (response.body.data as ItemResponse[]).every((item) => item.containerId === containerId),
      ).toBe(true);
    });

    it('should return empty array for non-existent search', async () => {
      const missingQuery = `Missing-${createSuffix()}`;
      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${encodeURIComponent(missingQuery)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(0);
    });

    it('should reject a search query longer than 200 characters', async () => {
      const query = 'a'.repeat(201);
      await request(app.getHttpServer())
        .get(`/v1/items/search?query=${query}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should reject unknown query parameters in search', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/search?query=test&unknown=value')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with empty query', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/search?query=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with missing query', async () => {
      await request(app.getHttpServer())
        .get('/v1/items/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should paginate search results', async () => {
      const searchTerm = `Pagination-${createSuffix()}`;

      for (let index = 0; index < 2; index += 1) {
        await request(app.getHttpServer())
          .post('/v1/items')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            uniqueNumber: createUniqueNumber('ITEM-PAGE'),
            name: `${searchTerm}-${index}`,
            packageQuantity: 1,
            productsPerPackage: 1,
            packagePrice: 10,
            volume: 1,
            containerId,
          })
          .expect(201);
      }

      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${encodeURIComponent(searchTerm)}&limit=1&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(true);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/items/search?query=Test').expect(401);
    });
  });

  // ================================================================
  // UPDATE ITEM
  // ================================================================
  describe('PUT /v1/items/:id', () => {
    let updateItemId: string;

    beforeAll(async () => {
      const uniqueNumber = createUniqueNumber('ITEM-UPDATE');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item to Update',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);
      updateItemId = item.body.id;
    });

    it('should update item name', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Item Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Item Name');
    });

    it('should update item price', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          packagePrice: 99.99,
        })
        .expect(200);

      expect(Number(response.body.packagePrice)).toBe(99.99);
    });

    it('should update volume and recalculate totalVolume', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          packageQuantity: 5,
          volume: 2.0,
        })
        .expect(200);

      expect(Number(response.body.totalVolume)).toBe(10);
    });

    it('should update multiple fields', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Multi Update',
          packagePrice: 150.0,
          packageQuantity: 3,
          volume: 1.5,
        })
        .expect(200);

      expect(response.body.name).toBe('Multi Update');
      expect(Number(response.body.packagePrice)).toBe(150.0);
      expect(response.body.packageQuantity).toBe(3);
      expect(Number(response.body.volume)).toBe(1.5);
      expect(Number(response.body.totalVolume)).toBe(4.5);
    });

    it('should reject updating to a duplicate unique number', async () => {
      const firstNumber = createUniqueNumber('ITEM-FIRST');
      const secondNumber = createUniqueNumber('ITEM-SECOND');

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: firstNumber,
          name: 'First Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: secondNumber,
          name: 'Second Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/v1/items/${second.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: firstNumber,
        })
        .expect(409);
    });

    it('should reject updating an item in an inactive container', async () => {
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Inactive Update Container ${createSuffix()}`,
          totalVolume: 100,
        })
        .expect(201);
      const tempContainerId = container.body.id;

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-INACTIVE'),
          name: 'Inactive Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/containers/${tempContainerId}/status?status=archived`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Update in Inactive Container',
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail to update item with insufficient volume', async () => {
      const smallContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Small Container for Update ${createSuffix()}`,
          totalVolume: 2,
        })
        .expect(201);
      const tempContainerId = smallContainer.body.id;

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-SMALL-UPDATE'),
          name: 'Small Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          packageQuantity: 10,
          volume: 1,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .put(`/v1/items/${updateItemId}`)
        .send({
          name: 'No Token',
        })
        .expect(401);
    });

    it('should fail for non-existent item', async () => {
      await request(app.getHttpServer())
        .put('/v1/items/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non Existent',
        })
        .expect(404);
    });

    it('should reject invalid UUID for update', async () => {
      await request(app.getHttpServer())
        .put('/v1/items/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid UUID',
        })
        .expect(400);
    });
  });

  // ================================================================
  // SOFT DELETE ITEM
  // ================================================================
  describe('DELETE /v1/items/:id (soft delete)', () => {
    it('should soft delete an item and expose it only with includeDeleted', async () => {
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-SOFT-DELETE'),
          name: 'Item to Soft Delete',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      const itemId = item.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const deletedItem = await request(app.getHttpServer())
        .get(`/v1/items/${itemId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deletedItem.body.deletedAt).not.toBeNull();
      expect(deletedItem.body.deletedByContainer).toBe(false);
    });

    it('should fail with user role', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-DELETE-USER');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'User Delete Attempt',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to soft delete without token', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-DELETE-NO-TOKEN');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'No Token Delete',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer()).delete(`/v1/items/${item.body.id}`).expect(401);
    });

    it('should fail to soft delete non-existent item', async () => {
      await request(app.getHttpServer())
        .delete('/v1/items/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject invalid UUID for soft delete', async () => {
      await request(app.getHttpServer())
        .delete('/v1/items/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // RESTORE ITEM
  // ================================================================
  describe('PUT /v1/items/:id/restore', () => {
    it('should restore a soft-deleted item and find it normally', async () => {
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-RESTORE'),
          name: 'Item to Restore',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const restored = await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(restored.body.deletedAt).toBeNull();

      await request(app.getHttpServer())
        .get(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should fail to restore an item that was not soft-deleted', async () => {
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-ACTIVE-RESTORE'),
          name: 'Active Restore',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should reject restoring an item deleted with its container', async () => {
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Cascade Restore ${createSuffix()}`,
          totalVolume: 100,
        })
        .expect(201);
      const tempContainerId = container.body.id;

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-CASCADE'),
          name: 'Cascade Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail to restore an item when its container is deleted', async () => {
      const temporaryContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Deleted Container Restore ${createSuffix()}`,
          totalVolume: 20,
        })
        .expect(201);
      const tempContainerId = temporaryContainer.body.id;

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-DELETED-CONTAINER'),
          name: 'Deleted Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should reject restore when container has insufficient volume', async () => {
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Restore Capacity ${createSuffix()}`,
          totalVolume: 2,
        })
        .expect(201);
      const tempContainerId = container.body.id;

      const firstItem = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-RCAP-A'),
          name: 'Restore Capacity A',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${firstItem.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-RCAP-B'),
          name: 'Restore Capacity B',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 2,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/v1/items/${firstItem.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail with user role', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-RESTORE-USER');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'User Restore Attempt',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to restore without token', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-RESTORE-NO-TOKEN');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Restore No Token',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer()).put(`/v1/items/${item.body.id}/restore`).expect(401);
    });

    it('should fail to restore non-existent item', async () => {
      await request(app.getHttpServer())
        .put('/v1/items/00000000-0000-4000-8000-000000000000/restore')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject invalid UUID for restore', async () => {
      await request(app.getHttpServer())
        .put('/v1/items/not-a-uuid/restore')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // PERMANENT DELETE ITEM
  // ================================================================
  describe('DELETE /v1/items/:id/permanent', () => {
    it('should reject permanent deletion of an active item', async () => {
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-ACTIVE-PERM'),
          name: 'Active Permanent Delete',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should reject permanent deletion of an item deleted with its container', async () => {
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Container For Cascade Perm ${createSuffix()}`,
          totalVolume: 50,
        })
        .expect(201);
      const tempContainerId = container.body.id;

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: createUniqueNumber('ITEM-CASCADE-PERM'),
          name: 'Cascade Perm Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: tempContainerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${tempContainerId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should permanently delete an item and no longer find it', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-PERM');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item to Permanent Delete',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);
      const itemId = item.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/items/${itemId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with user role', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-PERM-USER');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'User Permanent Attempt',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}/permanent`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to permanent delete without token', async () => {
      const uniqueNumber = createUniqueNumber('ITEM-PERM-NO-TOKEN');
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Perm No Token',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer()).delete(`/v1/items/${item.body.id}/permanent`).expect(401);
    });

    it('should fail to permanent delete non-existent item', async () => {
      await request(app.getHttpServer())
        .delete('/v1/items/00000000-0000-4000-8000-000000000000/permanent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject invalid UUID for permanent delete', async () => {
      await request(app.getHttpServer())
        .delete('/v1/items/not-a-uuid/permanent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
