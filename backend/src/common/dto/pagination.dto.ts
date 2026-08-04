// src/common/dto/pagination.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const trimStringValue = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

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
  @Transform(({ value }: { value: unknown }) => trimStringValue(value))
  @IsOptional()
  @IsString({
    message: 'Sort must be a string',
  })
  @MaxLength(500, {
    message: 'Sort must not exceed 500 characters',
  })
  @Matches(/^[a-zA-Z0-9_]+:(ASC|DESC)(,[a-zA-Z0-9_]+:(ASC|DESC))*$/, {
    message: 'Sort must use the format field:ASC or field:DESC',
  })
  sort?: string;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    type: [Object],
    description: 'Array of items for the current page',
  })
  data!: T[];

  @ApiProperty({
    example: 42,
    description: 'Total number of items matching the query',
  })
  total!: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit!: number;

  @ApiProperty({
    example: 0,
    description: 'Number of items skipped',
  })
  offset!: number;

  @ApiProperty({
    example: 5,
    description: 'Total number of pages',
  })
  totalPages!: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number (1-indexed; returns 1 when there are no results)',
  })
  currentPage!: number;

  @ApiProperty({
    example: true,
    description: 'Whether there are more items after the current page',
  })
  hasMore!: boolean;

  constructor(data: T[], total: number, limit: number, offset: number) {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;

    const normalizedOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

    const normalizedTotal = Number.isFinite(total) && total >= 0 ? total : 0;

    this.data = Array.isArray(data) ? data : [];
    this.total = normalizedTotal;
    this.limit = normalizedLimit;
    this.offset = normalizedOffset;
    this.totalPages = normalizedTotal === 0 ? 0 : Math.ceil(normalizedTotal / normalizedLimit);
    this.currentPage =
      normalizedTotal === 0 ? 1 : Math.floor(normalizedOffset / normalizedLimit) + 1;
    this.hasMore = normalizedOffset + this.data.length < normalizedTotal;
  }
}
