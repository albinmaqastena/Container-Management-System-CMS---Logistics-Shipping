// src/common/interceptors/file-validation.interceptor.ts

import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

import type { MulterFile } from '../types/multer-file.type';

interface FileValidationConfig {
  upload?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
}

interface MultipartRequest {
  file?: MulterFile;
  files?: MulterFile[] | Record<string, MulterFile[]>;
}

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
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
];

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const fileConfig = this.configService.get<FileValidationConfig>('file');

    this.maxFileSize = fileConfig?.upload?.maxFileSize ?? 10 * 1024 * 1024;

    this.allowedMimeTypes = new Set([
      ...DEFAULT_ALLOWED_MIME_TYPES,
      ...(fileConfig?.upload?.allowedMimeTypes ?? []),
    ]);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<MultipartRequest>();

    const files = this.extractFiles(request);

    // Missing files are handled by the controller.
    if (files.length === 0) {
      return next.handle();
    }

    for (const file of files) {
      this.validateFile(file);
    }

    return next.handle();
  }

  private extractFiles(request: MultipartRequest): MulterFile[] {
    if (request.file) {
      return [request.file];
    }

    if (Array.isArray(request.files)) {
      return request.files;
    }

    if (request.files && typeof request.files === 'object') {
      return Object.values(request.files).flat();
    }

    return [];
  }

  private validateFile(file: MulterFile): void {
    if (!file.buffer || file.buffer.length === 0 || file.size === 0) {
      throw new BadRequestException(`File "${file.originalname}" is empty`);
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File "${file.originalname}" exceeds the maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    const normalizedMimeType = file.mimetype?.split(';')[0].trim().toLowerCase();

    if (!normalizedMimeType || !this.allowedMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }

    if (!file.originalname || file.originalname.length > 255) {
      throw new BadRequestException('Invalid file name');
    }
  }
}
