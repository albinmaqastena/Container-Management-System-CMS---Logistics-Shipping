// src/modules/files/files.service.ts

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp, { type Metadata } from 'sharp';

import type { MulterFile } from '../../common/types/multer-file.type';

export interface SavedFileResult {
  filename: string;
  path: string;
  url: string;
}

interface FileConfiguration {
  upload?: {
    destination?: string;
    urlPrefix?: string;
  };
  imageOptimization?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
}

/**
 * Critical error thrown when a file replacement fails and the original file cannot be restored.
 */
class FileReplacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileReplacementError';
  }
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly uploadDir: string;
  private readonly urlPrefix: string;
  private readonly allowedImageFormats = new Set(['jpeg', 'png', 'webp']);
  private readonly formatToExtension: Record<string, string> = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
  };
  private readonly imageOptimization: {
    enabled: boolean;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  };

  constructor(private readonly configService: ConfigService) {
    const fileConfig = this.configService.get<FileConfiguration>('file');

    this.uploadDir = path.resolve(fileConfig?.upload?.destination ?? './uploads');

    this.urlPrefix = (fileConfig?.upload?.urlPrefix ?? '/uploads').replace(/\/+$/, '');

    // Initialize upload directory with proper error handling
    try {
      fs.mkdirSync(this.uploadDir, {
        recursive: true,
      });
    } catch (error) {
      this.logger.error(
        `Unable to initialize upload directory ${this.uploadDir}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    // Read and validate image optimization configuration once
    const opt = fileConfig?.imageOptimization;

    const configuredMaxWidth = opt?.maxWidth;
    const configuredMaxHeight = opt?.maxHeight;
    const configuredQuality = opt?.quality;

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

  async saveFile(file: MulterFile, subFolder = ''): Promise<SavedFileResult> {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    if (!file.originalname?.trim()) {
      throw new BadRequestException('Original filename is required');
    }

    const normalizedFolder = this.normalizeRelativePath(subFolder);

    // Generate initial safe filename (with extension from original)
    const initialSafeFilename = this.generateSafeFilename(file.originalname);

    const initialRelativePath = normalizedFolder
      ? path.posix.join(normalizedFolder, initialSafeFilename)
      : initialSafeFilename;

    const initialFullPath = this.resolveInsideUploadDirectory(initialRelativePath);

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(initialFullPath), {
      recursive: true,
    });

    let fullPath = initialFullPath;
    let relativePath = initialRelativePath;
    let safeFilename = initialSafeFilename;

    try {
      // Write the file with the initial name
      await fs.promises.writeFile(fullPath, file.buffer, {
        flag: 'wx',
      });

      // Always validate as an image - this endpoint expects only images
      const metadata = await this.getValidatedImageMetadata(fullPath);

      // If the actual format differs from the extension, rename the file
      if (metadata.format && this.formatToExtension[metadata.format]) {
        const correctExtension = this.formatToExtension[metadata.format];
        const currentExtension = path.extname(safeFilename);
        if (currentExtension !== correctExtension) {
          // Generate new name with correct extension
          const baseName = safeFilename.replace(/\.[^.]+$/, '');
          const newSafeFilename = baseName + correctExtension;
          const newRelativePath = normalizedFolder
            ? path.posix.join(normalizedFolder, newSafeFilename)
            : newSafeFilename;
          const newFullPath = this.resolveInsideUploadDirectory(newRelativePath);

          // Rename the file (destination should not exist because name is unique)
          await fs.promises.rename(fullPath, newFullPath);

          // Update variables
          fullPath = newFullPath;
          relativePath = newRelativePath;
          safeFilename = newSafeFilename;
        }
      }

      // Optimize image if enabled (using the validated metadata)
      await this.optimizeImage(fullPath, metadata);
    } catch (error) {
      // Clean up the file if it was written
      await fs.promises.unlink(fullPath).catch(() => undefined);

      // Handle critical file replacement error separately
      if (error instanceof FileReplacementError) {
        this.logger.error(`Critical file replacement failure for ${relativePath}`, error.stack);
        throw new InternalServerErrorException('Unable to safely process uploaded image');
      }

      // Log other errors
      this.logger.error(
        `Failed to save file ${relativePath}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Unable to save file');
    }

    this.logger.log(`File saved: ${relativePath}`);

    return {
      filename: safeFilename,
      path: relativePath,
      url: `${this.urlPrefix}/${this.encodeUrlPath(relativePath)}`,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    const normalizedPath = this.normalizeRelativePath(filePath);

    if (!normalizedPath) {
      throw new BadRequestException('Invalid file path');
    }

    const fullPath = this.resolveInsideUploadDirectory(normalizedPath);

    try {
      const stat = await fs.promises.stat(fullPath);

      if (!stat.isFile()) {
        throw new NotFoundException('File not found');
      }

      await fs.promises.unlink(fullPath);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }

      this.logger.error(
        `Error deleting file ${normalizedPath}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new BadRequestException('Unable to delete file');
    }

    try {
      await this.removeEmptyParentFolders(path.dirname(fullPath));
    } catch (error) {
      /*
       * The file is already deleted. Failure to clean empty
       * directories must not convert a successful deletion into 400.
       */
      this.logger.warn(
        `Unable to remove empty parent folders for ${normalizedPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    this.logger.log(`File deleted: ${normalizedPath}`);
  }

  private generateSafeFilename(originalName: string): string {
    const parsed = path.parse(path.basename(originalName));

    const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '');

    const baseName =
      parsed.name
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'file';

    const timestamp = Date.now();

    const random = crypto.randomBytes(8).toString('hex');

    return `${baseName}-${timestamp}-${random}${extension}`;
  }

  private normalizeRelativePath(input?: string): string {
    if (!input) {
      return '';
    }

    let decoded: string;

    try {
      decoded = decodeURIComponent(input);
    } catch {
      throw new BadRequestException('Invalid encoded path');
    }

    const normalized = decoded
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized || normalized === '.') {
      return '';
    }

    const segments = normalized.split('/');

    if (
      segments.some(
        (segment) =>
          !segment || segment === '.' || segment === '..' || !/^[a-zA-Z0-9_.-]+$/.test(segment),
      )
    ) {
      throw new BadRequestException('Invalid file path');
    }

    return segments.join('/');
  }

  private resolveInsideUploadDirectory(relativePath: string): string {
    const fullPath = path.resolve(this.uploadDir, ...relativePath.split('/'));

    const relative = path.relative(this.uploadDir, fullPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Invalid file path');
    }

    return fullPath;
  }

  /**
   * Validates that the file at the given path is a supported image format.
   * Throws BadRequestException if validation fails.
   */
  private async getValidatedImageMetadata(filePath: string): Promise<Metadata> {
    try {
      const metadata = await sharp(filePath, {
        failOn: 'error',
      }).metadata();

      if (!metadata.format || !this.allowedImageFormats.has(metadata.format)) {
        throw new BadRequestException('Unsupported image format');
      }

      return metadata;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid image file');
    }
  }

  /**
   * Safely replaces the original file with the temporary file.
   * On failure, restores the original file.
   * If the original cannot be restored, throws a FileReplacementError.
   */
  private async replaceFileSafely(originalPath: string, temporaryPath: string): Promise<void> {
    // Use unique backup name to avoid collisions
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const backupPath = `${originalPath}.${randomSuffix}.bak`;

    // Backup the original file
    await fs.promises.rename(originalPath, backupPath);

    try {
      // Move the temporary file to the original location
      await fs.promises.rename(temporaryPath, originalPath);

      // Remove the backup
      await fs.promises.unlink(backupPath).catch((error: unknown) => {
        this.logger.warn(
          `Unable to remove image backup ${backupPath}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      });
    } catch (error: unknown) {
      // Try to restore the backup
      try {
        await fs.promises.rename(backupPath, originalPath);
      } catch (restoreError: unknown) {
        this.logger.error(
          'Failed to restore original image after optimization failure',
          restoreError instanceof Error ? restoreError.stack : String(restoreError),
        );

        // Check if the original file exists after the restore failure
        const originalExists = await fs.promises
          .access(originalPath)
          .then(() => true)
          .catch(() => false);

        if (!originalExists) {
          // Original file is lost - this is critical
          throw new FileReplacementError(
            'Failed to restore original image after optimization failure. Original file may be lost.',
          );
        }

        // Original file still exists, so propagate the original error
        throw error;
      }

      // Restore succeeded, but optimization failed
      throw error;
    }
  }

  private async optimizeImage(filePath: string, metadata: Metadata): Promise<void> {
    if (!this.imageOptimization.enabled) {
      return;
    }

    const { maxWidth, maxHeight, quality } = this.imageOptimization;

    const temporaryPath = `${filePath}.tmp`;

    try {
      const image = sharp(filePath, {
        failOn: 'error',
      });

      const shouldResize =
        Boolean(metadata.width) &&
        Boolean(metadata.height) &&
        (metadata.width > maxWidth || metadata.height > maxHeight);

      const pipeline = shouldResize
        ? image.resize({
            width: maxWidth,
            height: maxHeight,
            fit: 'inside',
            withoutEnlargement: true,
          })
        : image;

      const format = metadata.format;

      switch (format) {
        case 'jpeg':
          await pipeline
            .jpeg({
              quality,
            })
            .toFile(temporaryPath);
          break;

        case 'png':
          await pipeline
            .png({
              quality,
              compressionLevel: 9,
            })
            .toFile(temporaryPath);
          break;

        case 'webp':
          await pipeline
            .webp({
              quality,
            })
            .toFile(temporaryPath);
          break;

        default:
          // Should not happen due to earlier validation
          return;
      }

      // Replace the original file with the optimized version safely
      // If replaceFileSafely throws (e.g., due to file loss), the error propagates
      await this.replaceFileSafely(filePath, temporaryPath);

      this.logger.debug(`Image optimized: ${filePath}`);
    } catch (error) {
      // Clean up temporary file if it exists
      await fs.promises.unlink(temporaryPath).catch(() => undefined);

      // Check if this is a critical error (file loss) that should propagate
      if (error instanceof FileReplacementError) {
        // Critical error - propagate to saveFile
        throw error;
      }

      // Non-critical error (optimization failed but original is intact)
      this.logger.warn(
        `Image optimization failed for ${filePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private encodeUrlPath(relativePath: string): string {
    return relativePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private async removeEmptyParentFolders(startDirectory: string): Promise<void> {
    let currentDirectory = startDirectory;

    while (
      currentDirectory !== this.uploadDir &&
      path.relative(this.uploadDir, currentDirectory) &&
      !path.relative(this.uploadDir, currentDirectory).startsWith('..')
    ) {
      const entries = await fs.promises.readdir(currentDirectory);

      if (entries.length > 0) {
        return;
      }

      await fs.promises.rmdir(currentDirectory);

      currentDirectory = path.dirname(currentDirectory);
    }
  }
}
