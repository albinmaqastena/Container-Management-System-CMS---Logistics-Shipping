// src/common/interceptors/file-validation.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { MulterFile } from '../types/multer-file.type';

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('FileValidation');
  private readonly maxSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly allowedExtensions: string[];

  constructor(private configService: ConfigService) {
    const fileConfig = this.configService.get('file');
    this.maxSize = fileConfig?.upload?.maxFileSize || 5 * 1024 * 1024;
    this.allowedMimeTypes = fileConfig?.upload?.allowedMimeTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    this.allowedExtensions = fileConfig?.upload?.allowedExtensions || [
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
    ];
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const files = request.files || [];
    const file = request.file;

    if (!file && (!files || files.length === 0)) {
      return next.handle();
    }

    if (file) {
      this.validateFile(file);
    }

    if (files && files.length > 0) {
      for (const f of files) {
        this.validateFile(f);
      }
    }

    return next.handle();
  }

  private validateFile(file: MulterFile): void {
    // ✅ Kontrollo madhësinë
    if (file.size > this.maxSize) {
      this.logger.warn(`File too large: ${file.size} bytes`);
      throw new BadRequestException(
        `File size exceeds ${this.maxSize / 1024 / 1024}MB limit`,
      );
    }

    // ✅ Kontrollo MIME Type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      this.logger.warn(`Invalid MIME type: ${file.mimetype}`);
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // ✅ Kontrollo extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      this.logger.warn(`Invalid extension: ${ext}`);
      throw new BadRequestException(
        `File extension ${ext} is not allowed. Allowed extensions: ${this.allowedExtensions.join(', ')}`,
      );
    }

    // ✅ Kontrollo emrin e file-it
    const filename = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '');
    if (filename !== file.originalname) {
      this.logger.warn(`Suspicious filename: ${file.originalname}`);
      throw new BadRequestException('Invalid filename');
    }

    this.logger.debug(`File validated: ${file.originalname} (${file.size} bytes)`);
  }
}