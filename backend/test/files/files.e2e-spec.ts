// test/files/files.e2e-spec.ts

import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

import { getApp, getAuthToken } from '../setup';

interface UploadedFileResponse {
  filename: string;
  path: string;
  url: string;
}

describe('Files E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  const uploadedPaths: string[] = [];

  // PNG image buffer for testing
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  // Helper to encode file path segments for URL
  const encodeFilePath = (filePath: string): string =>
    filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

  beforeAll(async () => {
    app = getApp();

    adminToken = await getAuthToken('admin@example.com', 'Admin@123');
    userToken = await getAuthToken('testuser@example.com', 'Password@123');
  });

  afterAll(async () => {
    for (const filePath of uploadedPaths) {
      const response = await request(app.getHttpServer())
        .delete(`/v1/files/${encodeFilePath(filePath)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status !== 200 && response.status !== 404) {
        console.warn(`Cleanup failed for ${filePath}: ${response.status}`, response.body);
      }
    }
    uploadedPaths.length = 0;
  });

  describe('POST /v1/files/upload', () => {
    it('should upload an image as admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pngBuffer, {
          filename: 'test-image.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'File uploaded successfully',
          filename: expect.any(String),
          path: expect.any(String),
          url: expect.any(String),
        }),
      );

      expect(response.body.filename).toMatch(/\.png$/);
      expect(response.body.url).toContain('/uploads/');

      uploadedPaths.push(response.body.path);
    });

    it('should preserve the correct extension for a valid PNG image', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pngBuffer, {
          filename: 'valid-image.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.filename).toMatch(/\.png$/);
      expect(response.body.path).toMatch(/\.png$/);
      expect(response.body.url).toContain('/uploads/');

      uploadedPaths.push(response.body.path);
    });

    it('should upload an image into a subfolder from multipart body', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'subfolder')
        .attach('file', pngBuffer, {
          filename: 'subfolder-image.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.path).toMatch(/^subfolder\//);
      expect(response.body.url).toContain('/uploads/subfolder/');

      uploadedPaths.push(response.body.path);
    });

    it('should upload an image into a nested subfolder', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'items/photos')
        .attach('file', pngBuffer, {
          filename: 'nested.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.path).toMatch(/^items\/photos\//);

      uploadedPaths.push(response.body.path);
    });

    it('should normalize Windows folder separators', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'items\\photos')
        .attach('file', pngBuffer, {
          filename: 'windows.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.path).toMatch(/^items\/photos\//);

      uploadedPaths.push(response.body.path);
    });

    it('should reject a non-image file', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('plain text content'), {
          filename: 'document.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('should reject folder path traversal', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', '../outside')
        .attach('file', pngBuffer, {
          filename: 'traversal.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('should reject a file larger than 10 MB', async () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);

      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversizedBuffer, {
          filename: 'oversized.png',
          contentType: 'image/png',
        })
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .attach('file', pngBuffer, {
          filename: 'no-token.png',
          contentType: 'image/png',
        })
        .expect(401);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', pngBuffer, {
          filename: 'forbidden.png',
          contentType: 'image/png',
        })
        .expect(403);
    });

    it('should fail without a file', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'test')
        .expect(400);
    });

    it('should fail with an empty file', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.alloc(0), {
          filename: 'empty.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('should reject an unknown multipart field', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('unknownField', 'value')
        .attach('file', pngBuffer, {
          filename: 'unknown-field.png',
          contentType: 'image/png',
        })
        .expect(400);
    });
  });

  describe('POST /v1/files/upload/multiple', () => {
    it('should upload multiple images', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', pngBuffer, {
          filename: 'image-1.png',
          contentType: 'image/png',
        })
        .attach('files', pngBuffer, {
          filename: 'image-2.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.message).toBe('2 files uploaded successfully');
      expect(response.body.files).toHaveLength(2);

      for (const file of response.body.files as UploadedFileResponse[]) {
        expect(file).toEqual(
          expect.objectContaining({
            filename: expect.any(String),
            path: expect.any(String),
            url: expect.any(String),
          }),
        );
        expect(file.filename).toMatch(/\.png$/);
        expect(file.url).toContain('/uploads/');
        uploadedPaths.push(file.path);
      }
    });

    it('should upload multiple images into a folder', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'batch')
        .attach('files', pngBuffer, {
          filename: 'batch-1.png',
          contentType: 'image/png',
        })
        .attach('files', pngBuffer, {
          filename: 'batch-2.png',
          contentType: 'image/png',
        })
        .expect(201);

      for (const file of response.body.files as UploadedFileResponse[]) {
        expect(file.path).toMatch(/^batch\//);
        expect(file.filename).toMatch(/\.png$/);
        expect(file.url).toContain('/uploads/batch/');
        uploadedPaths.push(file.path);
      }
    });

    it('should reject the batch when a later image is invalid', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', pngBuffer, {
          filename: 'valid.png',
          contentType: 'image/png',
        })
        .attach('files', Buffer.from('not an image'), {
          filename: 'invalid.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('should reject more than 10 files', async () => {
      let testRequest = request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`);

      for (let index = 0; index < 11; index += 1) {
        testRequest = testRequest.attach('files', pngBuffer, {
          filename: `image-${index}.png`,
          contentType: 'image/png',
        });
      }

      await testRequest.expect(400);
    });

    it('should fail without files', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'batch')
        .expect(400);
    });

    it('should fail when one uploaded file is empty', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.alloc(0), {
          filename: 'empty.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('files', pngBuffer, {
          filename: 'forbidden.png',
          contentType: 'image/png',
        })
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/upload/multiple')
        .attach('files', pngBuffer, {
          filename: 'no-token.png',
          contentType: 'image/png',
        })
        .expect(401);
    });
  });

  describe('DELETE /v1/files/*path', () => {
    it('should delete a root-level image as admin', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pngBuffer, {
          filename: 'delete-me.png',
          contentType: 'image/png',
        })
        .expect(201);

      const filePath = uploadResponse.body.path;

      await request(app.getHttpServer())
        .delete(`/v1/files/${encodeFilePath(filePath)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((response) => {
          expect(response.body.message).toBe('File deleted successfully');
        });
    });

    it('should delete an image from a nested folder', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'delete/nested')
        .attach('file', pngBuffer, {
          filename: 'nested-delete.png',
          contentType: 'image/png',
        })
        .expect(201);

      const filePath = uploadResponse.body.path;

      await request(app.getHttpServer())
        .delete(`/v1/files/${encodeFilePath(filePath)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 404 for a non-existent file', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/nonexistent-file.png')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject path traversal attempts', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/..%2Fsecret.png')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).delete('/v1/files/some-file.png').expect(401);
    });

    it('should fail with user role', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/some-file.png')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
