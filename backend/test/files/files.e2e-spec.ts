// test/files/files.e2e-spec.ts

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { getApp, getAuthToken } from '../setup';

describe('Files E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  const uploadedPaths: string[] = [];

  beforeAll(async () => {
    app = getApp();

    adminToken = await getAuthToken(
      'admin@example.com',
      'Admin@123',
    );

    userToken = await getAuthToken(
      'testuser@example.com',
      'Password@123',
    );
  });

  afterAll(async () => {
    for (const filePath of uploadedPaths) {
      await request(app.getHttpServer())
        .delete(
          `/v1/files/${encodeURIComponent(
            filePath,
          )}`,
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .catch(() => undefined);
    }
  });

  describe('POST /v1/files/upload', () => {
    it('should upload a file as admin', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'file',
          Buffer.from('test content'),
          'test-file.txt',
        )
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          message:
            'File uploaded successfully',
          filename: expect.any(String),
          path: expect.any(String),
          url: expect.any(String),
        }),
      );

      expect(response.body.url).toContain(
        '/uploads/',
      );

      uploadedPaths.push(
        response.body.path,
      );
    });

    it('should upload an image without changing its extension', async () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );

      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'file',
          pngBuffer,
          'test-image.png',
        )
        .expect(201);

      expect(response.body.filename).toMatch(
        /\.png$/,
      );

      expect(response.body.url).toContain(
        '/uploads/',
      );

      uploadedPaths.push(
        response.body.path,
      );
    });

    it('should upload a file into a subfolder from multipart body', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field('folder', 'subfolder')
        .attach(
          'file',
          Buffer.from(
            'subfolder content',
          ),
          'subfolder-file.txt',
        )
        .expect(201);

      expect(response.body.path).toMatch(
        /^subfolder\//,
      );

      expect(response.body.url).toContain(
        '/uploads/subfolder/',
      );

      uploadedPaths.push(
        response.body.path,
      );
    });

    it('should upload a file into a nested subfolder', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field(
          'folder',
          'items/photos',
        )
        .attach(
          'file',
          Buffer.from('nested content'),
          'nested.txt',
        )
        .expect(201);

      expect(response.body.path).toMatch(
        /^items\/photos\//,
      );

      uploadedPaths.push(
        response.body.path,
      );
    });

    it('should normalize Windows folder separators', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', 'items\\photos')
        .attach(
          'file',
          Buffer.from('windows content'),
          'windows.txt',
        )
        .expect(201);

      expect(response.body.path).toMatch(
        /^items\/photos\//,
      );

      uploadedPaths.push(response.body.path);
    });

    it('should reject folder path traversal', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field('folder', '../outside')
        .attach(
          'file',
          Buffer.from('test'),
          'test.txt',
        )
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .attach(
          'file',
          Buffer.from('test'),
          'test.txt',
        )
        .expect(401);
    });

    it('should fail with user role', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${userToken}`,
        )
        .attach(
          'file',
          Buffer.from('test'),
          'test.txt',
        )
        .expect(403);
    });

    it('should fail without a file', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field('folder', 'test')
        .expect(400);
    });

    it('should fail with an empty file', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'file',
          Buffer.alloc(0),
          'empty.txt',
        )
        .expect(400);
    });
  });

  describe('POST /v1/files/upload/multiple', () => {
    it('should upload multiple files', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'files',
          Buffer.from('file1 content'),
          'file1.txt',
        )
        .attach(
          'files',
          Buffer.from('file2 content'),
          'file2.txt',
        )
        .expect(201);

      expect(response.body.message).toBe(
        '2 files uploaded successfully',
      );

      expect(response.body.files).toHaveLength(
        2,
      );

      for (const file of response.body.files) {
        expect(file).toEqual(
          expect.objectContaining({
            filename: expect.any(String),
            path: expect.any(String),
            url: expect.any(String),
          }),
        );

        uploadedPaths.push(file.path);
      }
    });

    it('should upload multiple files into a folder', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field('folder', 'batch')
        .attach(
          'files',
          Buffer.from('file1'),
          'batch1.txt',
        )
        .attach(
          'files',
          Buffer.from('file2'),
          'batch2.txt',
        )
        .expect(201);

      expect(
        response.body.files.every(
          (file: { path: string }) =>
            file.path.startsWith(
              'batch/',
            ),
        ),
      ).toBe(true);

      uploadedPaths.push(
        ...response.body.files.map(
          (file: { path: string }) =>
            file.path,
        ),
      );
    });

    it('should fail without files', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field('folder', 'batch')
        .expect(400);
    });

    it('should fail when one uploaded file is empty', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'files',
          Buffer.alloc(0),
          'empty.txt',
        )
        .expect(400);
    });

    it('should fail with user role', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .set(
          'Authorization',
          `Bearer ${userToken}`,
        )
        .attach(
          'files',
          Buffer.from('test'),
          'test.txt',
        )
        .expect(403);
    });

    it('should fail without token', async () => {
      await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload/multiple')
        .attach(
          'files',
          Buffer.from('test'),
          'test.txt',
        )
        .expect(401);
    });
  });

  describe('DELETE /v1/files/:path', () => {
    it('should delete a root-level file as admin', async () => {
      const uploadResponse = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .attach(
          'file',
          Buffer.from('to delete'),
          'delete-me.txt',
        )
        .expect(201);

      const filePath =
        uploadResponse.body.path;

      await request(
        app.getHttpServer(),
      )
        .delete(
          `/v1/files/${encodeURIComponent(
            filePath,
          )}`,
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .expect(200)
        .expect((response) => {
          expect(
            response.body.message,
          ).toBe(
            'File deleted successfully',
          );
        });
    });

    it('should delete a file from a nested folder', async () => {
      const uploadResponse = await request(
        app.getHttpServer(),
      )
        .post('/v1/files/upload')
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .field(
          'folder',
          'delete/nested',
        )
        .attach(
          'file',
          Buffer.from('to delete'),
          'nested-delete.txt',
        )
        .expect(201);

      const filePath =
        uploadResponse.body.path;

      await request(
        app.getHttpServer(),
      )
        .delete(
          `/v1/files/${encodeURIComponent(
            filePath,
          )}`,
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .expect(200);
    });

    it('should return 404 for a non-existent file', async () => {
      await request(
        app.getHttpServer(),
      )
        .delete(
          '/v1/files/nonexistent-file.txt',
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .expect(404);
    });

    it('should reject path traversal attempts', async () => {
      await request(
        app.getHttpServer(),
      )
        .delete(
          `/v1/files/${encodeURIComponent(
            '../secret.txt',
          )}`,
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`,
        )
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(
        app.getHttpServer(),
      )
        .delete(
          '/v1/files/some-file.txt',
        )
        .expect(401);
    });

    it('should fail with user role', async () => {
      await request(
        app.getHttpServer(),
      )
        .delete(
          '/v1/files/some-file.txt',
        )
        .set(
          'Authorization',
          `Bearer ${userToken}`,
        )
        .expect(403);
    });
  });
});