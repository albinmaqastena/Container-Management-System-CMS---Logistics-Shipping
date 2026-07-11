// src/modules/files/files.service.ts

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly uploadDir: string;
  private readonly urlPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const fileConfig = this.configService.get<FileConfiguration>('file');

    this.uploadDir = path.resolve(fileConfig?.upload?.destination ?? './uploads');

    this.urlPrefix = (fileConfig?.upload?.urlPrefix ?? '/uploads').replace(/\/+$/, '');

    fs.mkdirSync(this.uploadDir, {
      recursive: true,
    });
  }

  async saveFile(file: MulterFile, subFolder = ''): Promise<SavedFileResult> {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    if (!file.originalname?.trim()) {
      throw new BadRequestException('Original filename is required');
    }

    const normalizedFolder = this.normalizeRelativePath(subFolder);

    const safeFilename = this.generateSafeFilename(file.originalname);

    const relativePath = normalizedFolder
      ? path.posix.join(normalizedFolder, safeFilename)
      : safeFilename;

    const fullPath = this.resolveInsideUploadDirectory(relativePath);

    await fs.promises.mkdir(path.dirname(fullPath), {
      recursive: true,
    });

    try {
      await fs.promises.writeFile(fullPath, file.buffer, {
        flag: 'wx',
      });

      if (file.mimetype?.startsWith('image/')) {
        await this.optimizeImage(fullPath, file.mimetype);
      }
    } catch (error) {
      await fs.promises.unlink(fullPath).catch(() => undefined);

      this.logger.error(
        `Failed to save file ${relativePath}`,
        error instanceof Error ? error.stack : String(error),
      );

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

  private async optimizeImage(filePath: string, mimetype: string): Promise<void> {
    const fileConfig = this.configService.get<FileConfiguration>('file');

    const options = fileConfig?.imageOptimization;

    if (!options?.enabled) {
      return;
    }

    const maxWidth = options.maxWidth ?? 1920;

    const maxHeight = options.maxHeight ?? 1080;

    const quality = Math.min(100, Math.max(1, options.quality ?? 80));

    const temporaryPath = `${filePath}.tmp`;

    try {
      const image = sharp(filePath, {
        failOn: 'none',
      });

      const metadata = await image.metadata();

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

      switch (mimetype) {
        case 'image/jpeg':
          await pipeline
            .jpeg({
              quality,
            })
            .toFile(temporaryPath);
          break;

        case 'image/png':
          await pipeline
            .png({
              quality,
              compressionLevel: 9,
            })
            .toFile(temporaryPath);
          break;

        case 'image/webp':
          await pipeline
            .webp({
              quality,
            })
            .toFile(temporaryPath);
          break;

        default:
          return;
      }

      /*
       * Remove the old image first. This avoids Windows rename
       * failures when the destination already exists.
       */
      await fs.promises.unlink(filePath);

      await fs.promises.rename(temporaryPath, filePath);

      this.logger.debug(`Image optimized: ${filePath}`);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(() => undefined);

      this.logger.warn(
        `Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
