// src/common/dto/pagination.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class PaginationDto {
  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Number of items to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: 'Offset must be at least 0' })
  offset?: number = 0;

  @ApiProperty({
    required: false,
    description: 'Sort field and direction (e.g., name:ASC, createdAt:DESC)',
    example: 'createdAt:DESC',
  })
  @IsOptional()
  @IsString({ message: 'Sort must be a string' })
  sort?: string;
}

export class PaginatedResponseDto<T> {
  @ApiProperty()
  data: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;

  constructor(data: T[], total: number, limit: number, offset: number) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
    this.totalPages = Math.ceil(total / limit);
    this.currentPage = Math.floor(offset / limit) + 1;
  }
}