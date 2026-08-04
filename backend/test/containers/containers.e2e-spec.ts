// test/containers/containers.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { getApp, getAuthToken } from '../setup';

interface ContainerResponse {
  id: string;
  name: string;
  containerCode: string;
  status: string;
  totalVolume: string | number;
  usedVolume: string | number;
  deletedAt: string | null;
  createdAt: string;
  description?: string;
}

describe('Containers E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let testContainerId: string;
  let deletedContainerId: string;

  const createDeletedContainer = async (): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/v1/containers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customName: `Deleted Fixture ${randomUUID()}`,
        totalVolume: 18,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/containers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    return created.body.id;
  };

  beforeAll(async () => {
    app = getApp();
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'Password@123');

    const suffix = randomUUID();
    const response = await request(app.getHttpServer())
      .post('/v1/containers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customName: `Shared Container ${suffix}`,
        totalVolume: 100,
        description: 'Shared E2E fixture',
      })
      .expect(201);

    testContainerId = response.body.id;
  });

  // ================================================================
  // CREATE CONTAINER
  // ================================================================
  describe('POST /v1/containers', () => {
    it('should create a container (admin)', async () => {
      const uniqueName = `Test Container E2E ${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 100,
          description: 'Created during E2E test',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(uniqueName);
      expect(Number(response.body.totalVolume)).toBe(100);
      expect(response.body.status).toBe('active');
      expect(response.body.containerCode).toBeDefined();
      expect(Number(response.body.totalVolume) - Number(response.body.usedVolume)).toBe(100);
      expect(Number(response.body.usedVolume)).toBe(0);
    });

    it('should trim container name and description', async () => {
      const uniqueName = `Trimmed Container ${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `  ${uniqueName}  `,
          totalVolume: 10,
          description: '  Trimmed description  ',
        })
        .expect(201);

      expect(response.body.name).toBe(uniqueName);
      expect(response.body.description).toBe('Trimmed description');
    });

    it('should create a container with only required fields', async () => {
      const uniqueName = `Minimal Container ${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 50,
        })
        .expect(201);

      expect(response.body.name).toBe(uniqueName);
      expect(Number(response.body.totalVolume)).toBe(50);
      expect(response.body.description).toBe('');
    });

    it('should reject a duplicate container name', async () => {
      const uniqueName = `Duplicate Container ${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 10,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName.toUpperCase(),
          totalVolume: 20,
        })
        .expect(409);
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          customName: 'User Container',
          totalVolume: 50,
        })
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .send({
          customName: 'No Token Container',
          totalVolume: 100,
        })
        .expect(401);
    });

    it('should fail with negative volume', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Negative Volume',
          totalVolume: -10,
        })
        .expect(400);
    });

    it('should fail with zero volume', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Zero Volume',
          totalVolume: 0,
        })
        .expect(400);
    });

    it('should accept a volume with at most two decimal places', async () => {
      const uniqueName = `Decimal Volume ${randomUUID()}`;

      const response = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 10.25,
        })
        .expect(201);

      expect(Number(response.body.totalVolume)).toBe(10.25);
    });

    it('should reject a volume with more than two decimal places', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Invalid Decimal ${randomUUID()}`,
          totalVolume: 10.123,
        })
        .expect(400);
    });

    it('should reject unknown fields', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Unknown Field ${randomUUID()}`,
          totalVolume: 10,
          unknownField: true,
        })
        .expect(400);
    });

    it('should fail with missing name', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          totalVolume: 100,
        })
        .expect(400);
    });

    it('should fail with missing volume', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: 'Missing Volume',
        })
        .expect(400);
    });

    it('should fail with empty name', async () => {
      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: '',
          totalVolume: 100,
        })
        .expect(400);
    });
  });

  // ================================================================
  // GET ALL CONTAINERS
  // ================================================================
  describe('GET /v1/containers', () => {
    it('should return containers (admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers')
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
      expect(typeof response.body.hasMore).toBe('boolean');
    });

    it('should return containers (user)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by status (active)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((c: ContainerResponse) => c.status === 'active')).toBe(true);
    });

    it('should filter by status (archived)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers?status=archived')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((c: ContainerResponse) => c.status === 'archived')).toBe(
        true,
      );
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers?limit=2&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('hasMore');
      expect(typeof response.body.hasMore).toBe('boolean');
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should sort by createdAt DESC', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers?sort=createdAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const first = new Date((response.body.data[0] as ContainerResponse).createdAt).getTime();
        const second = new Date((response.body.data[1] as ContainerResponse).createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should sort by name ASC', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers?sort=name:ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const first = (response.body.data[0] as ContainerResponse).name;
        const second = (response.body.data[1] as ContainerResponse).name;
        expect(first.localeCompare(second)).toBeLessThanOrEqual(0);
      }
    });

    it('should include deleted containers', async () => {
      const uniqueName = `To Be Deleted ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 30,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${container.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const deletedCheck = await request(app.getHttpServer())
        .get(`/v1/containers/${container.body.id}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(deletedCheck.body.deletedAt).not.toBeNull();

      const response = await request(app.getHttpServer())
        .get('/v1/containers?includeDeleted=true&limit=100&sort=deletedAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (response.body.data as ContainerResponse[]).some(
        (c) => c.id === container.body.id && c.deletedAt !== null,
      );
      expect(found).toBe(true);
    });

    it('should fail with invalid status', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers?status=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // GET ACTIVE CONTAINERS
  // ================================================================
  describe('GET /v1/containers/active', () => {
    it('should return active containers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((c: ContainerResponse) => c.status === 'active')).toBe(true);
    });

    it('should return an array of active containers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should paginate active containers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers/active?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  // ================================================================
  // GET ARCHIVED CONTAINERS
  // ================================================================
  describe('GET /v1/containers/archived', () => {
    it('should return archived containers', async () => {
      const uniqueName = `To Be Archived ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 20,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/containers/${container.body.id}/status?status=archived`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/v1/containers/archived')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        (response.body.data as ContainerResponse[]).some((c) => c.id === container.body.id),
      ).toBe(true);
    });

    it('should return an array of archived containers', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/containers/archived')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ================================================================
  // GET DELETED CONTAINERS
  // ================================================================
  describe('GET /v1/containers/deleted', () => {
    it('should return deleted containers (admin)', async () => {
      const uniqueName = `For Deleted List ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 25,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${container.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const deletedCheck = await request(app.getHttpServer())
        .get(`/v1/containers/${container.body.id}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(deletedCheck.body.deletedAt).not.toBeNull();

      const response = await request(app.getHttpServer())
        .get('/v1/containers/deleted?limit=100&sort=deletedAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (response.body.data as ContainerResponse[]).some(
        (c) => c.id === container.body.id,
      );
      expect(found).toBe(true);
      deletedContainerId = container.body.id;
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers/deleted')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/containers/deleted').expect(401);
    });
  });

  // ================================================================
  // SEARCH CONTAINERS
  // ================================================================
  describe('GET /v1/containers/search', () => {
    it('should search containers by name', async () => {
      const uniqueName = `SearchName-${randomUUID()}`;

      const created = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 10,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/search?query=${encodeURIComponent(uniqueName)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        (response.body.data as ContainerResponse[]).some(
          (container) => container.id === created.body.id,
        ),
      ).toBe(true);
    });

    it('should search containers by containerCode', async () => {
      const uniqueName = `Search Code Test ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 10,
        })
        .expect(201);

      const code = container.body.containerCode;

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/search?query=${encodeURIComponent(code)}&limit=100`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (response.body.data as ContainerResponse[]).some(
        (c) => c.id === container.body.id,
      );
      expect(found).toBe(true);
    });

    it('should return empty array for non-existent search', async () => {
      const missingQuery = `Missing-${randomUUID()}`;

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/search?query=${encodeURIComponent(missingQuery)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should fail with empty query', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers/search?query=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with missing query', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should paginate search results', async () => {
      const prefix = `PaginationSearch-${randomUUID()}`;

      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `${prefix}-A`,
          totalVolume: 10,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `${prefix}-B`,
          totalVolume: 10,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/search?query=${encodeURIComponent(prefix)}&limit=1&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
      expect(response.body.limit).toBe(1);
      expect(response.body.offset).toBe(0);
    });
  });

  // ================================================================
  // GET CONTAINER BY ID
  // ================================================================
  describe('GET /v1/containers/:id', () => {
    it('should get container by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(testContainerId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('totalVolume');
      expect(response.body).toHaveProperty('usedVolume');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('containerCode');
      expect(response.body).toHaveProperty('createdBy');
    });

    it('should get container with includeDeleted=true for deleted container', async () => {
      if (!deletedContainerId) {
        const uniqueName = `For Include Deleted Test ${randomUUID()}`;
        const container = await request(app.getHttpServer())
          .post('/v1/containers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            customName: uniqueName,
            totalVolume: 15,
          })
          .expect(201);
        deletedContainerId = container.body.id;

        await request(app.getHttpServer())
          .delete(`/v1/containers/${deletedContainerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);
      }

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/${deletedContainerId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(deletedContainerId);
      expect(response.body.deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent container', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/v1/containers/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // UPDATE CONTAINER (PATCH)
  // ================================================================
  describe('PATCH /v1/containers/:id', () => {
    it('should update a container', async () => {
      const updatedName = `Updated Container ${randomUUID()}`;

      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: updatedName,
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.name).toBe(updatedName);
      expect(response.body.description).toBe('Updated description');
    });

    it('should update only name', async () => {
      const updatedName = `Name Only Update ${randomUUID()}`;

      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: updatedName,
        })
        .expect(200);

      expect(response.body.name).toBe(updatedName);
    });

    it('should update only description', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Description only update',
        })
        .expect(200);

      expect(response.body.description).toBe('Description only update');
    });

    it('should update total volume', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          totalVolume: 150,
        })
        .expect(200);

      expect(Number(response.body.totalVolume)).toBe(150);
    });

    it('should reject total volume below used volume', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Volume Guard ${randomUUID()}`,
          totalVolume: 100,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `VOL-${randomUUID()}`,
          name: 'Volume item',
          packageQuantity: 2,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 20,
          containerId: created.body.id,
        })
        .expect(201);

      const containerAfterItem = await request(app.getHttpServer())
        .get(`/v1/containers/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Number(containerAfterItem.body.usedVolume)).toBe(40);

      await request(app.getHttpServer())
        .patch(`/v1/containers/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          totalVolume: 30,
        })
        .expect(400);
    });

    it('should reject updating to a duplicate name', async () => {
      const suffix = randomUUID();

      const first = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Duplicate-A-${suffix}`,
          totalVolume: 10,
        })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Duplicate-B-${suffix}`,
          totalVolume: 10,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/containers/${second.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: first.body.name,
        })
        .expect(409);
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/containers/${testContainerId}`)
        .send({
          name: 'No Token',
        })
        .expect(401);
    });

    it('should fail for non-existent container', async () => {
      await request(app.getHttpServer())
        .patch('/v1/containers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non Existent',
        })
        .expect(404);
    });

    it('should reject invalid UUID for PATCH', async () => {
      await request(app.getHttpServer())
        .patch('/v1/containers/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid UUID',
        })
        .expect(400);
    });
  });

  // ================================================================
  // UPDATE CONTAINER STATUS (PATCH)
  // ================================================================
  describe('PATCH /v1/containers/:id/status', () => {
    let statusContainerId: string;

    beforeAll(async () => {
      const uniqueName = `Status Test Container ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 15,
        })
        .expect(201);
      statusContainerId = container.body.id;
    });

    it('should update status to archived', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status?status=archived`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('archived');
    });

    it('should update status back to active', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status?status=active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should update status to shipped', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status?status=shipped`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('shipped');
    });

    it('should fail with invalid status', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status?status=invalid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with missing status', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/containers/${statusContainerId}/status?status=archived`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject invalid UUID for status update', async () => {
      await request(app.getHttpServer())
        .patch('/v1/containers/not-a-uuid/status?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // SOFT DELETE CONTAINER
  // ================================================================
  describe('DELETE /v1/containers/:id (soft delete)', () => {
    let containerToDeleteId: string;

    beforeAll(async () => {
      const uniqueName = `Soft Delete ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 12,
        })
        .expect(201);
      containerToDeleteId = container.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/containers/${containerToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should soft delete an empty container', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Soft Delete Endpoint ${randomUUID()}`,
          totalVolume: 12,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should not find deleted container in normal GET', async () => {
      await request(app.getHttpServer())
        .get(`/v1/containers/${containerToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should find deleted container with includeDeleted=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/containers/${containerToDeleteId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(containerToDeleteId);
      expect(response.body.deletedAt).not.toBeNull();
    });

    it('should soft delete a container together with its items', async () => {
      const uniqueName = `Container With Items ${randomUUID()}`;

      const containerResponse = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 500,
        })
        .expect(201);

      const containerId = containerResponse.body.id as string;

      const itemResponse = await request(app.getHttpServer())
        .post('/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          uniqueNumber: `ITEM-${randomUUID()}`,
          name: 'Container delete item',
          packageQuantity: 2,
          productsPerPackage: 1,
          packagePrice: 10,
          volume: 20,
          containerId,
        })
        .expect(201);

      const itemId = itemResponse.body.id as string;

      await request(app.getHttpServer())
        .delete(`/v1/containers/${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/containers/${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const deletedContainerResponse = await request(app.getHttpServer())
        .get(`/v1/containers/${containerId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deletedContainerResponse.body.deletedAt).not.toBeNull();

      const deletedItemResponse = await request(app.getHttpServer())
        .get(`/v1/items/${itemId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deletedItemResponse.body.deletedAt).not.toBeNull();
      expect(deletedItemResponse.body.deletedByContainer).toBe(true);
      expect(deletedItemResponse.body.containerId).toBe(containerId);
    });

    it('should fail to soft delete for user role', async () => {
      const uniqueName = `User Delete Attempt ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 30,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${container.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to soft delete without token', async () => {
      const uniqueName = `No Token Delete ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 30,
        })
        .expect(201);

      await request(app.getHttpServer()).delete(`/v1/containers/${container.body.id}`).expect(401);
    });

    it('should reject invalid UUID for DELETE', async () => {
      await request(app.getHttpServer())
        .delete('/v1/containers/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // RESTORE CONTAINER (PUT)
  // ================================================================
  describe('PUT /v1/containers/:id/restore', () => {
    it('should restore a soft-deleted container', async () => {
      const containerId = await createDeletedContainer();

      const response = await request(app.getHttpServer())
        .put(`/v1/containers/${containerId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(containerId);
      expect(response.body.deletedAt).toBeNull();
    });

    it('should find restored container in normal GET', async () => {
      const containerId = await createDeletedContainer();

      await request(app.getHttpServer())
        .put(`/v1/containers/${containerId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/v1/containers/${containerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.deletedAt).toBeNull();
    });

    it('should fail to restore non-deleted container', async () => {
      const uniqueName = `Not Deleted Restore ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 18,
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/v1/containers/${container.body.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail to restore for user role', async () => {
      const containerId = await createDeletedContainer();

      await request(app.getHttpServer())
        .put(`/v1/containers/${containerId}/restore`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to restore non-existent container', async () => {
      await request(app.getHttpServer())
        .put('/v1/containers/00000000-0000-4000-8000-000000000000/restore')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject invalid UUID for restore', async () => {
      await request(app.getHttpServer())
        .put('/v1/containers/not-a-uuid/restore')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // PERMANENT DELETE CONTAINER
  // ================================================================
  describe('DELETE /v1/containers/:id/permanent', () => {
    it('should reject permanent deletion of an active container', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Active Permanent ${randomUUID()}`,
          totalVolume: 20,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${created.body.id}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should permanently delete a container and no longer find it', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: `Permanent Delete ${randomUUID()}`,
          totalVolume: 22,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${created.body.id}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/containers/${created.body.id}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail to permanently delete for user role', async () => {
      const uniqueName = `User Permanent Delete ${randomUUID()}`;
      const container = await request(app.getHttpServer())
        .post('/v1/containers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customName: uniqueName,
          totalVolume: 25,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${container.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/v1/containers/${container.body.id}/permanent`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail to permanently delete non-existent container', async () => {
      await request(app.getHttpServer())
        .delete('/v1/containers/00000000-0000-4000-8000-000000000000/permanent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject invalid UUID for permanent delete', async () => {
      await request(app.getHttpServer())
        .delete('/v1/containers/not-a-uuid/permanent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
