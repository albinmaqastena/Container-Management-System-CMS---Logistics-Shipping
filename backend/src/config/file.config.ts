import { registerAs } from '@nestjs/config';

export default registerAs('file', () => ({
  upload: {
    maxFileSize: Number(
      process.env.FILE_MAX_SIZE_BYTES ||
        5 * 1024 * 1024,
    ),

    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],

    allowedExtensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
    ],
  },

  storage: {
    endpoint:
      process.env.S3_ENDPOINT,

    region:
      process.env.S3_REGION ||
      'auto',

    bucket:
      process.env.S3_BUCKET,

    accessKeyId:
      process.env.S3_ACCESS_KEY_ID,

    secretAccessKey:
      process.env.S3_SECRET_ACCESS_KEY,

    publicUrl:
      process.env.S3_PUBLIC_URL,
  },

  imageOptimization: {
    enabled:
      process.env
        .IMAGE_OPTIMIZATION_ENABLED !==
      'false',

    maxWidth: Number(
      process.env.IMAGE_MAX_WIDTH ||
        1200,
    ),

    maxHeight: Number(
      process.env.IMAGE_MAX_HEIGHT ||
        1200,
    ),

    quality: Number(
      process.env.IMAGE_QUALITY ||
        80,
    ),
  },
}));