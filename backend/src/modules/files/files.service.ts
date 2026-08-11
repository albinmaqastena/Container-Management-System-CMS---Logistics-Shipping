import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import * as crypto from 'crypto';
import * as path from 'path';

import sharp, {
  type Metadata,
} from 'sharp';

import type {
  MulterFile,
} from '../../common/types/multer-file.type';

export interface SavedFileResult {
  filename: string;
  path: string;
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
  private readonly logger =
    new Logger(
      FilesService.name,
    );

  private readonly s3Client:
    S3Client;

  private readonly bucket:
    string;

  private readonly publicUrl:
    string;

  private readonly allowedImageFormats =
    new Set([
      'jpeg',
      'png',
      'webp',
    ]);

  private readonly formatToExtension:
    Record<string, string> = {
      jpeg: '.jpg',
      png: '.png',
      webp: '.webp',
    };

  private readonly formatToMimeType:
    Record<string, string> = {
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
    private readonly configService:
      ConfigService,
  ) {
    const fileConfig =
      this.configService.get<FileConfiguration>(
        'file',
      );

    const storage =
      fileConfig?.storage;

    const endpoint =
      storage?.endpoint?.trim();

    const region =
      storage?.region?.trim() ||
      'auto';

    const bucket =
      storage?.bucket?.trim();

    const accessKeyId =
      storage?.accessKeyId?.trim();

    const secretAccessKey =
      storage?.secretAccessKey;

    const publicUrl =
      storage?.publicUrl
        ?.trim()
        .replace(/\/+$/, '');

    if (
      !endpoint ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicUrl
    ) {
      throw new Error(
        'S3 storage configuration is incomplete',
      );
    }

    this.bucket =
      bucket;

    this.publicUrl =
      publicUrl;

    this.s3Client =
      new S3Client({
        region,

        endpoint,

        credentials: {
          accessKeyId,
          secretAccessKey,
        },

        /*
         * Cloudflare R2 dhe shumë
         * S3-compatible providers
         * punojnë mirë me path style.
         */
        forcePathStyle: true,
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
      typeof configuredMaxWidth ===
        'number' &&
      Number.isInteger(
        configuredMaxWidth,
      ) &&
      configuredMaxWidth > 0
        ? configuredMaxWidth
        : 1920;

    const maxHeight =
      typeof configuredMaxHeight ===
        'number' &&
      Number.isInteger(
        configuredMaxHeight,
      ) &&
      configuredMaxHeight > 0
        ? configuredMaxHeight
        : 1080;

    const quality =
      typeof configuredQuality ===
        'number' &&
      Number.isFinite(
        configuredQuality,
      ) &&
      configuredQuality >= 1 &&
      configuredQuality <= 100
        ? configuredQuality
        : 80;

    this.imageOptimization = {
      enabled:
        opt?.enabled ?? false,

      maxWidth,
      maxHeight,
      quality,
    };
  }

  async saveFile(
    file: MulterFile,
    subFolder = '',
  ): Promise<SavedFileResult> {
    if (
      !file ||
      !Buffer.isBuffer(
        file.buffer,
      ) ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(
        'File buffer is empty',
      );
    }

    if (
      !file.originalname?.trim()
    ) {
      throw new BadRequestException(
        'Original filename is required',
      );
    }

    const normalizedFolder =
      this.normalizeRelativePath(
        subFolder,
      );

    let processedFile:
      ProcessedFile;

    try {
      processedFile =
        await this.processFile(
          file,
        );
    } catch (error) {
      if (
        error instanceof
        BadRequestException
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
          Bucket:
            this.bucket,

          Key:
            objectKey,

          Body:
            processedFile.buffer,

          ContentType:
            processedFile.contentType,

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

    return {
      filename:
        processedFile.filename,

      path:
        objectKey,

      url:
        `${this.publicUrl}/${this.encodeUrlPath(
          objectKey,
        )}`,
    };
  }

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

        // URL publike e file-it
        if (
            input.startsWith(
            `${this.publicUrl}/`,
            )
        ) {
            const relativePart =
            input.slice(
                this.publicUrl.length + 1,
            );

            return this.normalizeRelativePath(
            relativePart,
            );
        }

        // Refuzojmë URL nga domain-e të tjera.
        if (
            /^https?:\/\//i.test(input)
        ) {
            throw new BadRequestException(
            'File URL does not belong to configured storage',
            );
        }

        // Object key normal
        return this.normalizeRelativePath(
            input,
        );
        }

  private async processFile(
    file: MulterFile,
  ): Promise<ProcessedFile> {
    /*
     * FilesService yt aktual në praktikë
     * i trajton upload-et si images.
     *
     * Prandaj ruajmë të njëjtën
     * sjellje këtu dhe validojmë me sharp.
     */

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

    let decoded:
      string;

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
        error instanceof
        BadRequestException
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
        sharp(buffer, {
          failOn: 'error',
        });

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
      /*
       * Një dështim optimization
       * nuk duhet ta humbasë file-in.
       * Ruaj buffer-in origjinal.
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
        Bucket: this.bucket,
        Key: objectKey,
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