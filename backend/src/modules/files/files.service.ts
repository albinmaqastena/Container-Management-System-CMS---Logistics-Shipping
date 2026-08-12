import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import * as crypto from 'crypto';
import * as path from 'path';

import sharp, { type Metadata } from 'sharp';

import type { MulterFile } from '../../common/types/multer-file.type';

export interface SavedFileResult {
  filename: string;

  /**
   * Permanent S3 object key.
   *
   * THIS is what should be stored in the database.
   *
   * Example:
   * containers/image-123.png
   */
  path: string;

  /**
   * Temporary presigned URL.
   *
   * DO NOT store this permanently in the database.
   */
  url: string;
}

interface FileConfiguration {
  storage?: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl?: string;
  };

  imageOptimization?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
}

interface ProcessedFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly s3Client: S3Client;

  private readonly bucket: string;

  /**
   * Public/base URL is kept mainly so we can support
   * old database records that contain a full S3 URL.
   *
   * New records should store only the object key.
   */
  private readonly publicUrl: string;

  /**
   * Presigned URL validity.
   *
   * 3600 seconds = 1 hour.
   */
  private readonly signedUrlExpiresIn = 3600;

  private readonly allowedImageFormats = new Set([
    'jpeg',
    'png',
    'webp',
  ]);

  private readonly formatToExtension: Record<string, string> = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
  };

  private readonly formatToMimeType: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  private readonly imageOptimization: {
    enabled: boolean;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  };

  constructor(
    private readonly configService: ConfigService,
  ) {
    const fileConfig =
      this.configService.get<FileConfiguration>('file');

    const storage = fileConfig?.storage;

    const region = storage?.region?.trim();

    const bucket = storage?.bucket?.trim();

    const accessKeyId =
      storage?.accessKeyId?.trim();

    const secretAccessKey =
      storage?.secretAccessKey;

    const configuredPublicUrl =
      storage?.publicUrl
        ?.trim()
        .replace(/\/+$/, '');

    if (
      !region ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      throw new Error(
        'S3 storage configuration is incomplete',
      );
    }

    this.bucket = bucket;

    /**
     * If publicUrl is configured, use it.
     *
     * Otherwise construct the normal AWS S3 URL.
     */
    this.publicUrl =
      configuredPublicUrl ||
      `https://${bucket}.s3.${region}.amazonaws.com`;

    /**
     * Standard AWS S3 configuration.
     *
     * No custom endpoint is required for normal AWS S3.
     * No forcePathStyle is required.
     */
    this.s3Client = new S3Client({
      region,

      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const opt =
      fileConfig?.imageOptimization;

    const configuredMaxWidth =
      opt?.maxWidth;

    const configuredMaxHeight =
      opt?.maxHeight;

    const configuredQuality =
      opt?.quality;

    const maxWidth =
      typeof configuredMaxWidth === 'number' &&
      Number.isInteger(configuredMaxWidth) &&
      configuredMaxWidth > 0
        ? configuredMaxWidth
        : 1920;

    const maxHeight =
      typeof configuredMaxHeight === 'number' &&
      Number.isInteger(configuredMaxHeight) &&
      configuredMaxHeight > 0
        ? configuredMaxHeight
        : 1080;

    const quality =
      typeof configuredQuality === 'number' &&
      Number.isFinite(configuredQuality) &&
      configuredQuality >= 1 &&
      configuredQuality <= 100
        ? configuredQuality
        : 80;

    this.imageOptimization = {
      enabled: opt?.enabled ?? false,

      maxWidth,
      maxHeight,
      quality,
    };
  }

  /**
   * Upload a file to S3.
   *
   * IMPORTANT:
   *
   * result.path -> save this in database
   * result.url  -> temporary preview URL only
   */
  async saveFile(
    file: MulterFile,
    subFolder = '',
  ): Promise<SavedFileResult> {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(
        'File buffer is empty',
      );
    }

    if (!file.originalname?.trim()) {
      throw new BadRequestException(
        'Original filename is required',
      );
    }

    const normalizedFolder =
      this.normalizeRelativePath(subFolder);

    let processedFile: ProcessedFile;

    try {
      processedFile =
        await this.processFile(file);
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Unable to process file ${file.originalname}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to safely process uploaded file',
      );
    }

    const objectKey =
      normalizedFolder
        ? path.posix.join(
            normalizedFolder,
            processedFile.filename,
          )
        : processedFile.filename;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,

          Key: objectKey,

          Body: processedFile.buffer,

          ContentType:
            processedFile.contentType,

          /**
           * This is safe even with a private bucket.
           *
           * Cache-Control tells clients how they may cache
           * the object once they have permission to access it.
           */
          CacheControl:
            'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      this.logger.error(
        `S3 upload failed for ${objectKey}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to upload file',
      );
    }

    this.logger.log(
      `File uploaded to storage: ${objectKey}`,
    );

    /**
     * Generate temporary URL so frontend can
     * immediately preview the uploaded file.
     */
    const signedUrl =
      await this.getSignedFileUrl(objectKey);

    return {
      filename:
        processedFile.filename,

      /**
       * SAVE THIS VALUE IN DB.
       */
      path:
        objectKey,

      /**
       * DO NOT SAVE THIS VALUE IN DB.
       *
       * This expires.
       */
      url:
        signedUrl,
    };
  }

  /**
   * Generates a temporary authenticated URL
   * for a private S3 object.
   *
   * Can receive:
   *
   * containers/photo.png
   *
   * or an old full S3 URL.
   */
  async getSignedFileUrl(
    filePathOrUrl: string,
    expiresIn = this.signedUrlExpiresIn,
  ): Promise<string> {
    const objectKey =
      this.extractObjectKey(
        filePathOrUrl,
      );

    if (!objectKey) {
      throw new BadRequestException(
        'Invalid file path',
      );
    }

    try {
      const command =
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        });

      return await getSignedUrl(
        this.s3Client,
        command,
        {
          expiresIn,
        },
      );
    } catch (error) {
      this.logger.error(
        `Unable to generate signed URL for ${objectKey}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Unable to generate file URL',
      );
    }
  }

  /**
   * Useful when you have an optional image/path.
   *
   * Instead of writing:
   *
   * image
   *   ? await filesService.getSignedFileUrl(image)
   *   : null
   *
   * everywhere.
   */
  async getOptionalSignedFileUrl(
    filePathOrUrl?: string | null,
  ): Promise<string | null> {
    if (!filePathOrUrl?.trim()) {
      return null;
    }

    return this.getSignedFileUrl(
      filePathOrUrl,
    );
  }

  /**
   * Converts:
   *
   * containers/image.png
   *
   * or:
   *
   * https://bucket.s3.../containers/image.png
   *
   * or even an old signed URL:
   *
   * https://bucket.s3.../containers/image.png?X-Amz-...
   *
   * into:
   *
   * containers/image.png
   */
  private extractObjectKey(
    filePathOrUrl: string,
  ): string {
    const input =
      filePathOrUrl?.trim();

    if (!input) {
      throw new BadRequestException(
        'Invalid file path',
      );
    }

    /**
     * Full URL.
     */
    if (
      /^https?:\/\//i.test(input)
    ) {
      let parsedUrl: URL;
      let configuredBaseUrl: URL;

      try {
        parsedUrl =
          new URL(input);

        configuredBaseUrl =
          new URL(this.publicUrl);
      } catch {
        throw new BadRequestException(
          'Invalid file URL',
        );
      }

      /**
       * Prevent someone from passing arbitrary external URLs.
       */
      if (
        parsedUrl.hostname !==
        configuredBaseUrl.hostname
      ) {
        throw new BadRequestException(
          'File URL does not belong to configured storage',
        );
      }

      /**
       * pathname does NOT contain query parameters.
       *
       * So:
       *
       * /photo.png?X-Amz-...
       *
       * becomes:
       *
       * /photo.png
       */
      return this.normalizeRelativePath(
        parsedUrl.pathname,
      );
    }

    /**
     * Already an S3 object key.
     */
    return this.normalizeRelativePath(
      input,
    );
  }

  private async processFile(
    file: MulterFile,
  ): Promise<ProcessedFile> {
    const metadata =
      await this.getValidatedImageMetadata(
        file.buffer,
      );

    const format =
      metadata.format;

    if (
      !format ||
      !this.allowedImageFormats.has(
        format,
      )
    ) {
      throw new BadRequestException(
        'Unsupported image format',
      );
    }

    const extension =
      this.formatToExtension[
        format
      ];

    const contentType =
      this.formatToMimeType[
        format
      ];

    if (
      !extension ||
      !contentType
    ) {
      throw new BadRequestException(
        'Unsupported image format',
      );
    }

    const safeFilename =
      this.generateSafeFilename(
        file.originalname,
        extension,
      );

    let outputBuffer =
      file.buffer;

    if (
      this.imageOptimization.enabled
    ) {
      outputBuffer =
        await this.optimizeImage(
          file.buffer,
          metadata,
          format,
        );
    }

    return {
      buffer:
        outputBuffer,

      filename:
        safeFilename,

      contentType,
    };
  }

  private generateSafeFilename(
    originalName: string,
    extension: string,
  ): string {
    const parsed =
      path.parse(
        path.basename(
          originalName,
        ),
      );

    const baseName =
      parsed.name
        .normalize('NFKD')
        .replace(
          /[^a-zA-Z0-9_-]/g,
          '-',
        )
        .replace(
          /-+/g,
          '-',
        )
        .replace(
          /^-|-$/g,
          '',
        )
        .slice(0, 50) ||
      'file';

    const timestamp =
      Date.now();

    const random =
      crypto
        .randomBytes(8)
        .toString('hex');

    return `${baseName}-${timestamp}-${random}${extension}`;
  }

  private normalizeRelativePath(
    input?: string,
  ): string {
    if (!input) {
      return '';
    }

    let decoded: string;

    try {
      decoded =
        decodeURIComponent(
          input,
        );
    } catch {
      throw new BadRequestException(
        'Invalid encoded path',
      );
    }

    const normalized =
      decoded
        .trim()
        .replace(
          /\\/g,
          '/',
        )
        .replace(
          /^\/+|\/+$/g,
          '',
        );

    if (
      !normalized ||
      normalized === '.'
    ) {
      return '';
    }

    const segments =
      normalized.split('/');

    if (
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          !/^[a-zA-Z0-9_.-]+$/.test(
            segment,
          ),
      )
    ) {
      throw new BadRequestException(
        'Invalid file path',
      );
    }

    return segments.join('/');
  }

  private async getValidatedImageMetadata(
    buffer: Buffer,
  ): Promise<Metadata> {
    try {
      const metadata =
        await sharp(
          buffer,
          {
            failOn: 'error',
          },
        ).metadata();

      if (
        !metadata.format ||
        !this.allowedImageFormats.has(
          metadata.format,
        )
      ) {
        throw new BadRequestException(
          'Unsupported image format',
        );
      }

      return metadata;
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        'Invalid image file',
      );
    }
  }

  private async optimizeImage(
    buffer: Buffer,
    metadata: Metadata,
    format: string,
  ): Promise<Buffer> {
    const {
      maxWidth,
      maxHeight,
      quality,
    } =
      this.imageOptimization;

    try {
      let pipeline =
        sharp(
          buffer,
          {
            failOn: 'error',
          },
        );

      const shouldResize =
        Boolean(
          metadata.width,
        ) &&
        Boolean(
          metadata.height,
        ) &&
        (
          (metadata.width ?? 0) >
            maxWidth ||
          (metadata.height ?? 0) >
            maxHeight
        );

      if (shouldResize) {
        pipeline =
          pipeline.resize({
            width:
              maxWidth,

            height:
              maxHeight,

            fit:
              'inside',

            withoutEnlargement:
              true,
          });
      }

      switch (format) {
        case 'jpeg':
          return await pipeline
            .jpeg({
              quality,
            })
            .toBuffer();

        case 'png':
          return await pipeline
            .png({
              quality,
              compressionLevel: 9,
            })
            .toBuffer();

        case 'webp':
          return await pipeline
            .webp({
              quality,
            })
            .toBuffer();

        default:
          return buffer;
      }
    } catch (error) {
      /**
       * Optimization failure should not destroy
       * the original upload.
       */
      this.logger.warn(
        `Image optimization failed: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );

      return buffer;
    }
  }

  /**
   * Kept in case other parts of your project
   * still need URL-safe object paths.
   */
  private encodeUrlPath(
    relativePath: string,
  ): string {
    return relativePath
      .split('/')
      .map(
        (segment) =>
          encodeURIComponent(
            segment,
          ),
      )
      .join('/');
  }

  async deleteFile(
    filePathOrUrl: string,
  ): Promise<void> {
    const objectKey =
      this.extractObjectKey(
        filePathOrUrl,
      );

    if (!objectKey) {
      throw new BadRequestException(
        'Invalid file path',
      );
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket:
            this.bucket,

          Key:
            objectKey,
        }),
      );

      this.logger.log(
        `File deleted from storage: ${objectKey}`,
      );
    } catch (error) {
      this.logger.error(
        `S3 delete failed for ${objectKey}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new BadRequestException(
        'Unable to delete file',
      );
    }
  }
}