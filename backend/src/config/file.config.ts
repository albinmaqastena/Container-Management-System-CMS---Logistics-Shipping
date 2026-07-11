// src/config/file.config.ts

import { registerAs } from '@nestjs/config';

export default registerAs('file', () => ({
  upload: {
    maxFileSize: Number(process.env.FILE_MAX_SIZE_BYTES || 5 * 1024 * 1024),
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/csv',
      'application/json',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    allowedExtensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.svg',
      '.pdf',
      '.txt',
      '.csv',
      '.json',
      '.zip',
      '.docx',
      '.xlsx',
    ],
    destination: process.env.FILE_UPLOAD_DESTINATION || './uploads',
    urlPrefix: process.env.FILE_URL_PREFIX || '/uploads',
  },
  imageOptimization: {
    enabled: process.env.IMAGE_OPTIMIZATION_ENABLED !== 'false',
    maxWidth: Number(process.env.IMAGE_MAX_WIDTH || 1200),
    maxHeight: Number(process.env.IMAGE_MAX_HEIGHT || 1200),
    quality: Number(process.env.IMAGE_QUALITY || 80),
  },
}));
