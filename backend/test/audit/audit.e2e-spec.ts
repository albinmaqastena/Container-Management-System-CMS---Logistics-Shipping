// test/audit/audit.e2e-spec.ts

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { getApp, getAuthToken } from '../setup';

describe('Audit E2E', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let userToken: string;

  const nonExistentUuid = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    app = getApp();

    superAdminToken = await getAuthToken('admin@example.com', 'Admin@123');

    userToken = await getAuthToken('testuser@example.com', 'Password@123');
  });

  describe('GET /v1/audit', () => {
    it('should return paginated audit logs for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          data: expect.any(Array),
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
          totalPages: expect.any(Number),
          currentPage: expect.any(Number),
          hasMore: expect.any(Boolean),
        }),
      );
    });

    it('should use default pagination values', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(0);
      expect(response.body.currentPage).toBe(1);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/v1/audit').expect(401);
    });

    it('should filter by a valid user UUID', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit?limit=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const logWithUserId = listResponse.body.data.find(
        (log: { userId?: string | null }) => typeof log.userId === 'string',
      );

      expect(logWithUserId).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/v1/audit?userId=${logWithUserId.userId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);

      expect(
        response.body.data.every(
          (log: { userId?: string | null }) => log.userId === logWithUserId.userId,
        ),
      ).toBe(true);
    });

    it('should return 400 for an invalid userId', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?userId=user-1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should filter by action', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?action=login')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((log: { action: string }) => log.action === 'login')).toBe(
        true,
      );
    });

    it('should return 400 for an invalid action filter', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?action=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?status=success')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((log: { status: string }) => log.status === 'success')).toBe(
        true,
      );
    });

    it('should return 400 for an invalid status', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?status=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should filter by fromDate and toDate', async () => {
      const toDate = new Date(Date.now() + 5000);
      const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (const log of response.body.data) {
        const createdAt = new Date(log.createdAt).getTime();

        expect(createdAt).toBeGreaterThanOrEqual(fromDate.getTime());

        expect(createdAt).toBeLessThanOrEqual(toDate.getTime());
      }
    });

    it('should filter using only fromDate', async () => {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          fromDate: fromDate.toISOString(),
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (const log of response.body.data) {
        expect(new Date(log.createdAt).getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
      }
    });

    it('should filter using only toDate', async () => {
      const toDate = new Date(Date.now() + 5000);

      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          toDate: toDate.toISOString(),
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (const log of response.body.data) {
        expect(new Date(log.createdAt).getTime()).toBeLessThanOrEqual(toDate.getTime());
      }
    });

    it('should return 400 when fromDate is after toDate', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          fromDate: '2026-02-01T00:00:00.000Z',
          toDate: '2026-01-01T00:00:00.000Z',
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          limit: 5,
          offset: 0,
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(0);
      expect(response.body.currentPage).toBe(1);
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 400 for an invalid limit', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?limit=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 for a negative offset', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?offset=-1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 when limit is not an integer', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?limit=5.5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should sort results by createdAt descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          sort: 'createdAt:DESC',
          limit: 50,
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (let index = 1; index < response.body.data.length; index += 1) {
        const prev = response.body.data[index - 1];
        const curr = response.body.data[index];
        const prevDate = new Date(prev.createdAt).getTime();
        const currDate = new Date(curr.createdAt).getTime();

        expect(prevDate).toBeGreaterThanOrEqual(currDate);

        if (prevDate === currDate) {
          expect(prev.id.localeCompare(curr.id)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should use deterministic default sorting', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({ limit: 50 })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (let index = 1; index < response.body.data.length; index += 1) {
        const prev = response.body.data[index - 1];
        const curr = response.body.data[index];
        const prevDate = new Date(prev.createdAt).getTime();
        const currDate = new Date(curr.createdAt).getTime();

        expect(prevDate).toBeGreaterThanOrEqual(currDate);

        if (prevDate === currDate) {
          expect(prev.id.localeCompare(curr.id)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should combine action and status filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          action: 'login',
          status: 'success',
          limit: 100,
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // The beforeAll login should have created at least one login success log
      expect(response.body.data.length).toBeGreaterThan(0);

      for (const log of response.body.data) {
        expect(log.action).toBe('login');
        expect(log.status).toBe('success');
      }
    });

    it('should combine multiple filters (userId + action + status)', async () => {
      // First, get a user with login logs
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit?action=login&limit=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const logWithUserId = listResponse.body.data.find(
        (log: { userId?: string | null }) => typeof log.userId === 'string',
      );

      expect(logWithUserId).toBeDefined();

      if (!logWithUserId) {
        throw new Error('Expected at least one login audit log with userId');
      }

      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          userId: logWithUserId.userId,
          action: 'login',
          status: 'success',
          limit: 100,
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      for (const log of response.body.data) {
        expect(log.userId).toBe(logWithUserId.userId);
        expect(log.action).toBe('login');
        expect(log.status).toBe('success');
      }
    });

    it('should return 400 for an unsupported sort field', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?sort=password:DESC')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 for an invalid sort direction', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?sort=createdAt:INVALID')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid fromDate', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?fromDate=invalid-date')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid toDate', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?toDate=invalid-date')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 for an unknown query parameter', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?unknownField=value')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should calculate the page from offset and limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .query({
          limit: 5,
          offset: 10,
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(10);
      expect(response.body.currentPage).toBe(3);
    });
  });

  describe('GET /v1/audit/stats', () => {
    it('should return audit statistics for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit/stats')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        total: expect.any(Number),
        byAction: expect.any(Object),
        byStatus: expect.any(Object),
        last24h: expect.any(Number),
        last7d: expect.any(Number),
      });

      // Logical consistency checks
      expect(response.body.total).toBeGreaterThanOrEqual(response.body.last24h);
      expect(response.body.total).toBeGreaterThanOrEqual(response.body.last7d);
      expect(response.body.last7d).toBeGreaterThanOrEqual(response.body.last24h);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/v1/audit/stats').expect(401);
    });
  });

  describe('GET /v1/audit/:id', () => {
    it('should return an existing audit log', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit?limit=1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBeGreaterThan(0);

      const logId = listResponse.body.data[0].id;

      const response = await request(app.getHttpServer())
        .get(`/v1/audit/${logId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(logId);
      expect(response.body).toEqual(
        expect.objectContaining({
          action: expect.any(String),
          status: expect.any(String),
          createdAt: expect.any(String),
        }),
      );
    });

    it('should return 404 for a non-existent valid UUID', async () => {
      await request(app.getHttpServer())
        .get(`/v1/audit/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/not-a-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .get(`/v1/audit/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get(`/v1/audit/${nonExistentUuid}`).expect(401);
    });
  });

  describe('GET /v1/audit/users/:userId', () => {
    it('should return audit logs for an existing user ID', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit?limit=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const logWithUserId = listResponse.body.data.find(
        (log: { userId?: string | null }) => typeof log.userId === 'string',
      );

      expect(logWithUserId).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/v1/audit/users/${logWithUserId.userId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);

      expect(
        response.body.data.every(
          (log: { userId?: string | null }) => log.userId === logWithUserId.userId,
        ),
      ).toBe(true);
    });

    it('should return an empty page for a valid unknown user UUID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/audit/users/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(response.body.totalPages).toBe(0);
      expect(response.body.currentPage).toBe(1);
      expect(response.body.hasMore).toBe(false);
    });

    it('should return 400 for an invalid user UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/users/user-1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .get(`/v1/audit/users/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get(`/v1/audit/users/${nonExistentUuid}`).expect(401);
    });

    it('should paginate audit logs by user', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit?limit=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const logWithUserId = listResponse.body.data.find(
        (log: { userId?: string | null }) => typeof log.userId === 'string',
      );

      expect(logWithUserId).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/v1/audit/users/${logWithUserId.userId}`)
        .query({
          limit: 5,
          offset: 0,
          sort: 'createdAt:DESC',
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(0);
      expect(response.body.data.length).toBeLessThanOrEqual(5);

      // Verify that all returned logs belong to the user
      expect(
        response.body.data.every(
          (log: { userId?: string | null }) => log.userId === logWithUserId.userId,
        ),
      ).toBe(true);
    });

    it('should reject unknown pagination parameters for user logs', async () => {
      await request(app.getHttpServer())
        .get(`/v1/audit/users/${nonExistentUuid}?unknown=value`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });
  });

  describe('GET /v1/audit/actions/:action', () => {
    it('should return audit logs by action', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit/actions/login')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((log: { action: string }) => log.action === 'login')).toBe(
        true,
      );
    });

    it('should return 400 for an invalid action', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/actions/nonexistent')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/actions/login')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/v1/audit/actions/login').expect(401);
    });

    it('should paginate audit logs by action', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit/actions/login')
        .query({
          limit: 5,
          offset: 0,
          sort: 'createdAt:DESC',
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(0);
      expect(response.body.data.length).toBeLessThanOrEqual(5);

      // Verify that all returned logs have the correct action
      expect(response.body.data.every((log: { action: string }) => log.action === 'login')).toBe(
        true,
      );
    });
  });

  describe('DELETE /v1/audit/cleanup', () => {
    const destructiveIt = process.env.RUN_DESTRUCTIVE_E2E === 'true' ? it : it.skip;

    destructiveIt('should clean up old audit logs with default retention', async () => {
      const response = await request(app.getHttpServer())
        .delete('/v1/audit/cleanup')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          deleted: expect.any(Number),
          message: expect.stringContaining('90 days'),
        }),
      );
    });

    destructiveIt('should clean up old audit logs with custom retention', async () => {
      const response = await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=30')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.message).toContain('30 days');
    });

    it('should return 400 for invalid days (0)', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 when days exceeds the maximum (3651)', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=3651')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 when days is not an integer', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=30.5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 when days is not numeric', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=abc')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 400 when days is negative', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=-1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should reject a normal user', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject an unauthenticated request', async () => {
      await request(app.getHttpServer()).delete('/v1/audit/cleanup').expect(401);
    });
  });
});
