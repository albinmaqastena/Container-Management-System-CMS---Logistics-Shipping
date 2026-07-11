// src/common/dto/pagination.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Limit must be an integer',
  })
  @Min(1, {
    message: 'Limit must be at least 1',
  })
  @Max(100, {
    message: 'Limit must not exceed 100',
  })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Offset must be an integer',
  })
  @Min(0, {
    message: 'Offset must be at least 0',
  })
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Comma-separated sort fields, for example: createdAt:DESC,name:ASC',
    example: 'createdAt:DESC',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({
    message: 'Sort must be a string',
  })
  @Matches(/^[a-zA-Z0-9_]+:(ASC|DESC)(,[a-zA-Z0-9_]+:(ASC|DESC))*$/, {
    message: 'Sort must use the format field:ASC or field:DESC',
  })
  sort?: string;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    isArray: true,
  })
  data!: T[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  hasMore!: boolean;

  constructor(data: T[], total: number, limit: number, offset: number) {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;

    const normalizedOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

    this.data = data;
    this.total = Math.max(total, 0);
    this.limit = normalizedLimit;
    this.offset = normalizedOffset;
    this.totalPages = this.total === 0 ? 0 : Math.ceil(this.total / normalizedLimit);
    this.currentPage = Math.floor(normalizedOffset / normalizedLimit) + 1;
    this.hasMore = normalizedOffset + data.length < this.total;
  }
}
