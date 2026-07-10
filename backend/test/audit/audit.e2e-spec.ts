// test/audit/audit.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp, getAuthToken } from '../setup';

describe('Audit E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = getApp();
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'password123');
  });

  // ================================================================
  // GET ALL AUDIT LOGS
  // ================================================================
  describe('GET /v1/audit', () => {
    it('should return audit logs (Super Admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit')
        .expect(401);
    });

    it('should filter by userId', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?userId=user-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((log: any) => log.userId === 'user-1')).toBe(true);
    });

    it('should filter by action', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?action=login')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((log: any) => log.action === 'login')).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?status=success')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every((log: any) => log.status === 'success')).toBe(true);
    });

    it('should filter by fromDate and toDate', async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      const toDate = new Date();

      const response = await request(app.getHttpServer())
        .get(`/v1/audit?fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?limit=5&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(0);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should sort results', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit?sort=createdAt:DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 1) {
        const first = new Date(response.body.data[0].createdAt).getTime();
        const second = new Date(response.body.data[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should return 400 for invalid fromDate', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?fromDate=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid toDate', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit?toDate=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // GET AUDIT STATISTICS
  // ================================================================
  describe('GET /v1/audit/stats', () => {
    it('should return audit statistics (Super Admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byAction');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('last24h');
      expect(response.body).toHaveProperty('last7d');
      expect(typeof response.body.total).toBe('number');
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/stats')
        .expect(401);
    });
  });

  // ================================================================
  // GET AUDIT LOG BY ID
  // ================================================================
  describe('GET /v1/audit/:id', () => {
    it('should return audit log by id (Super Admin)', async () => {
      // Së pari marrim një audit log
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.data.length > 0) {
        const logId = listResponse.body.data[0].id;
        const response = await request(app.getHttpServer())
          .get(`/v1/audit/${logId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).toBe(logId);
        expect(response.body).toHaveProperty('action');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('userId');
      }
    });

    it('should return 404 for non-existent audit log', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ================================================================
  // GET AUDIT LOGS BY USER
  // ================================================================
  describe('GET /v1/audit/users/:userId', () => {
    it('should return audit logs by user (Super Admin)', async () => {
      // Së pari marrim një user id nga log-et
      const listResponse = await request(app.getHttpServer())
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (listResponse.body.data.length > 0) {
        const userId = listResponse.body.data[0].userId;
        const response = await request(app.getHttpServer())
          .get(`/v1/audit/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.every((log: any) => log.userId === userId)).toBe(true);
      }
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/users/user-1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ================================================================
  // GET AUDIT LOGS BY ACTION
  // ================================================================
  describe('GET /v1/audit/actions/:action', () => {
    it('should return audit logs by action (Super Admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/audit/actions/login')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.every((log: any) => log.action === 'login')).toBe(true);
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/actions/login')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent action', async () => {
      await request(app.getHttpServer())
        .get('/v1/audit/actions/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ================================================================
  // CLEANUP AUDIT LOGS
  // ================================================================
  describe('DELETE /v1/audit/cleanup', () => {
    it('should clean up old audit logs (Super Admin)', async () => {
      const response = await request(app.getHttpServer())
        .delete('/v1/audit/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('deleted');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Deleted');
      expect(response.body.message).toContain('90 days');
    });

    it('should clean up with custom days', async () => {
      const response = await request(app.getHttpServer())
        .delete('/v1/audit/cleanup?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('30 days');
    });

    it('should fail for user role', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .delete('/v1/audit/cleanup')
        .expect(401);
    });
  });
});