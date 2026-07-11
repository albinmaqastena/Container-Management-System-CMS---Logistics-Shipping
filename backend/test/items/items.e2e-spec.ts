// test/items/items.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp, getAuthToken } from '../setup';

describe('Items E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let containerId: string;
  let testItemId: string;
  let deletedItemId: string;

  beforeAll(async () => {
    app = getApp();
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');

    // ✅ Use unique name to avoid conflicts
    const uniqueContainerName = `Item Test Container ${Date.now()}`;
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
    if (containerId) {
      await request(app.getHttpServer())
        .delete(`/v1/containers/${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    }
  });

  // ================================================================
  // CREATE ITEM
  // ================================================================
  describe('POST /v1/items', () => {
    it('should create an item with all fields', async () => {
      const uniqueNumber = `ITEM-E2E-${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Test Item Full',
          photo: 'https://example.com/photo.jpg',
          packageQuantity: 5,
          productsPerPackage: 10,
          packagePrice: 100.5,
          volume: 2.5,
          containerId: containerId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.uniqueNumber).toBe(uniqueNumber);
      expect(response.body.name).toBe('Test Item Full');
      expect(response.body.photo).toBe('https://example.com/photo.jpg');
      expect(response.body.packageQuantity).toBe(5);
      expect(response.body.productsPerPackage).toBe(10);
      expect(Number(response.body.packagePrice)).toBe(100.5);
      expect(Number(response.body.volume)).toBe(2.5);
      expect(Number(response.body.totalVolume)).toBe(12.5);
      expect(response.body.containerId).toBe(containerId);
      testItemId = response.body.id;
    });

    it('should trim item text fields', async () => {
      const uniqueNumber = `ITEM-TRIM-${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `  ${uniqueNumber}  `,
          name: '  Trimmed Item Name  ',
          photo: '  https://example.com/photo.jpg  ',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId,
        })
        .expect(201);

      expect(response.body.uniqueNumber).toBe(uniqueNumber);
      expect(response.body.name).toBe('Trimmed Item Name');
      expect(response.body.photo).toBe('https://example.com/photo.jpg');
    });

    it('should create an item without photo', async () => {
      const uniqueNumber = `ITEM-NO-PHOTO-${Date.now()}`;
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
          containerId: containerId,
        })
        .expect(201);

      // ✅ photo should be null or undefined
      expect(response.body.photo == null).toBe(true);
      expect(Number(response.body.totalVolume)).toBe(3);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .send({
          uniqueNumber: 'ITEM-NO-TOKEN',
          name: 'No Token Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: containerId,
        })
        .expect(401);
    });

    it('should fail with duplicate uniqueNumber', async () => {
      const uniqueNumber = `ITEM-DUP-${Date.now()}`;
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
          containerId: containerId,
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
          containerId: containerId,
        })
        .expect(409);
    });

    it('should fail if volume exceeds container capacity', async () => {
      const smallContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Small Container ${Date.now()}`,
          totalVolume: 1,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-TOO-LARGE-${Date.now()}`,
          name: 'Too Large Item',
          packageQuantity: 10,
          productsPerPackage: 10,
          packagePrice: 100,
          volume: 10,
          containerId: smallContainer.body.id,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${smallContainer.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should fail with invalid containerId', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-INVALID-CONTAINER-${Date.now()}`,
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
          containerId: containerId,
        })
        .expect(400);
    });

    it('should fail with negative packageQuantity', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-NEGATIVE-${Date.now()}`,
          name: 'Negative Quantity',
          packageQuantity: -5,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: containerId,
        })
        .expect(400);
    });

    it('should fail when packageQuantity is not an integer', async () => {
      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-DECIMAL-QTY-${Date.now()}`,
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
          uniqueNumber: `ITEM-PRICE-PRECISION-${Date.now()}`,
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
          uniqueNumber: `ITEM-VOLUME-PRECISION-${Date.now()}`,
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
          uniqueNumber: `ITEM-ZERO-VOL-${Date.now()}`,
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
          uniqueNumber: `ITEM-NEGATIVE-VOL-${Date.now()}`,
          name: 'Negative Volume',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: -1,
          containerId: containerId,
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

    it('should filter items by containerId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items?containerId=${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((item: any) => item.containerId === containerId)).toBe(true);
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

      if (response.body.data.length > 1) {
        const first = response.body.data[0].name;
        const second = response.body.data[1].name;
        expect(first.localeCompare(second)).toBeLessThanOrEqual(0);
      }
    });

    it('should sort by createdAt DESC', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items?sort=createdAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const first = new Date(response.body.data[0].createdAt).getTime();
        const second = new Date(response.body.data[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should include deleted items when includeDeleted=true', async () => {
      const uniqueNumber = `ITEM-DELETE-LIST-${Date.now()}`;
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
          containerId: containerId,
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
        response.body.data.some(
          (item: any) => item.id === itemToDelete.body.id && item.deletedAt !== null,
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
      const uniqueNumber = `ITEM-DELETED-API-${Date.now()}`;
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
          containerId: containerId,
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
      expect(response.body.data.some((item: any) => item.id === itemForDeletedId)).toBe(true);
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

    it('should get deleted item with includeDeleted=true', async () => {
      const uniqueNumber = `ITEM-GET-DELETED-${Date.now()}`;
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
          containerId: containerId,
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
      const response = await request(app.getHttpServer())
        .get('/v1/items/search?query=Test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.some((item: any) => item.name.includes('Test'))).toBe(true);
    });

    it('should search items by uniqueNumber', async () => {
      const uniqueNumber = `ITEM-SEARCH-${Date.now()}`;
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
          containerId: containerId,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=${uniqueNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].uniqueNumber).toBe(uniqueNumber);
    });

    it('should search items in specific container', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items/search?query=Test&containerId=${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        response.body.data.every(
          (item: any) => item.containerId === containerId || item.container?.id === containerId,
        ),
      ).toBe(true);
    });

    it('should return empty array for non-existent search', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/items/search?query=NonExistentItemXYZ')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(0);
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
      const response = await request(app.getHttpServer())
        .get('/v1/items/search?query=Test&limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(1);
      expect(response.body).toHaveProperty('hasMore');
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
      const uniqueNumber = `ITEM-UPDATE-${Date.now()}`;
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
          containerId: containerId,
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

    it('should fail to update item with insufficient volume', async () => {
      const smallContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Small Container for Update ${Date.now()}`,
          totalVolume: 2,
        })
        .expect(201);

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-SMALL-UPDATE-${Date.now()}`,
          name: 'Small Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: smallContainer.body.id,
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
        .delete(`/v1/containers/${smallContainer.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
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
  });

  // ================================================================
  // SOFT DELETE ITEM
  // ================================================================
  describe('DELETE /v1/items/:id (soft delete)', () => {
    let itemToSoftDeleteId: string;

    beforeAll(async () => {
      const uniqueNumber = `ITEM-SOFT-DELETE-${Date.now()}`;
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item to Soft Delete',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: containerId,
        })
        .expect(201);
      itemToSoftDeleteId = item.body.id;
    });

    it('should soft delete an item', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/items/${itemToSoftDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should not find deleted item in normal GET', async () => {
      await request(app.getHttpServer())
        .get(`/v1/items/${itemToSoftDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should find deleted item with includeDeleted=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items/${itemToSoftDeleteId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.deletedAt).not.toBeNull();
    });

    it('should fail to soft delete without token', async () => {
      const uniqueNumber = `ITEM-DELETE-NO-TOKEN-${Date.now()}`;
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
          containerId: containerId,
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
  });

  // ================================================================
  // RESTORE ITEM
  // ================================================================
  describe('PUT /v1/items/:id/restore', () => {
    let itemToRestoreId: string;

    beforeAll(async () => {
      const uniqueNumber = `ITEM-RESTORE-${Date.now()}`;
      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber,
          name: 'Item to Restore',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: containerId,
        })
        .expect(201);
      itemToRestoreId = item.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemToRestoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should restore a soft-deleted item', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/items/${itemToRestoreId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(itemToRestoreId);
      expect(response.body.deletedAt).toBeNull();
    });

    it('should find restored item in normal GET', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/items/${itemToRestoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.deletedAt).toBeNull();
    });

    it('should fail to restore non-deleted item', async () => {
      await request(app.getHttpServer())
        .put(`/v1/items/${itemToRestoreId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail to restore an item when its container is deleted', async () => {
      const temporaryContainer = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Deleted Container Restore ${Date.now()}`,
          totalVolume: 20,
        })
        .expect(201);

      const item = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-DELETED-CONTAINER-${Date.now()}`,
          name: 'Deleted Container Item',
          packageQuantity: 1,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 1,
          containerId: temporaryContainer.body.id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${temporaryContainer.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail to restore without token', async () => {
      const uniqueNumber = `ITEM-RESTORE-NO-TOKEN-${Date.now()}`;
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
          containerId: containerId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer()).put(`/v1/items/${item.body.id}/restore`).expect(401);
    });
  });

  // ================================================================
  // PERMANENT DELETE ITEM
  // ================================================================
  describe('DELETE /v1/items/:id/permanent', () => {
    let itemToPermanentDeleteId: string;

    beforeAll(async () => {
      const uniqueNumber = `ITEM-PERM-${Date.now()}`;
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
          containerId: containerId,
        })
        .expect(201);
      itemToPermanentDeleteId = item.body.id;
    });

    it('should permanently delete an item', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/items/${itemToPermanentDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/items/${itemToPermanentDeleteId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should return 404 after permanent delete', async () => {
      await request(app.getHttpServer())
        .get(`/v1/items/${itemToPermanentDeleteId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail to permanent delete without token', async () => {
      const uniqueNumber = `ITEM-PERM-NO-TOKEN-${Date.now()}`;
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
          containerId: containerId,
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
  });
});
