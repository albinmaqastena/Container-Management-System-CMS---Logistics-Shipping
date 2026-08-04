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

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

const DEFAULT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(configService: ConfigService) {
    const fileConfig = configService.get<FileValidationConfig>('file');

    const configuredMaxFileSize = fileConfig?.upload?.maxFileSize;

    this.maxFileSize =
      typeof configuredMaxFileSize === 'number' &&
      Number.isInteger(configuredMaxFileSize) &&
      configuredMaxFileSize > 0
        ? configuredMaxFileSize
        : DEFAULT_MAX_FILE_SIZE;

    // Normalize MIME types: filter out invalid entries, trim, lowercase, remove empties
    const configuredMimeTypes = fileConfig?.upload?.allowedMimeTypes;

    const normalizedConfiguredMimeTypes = configuredMimeTypes
      ?.filter((mimeType): mimeType is string => typeof mimeType === 'string')
      .map((mimeType) => mimeType.trim().toLowerCase())
      .filter(Boolean);

    const mimeTypes = normalizedConfiguredMimeTypes?.length
      ? normalizedConfiguredMimeTypes
      : DEFAULT_ALLOWED_MIME_TYPES;

    this.allowedMimeTypes = new Set(mimeTypes);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<MultipartRequest>();

    const files = this.extractFiles(request);

    /*
     * Missing files are handled by the controller,
     * which provides endpoint-specific messages.
     */
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
    const originalName = file.originalname?.trim();

    if (!originalName || originalName.length > 255) {
      throw new BadRequestException('Invalid file name');
    }

    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException(`File "${originalName}" is empty`);
    }

    const actualSize = file.buffer.length;

    if (actualSize > this.maxFileSize) {
      throw new BadRequestException(
        `File "${originalName}" exceeds the maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    const normalizedMimeType = file.mimetype?.split(';')[0]?.trim().toLowerCase();

    if (!normalizedMimeType || !this.allowedMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }
  }
}
