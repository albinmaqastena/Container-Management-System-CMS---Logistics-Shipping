// src/config/file.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('file', () => ({
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    destination: './uploads',
    urlPrefix: '/uploads',
  },
  imageOptimization: {
    enabled: true,
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
  },
}));