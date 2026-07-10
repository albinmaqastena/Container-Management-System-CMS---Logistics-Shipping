// test/files/files.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp, getAuthToken } from '../setup';

describe('Files E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let uploadedFilePath: string;

  beforeAll(async () => {
    app = getApp();
    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'password123');
  });

  // ================================================================
  // UPLOAD SINGLE FILE
  // ================================================================
  describe('POST /v1/files/upload', () => {
    it('should upload a file (admin)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('test content'), 'test-file.txt')
        .expect(201);

      expect(response.body).toHaveProperty('message', 'File uploaded successfully');
      expect(response.body).toHaveProperty('filename');
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('/uploads/');
      uploadedFilePath = response.body.path;
    });

    it('should upload an image file and optimize it', async () => {
      // Krijoni një buffer imazhi të vogël (JPEG)
      const imageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );

      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', imageBuffer, 'test-image.jpg')
        .expect(201);

      expect(response.body.url).toContain('/uploads/');
      expect(response.body.filename).toMatch(/\.jpg$/);
    });

    it('should upload file to subfolder', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload?folder=subfolder')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('subfolder content'), 'subfolder-file.txt')
        .expect(201);

      expect(response.body.path).toContain('subfolder');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(401);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(403);
    });

    it('should fail without file', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // UPLOAD MULTIPLE FILES
  // ================================================================
  describe('POST /v1/files/upload/multiple', () => {
    it('should upload multiple files', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from('file1 content'), 'file1.txt')
        .attach('files', Buffer.from('file2 content'), 'file2.txt')
        .expect(201);

      expect(response.body).toHaveProperty('message', '2 files uploaded successfully');
      expect(response.body.files).toHaveLength(2);
      expect(response.body.files[0]).toHaveProperty('url');
      expect(response.body.files[1]).toHaveProperty('url');
    });

    it('should fail without files', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with empty files array', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from(''), 'empty.txt')
        .expect(400);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('files', Buffer.from('test'), 'test.txt')
        .expect(403);
    });
  });

  // ================================================================
  // DELETE FILE
  // ================================================================
  describe('DELETE /v1/files/:path', () => {
    it('should delete a file (admin)', async () => {
      // Së pari ngarkojmë një file
      const uploadResponse = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('to delete'), 'delete-me.txt')
        .expect(201);

      const filePath = uploadResponse.body.path;

      await request(app.getHttpServer())
        .delete(`/v1/files/${filePath}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('File deleted successfully');
        });
    });

    it('should fail to delete non-existent file', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/nonexistent-file.txt')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/some-file.txt')
        .expect(401);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/some-file.txt')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});