// test/reports/reports.e2e-spec.ts

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'superagent';
import { randomUUID } from 'crypto';

import { getApp, getAuthToken } from '../setup';
import { ContainerStatus } from '../../src/modules/containers/entities/container.entity';

const binaryParser = (
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
): void => {
  const chunks: Buffer[] = [];

  response.on('data', (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk));
  });

  response.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });

  response.on('error', (error: Error) => {
    callback(error);
  });
};

describe('Reports E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let containerId: string;
  let reportFromDate: string;
  let reportToDate: string;

  const validMissingContainerId = '550e8400-e29b-41d4-a716-446655440099';

  beforeAll(async () => {
    app = getApp();

    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'Password@123');

    reportFromDate = new Date(Date.now() - 1000).toISOString();

    const containerSuffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const createResponse = await request(app.getHttpServer())
      .post('/v1/containers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customName: `Reports E2E ${containerSuffix}`,
        totalVolume: 100,
        description: 'Temporary container for reports E2E tests',
      })
      .expect(201);

    containerId = String(createResponse.body.id);

    // Create an item inside the container to ensure reports have content
    await request(app.getHttpServer())
      .post('/v1/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        uniqueNumber: `RPT-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        name: 'Reports E2E Item',
        packageQuantity: 2,
        productsPerPackage: 5,
        packagePrice: 10.5,
        volume: 2,
        containerId,
      })
      .expect(201);

    reportToDate = new Date(Date.now() + 1000).toISOString();
  });

  afterAll(async () => {
    if (!containerId) {
      return;
    }

    const softDeleteResponse = await request(app.getHttpServer())
      .delete(`/v1/containers/${containerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (softDeleteResponse.status === 404) {
      return;
    }

    expect(softDeleteResponse.status).toBe(204);

    const permanentResponse = await request(app.getHttpServer())
      .delete(`/v1/containers/${containerId}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect([204, 404]).toContain(permanentResponse.status);
  });

  describe('GET /v1/reports/containers/:id/excel', () => {
    it('should download one container as Excel', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/reports/containers/${containerId}/excel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect(
          'Content-Type',
          /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
        );

      expect(response.headers['content-disposition']).toContain(
        `attachment; filename="container-${containerId}.xlsx"`,
      );

      const body = response.body as Buffer;

      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.length).toBeGreaterThan(100);
      expect(Number(response.headers['content-length'])).toBe(body.length);
      expect(body.subarray(0, 2).toString()).toBe('PK');
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/not-a-uuid/excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 404 for a missing container', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reports/containers/${validMissingContainerId}/excel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /v1/reports/containers/:id/pdf', () => {
    it('should download one container as PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/reports/containers/${containerId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      expect(response.headers['content-disposition']).toContain(
        `attachment; filename="container-${containerId}.pdf"`,
      );

      const body = response.body as Buffer;

      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.length).toBeGreaterThan(100);
      expect(Number(response.headers['content-length'])).toBe(body.length);
      expect(body.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/not-a-uuid/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 404 for a missing container', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reports/containers/${validMissingContainerId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject a normal user for an individual report', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reports/containers/${containerId}/pdf`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /v1/reports/containers/excel', () => {
    it('should reject unknown query parameters', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .query({ unknown: 'value' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should download Excel using only fromDate', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .query({
          fromDate: reportFromDate,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const body = response.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 2).toString()).toBe('PK');
    });

    it('should accept equal fromDate and toDate', async () => {
      const date = '2026-01-01T00:00:00.000Z';
      const response = await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .query({
          fromDate: date,
          toDate: date,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const body = response.body as Buffer;
      expect(body.subarray(0, 2).toString()).toBe('PK');
    });

    it.each([ContainerStatus.ACTIVE, ContainerStatus.ARCHIVED, ContainerStatus.SHIPPED])(
      'should accept the %s status filter',
      async (status) => {
        const response = await request(app.getHttpServer())
          .get('/v1/reports/containers/excel')
          .query({
            status,
            fromDate: reportFromDate,
            toDate: reportToDate,
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .buffer(true)
          .parse(binaryParser)
          .expect(200);

        const body = response.body as Buffer;
        expect(body.subarray(0, 2).toString()).toBe('PK');
      },
    );

    it('should download all containers as Excel with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .query({
          status: 'active',
          fromDate: reportFromDate,
          toDate: reportToDate,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect(
          'Content-Type',
          /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
        );

      expect(response.headers['content-disposition']).toContain(
        'attachment; filename="containers-report.xlsx"',
      );

      const body = response.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 2).toString()).toBe('PK');
    });

    it('should reject an invalid status', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .query({
          status: 'invalid-status',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /v1/reports/containers/pdf', () => {
    it('should download all containers as PDF with date filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports/containers/pdf')
        .query({
          fromDate: reportFromDate,
          toDate: reportToDate,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      const body = response.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should download PDF using only toDate', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports/containers/pdf')
        .query({
          toDate: reportToDate,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const body = response.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should reject an invalid date range', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/pdf')
        .query({
          fromDate: '2026-12-31T00:00:00.000Z',
          toDate: '2026-01-01T00:00:00.000Z',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should reject an invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/pdf')
        .query({
          fromDate: 'not-a-date',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('authorization', () => {
    it('should return 401 without a token', async () => {
      await request(app.getHttpServer()).get('/v1/reports/containers/excel').expect(401);
    });

    it('should return 403 for a normal user', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/containers/excel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
