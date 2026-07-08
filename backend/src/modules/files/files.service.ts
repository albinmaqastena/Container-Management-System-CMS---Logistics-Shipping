// src/modules/files/files.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import type { MulterFile } from '../../common/types/multer-file.type';

@Injectable()
export class FilesService {
  private readonly logger = new Logger('FilesService');
  private readonly uploadDir: string;
  private readonly urlPrefix: string;

  constructor(private configService: ConfigService) {
    const fileConfig = this.configService.get('file');
    this.uploadDir = fileConfig?.upload?.destination || './uploads';
    this.urlPrefix = fileConfig?.upload?.urlPrefix || '/uploads';

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(
    file: MulterFile,
    subFolder: string = '',
  ): Promise<{ filename: string; path: string; url: string }> {
    const safeFilename = this.generateSafeFilename(file.originalname);
    const relativePath = subFolder ? path.join(subFolder, safeFilename) : safeFilename;
    const fullPath = path.join(this.uploadDir, relativePath);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, file.buffer);

    if (file.mimetype.startsWith('image/')) {
      await this.optimizeImage(fullPath);
    }

    this.logger.log(`File saved: ${fullPath}`);

    return {
      filename: safeFilename,
      path: relativePath,
      url: `${this.urlPrefix}/${relativePath}`,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        this.logger.log(`File deleted: ${fullPath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file ${fullPath}:`, error);
      throw new NotFoundException('File not found');
    }
  }

  private generateSafeFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-]/g, '');
    const base = path.basename(safeName, ext).substring(0, 50);
    return `${base}-${timestamp}-${random}${ext}`;
  }

  private async optimizeImage(filePath: string): Promise<void> {
    try {
      const fileConfig = this.configService.get('file');
      const opt = fileConfig?.imageOptimization;
      if (!opt?.enabled) return;

      const image = sharp(filePath);
      const metadata = await image.metadata();

      let width = metadata.width || 0;
      let height = metadata.height || 0;

      if (width > opt.maxWidth || height > opt.maxHeight) {
        const ratio = Math.min(opt.maxWidth / width, opt.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      await image
        .resize(width, height, { fit: 'inside' })
        .jpeg({ quality: opt.quality || 80 })
        .toFile(filePath + '.temp');

      await fs.promises.rename(filePath + '.temp', filePath);

      this.logger.debug(`Image optimized: ${filePath} -> ${width}x${height}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Image optimization failed: ${errorMessage}`);
    }
  }
}