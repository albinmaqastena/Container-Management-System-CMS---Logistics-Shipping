// src/modules/files/dto/file-upload.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const normalizeFolder = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');

  return normalized || undefined;
};

export class FileUploadDto {
  @ApiPropertyOptional({
    example: 'items/photos',
    description: 'Relative upload folder inside the configured upload directory',
    maxLength: 150,
  })
  @Transform(({ value }: { value: unknown }): unknown => normalizeFolder(value))
  @IsOptional()
  @IsString({
    message: 'Folder must be a string',
  })
  @MaxLength(150, {
    message: 'Folder must not exceed 150 characters',
  })
  @Matches(/^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/, {
    message: 'Folder may only contain valid folder names separated by forward slashes',
  })
  folder?: string;
}
