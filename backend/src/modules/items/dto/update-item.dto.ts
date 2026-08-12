// src/modules/items/dto/update-item.dto.ts

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
  Type,
} from 'class-transformer';

import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = (
  value: unknown,
): unknown =>
  typeof value === 'string'
    ? value.trim()
    : value;

const normalizeUpdatePhoto = (
  value: unknown,
): unknown => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed =
      value.trim();

    return trimmed === ''
      ? null
      : trimmed;
  }

  return value;
};

export class UpdateItemDto {
  @ApiPropertyOptional({
    example: 'ITEM-001',
    description:
      'Unique item identifier',
  })
  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }): unknown =>
      trimString(value),
  )
  @IsOptional()
  @IsString({
    message:
      'Unique number must be a string',
  })
  @MinLength(3, {
    message:
      'Unique number must be at least 3 characters',
  })
  @MaxLength(50, {
    message:
      'Unique number must not exceed 50 characters',
  })
  uniqueNumber?: string;

  @ApiPropertyOptional({
    example:
      'Electronic Components',
    description:
      'Item name',
  })
  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }): unknown =>
      trimString(value),
  )
  @IsOptional()
  @IsString({
    message:
      'Name must be a string',
  })
  @MinLength(3, {
    message:
      'Item name must be at least 3 characters',
  })
  @MaxLength(200, {
    message:
      'Item name must not exceed 200 characters',
  })
  name?: string;

  /**
   * Permanent S3 object key.
   *
   * Send null to remove the photo.
   *
   * Do NOT send/store a presigned URL.
   */
  @ApiPropertyOptional({
    example:
      'items/photo-1755012345678-a1b2c3d4.png',
    description:
      'S3 object key for the item photo. Send null to clear the photo.',
    nullable: true,
  })
  @Transform(
    ({
      value,
    }: {
      value: unknown;
    }): unknown =>
      normalizeUpdatePhoto(
        value,
      ),
  )
  @IsOptional()
  @IsString({
    message:
      'Photo path must be a string',
  })
  @MaxLength(500, {
    message:
      'Photo path must not exceed 500 characters',
  })
  photo?: string | null;

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message:
      'Package quantity must be an integer',
  })
  @Min(1, {
    message:
      'Package quantity must be at least 1',
  })
  packageQuantity?: number;

  @ApiPropertyOptional({
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message:
      'Products per package must be an integer',
  })
  @Min(1, {
    message:
      'Products per package must be at least 1',
  })
  productsPerPackage?: number;

  @ApiPropertyOptional({
    example: 150.5,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message:
        'Package price must be a valid number with at most 2 decimal places',
    },
  )
  @Min(0, {
    message:
      'Package price must be greater than or equal to 0',
  })
  packagePrice?: number;

  @ApiPropertyOptional({
    example: 2.5,
    minimum: 0.01,
    maximum: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
      maxDecimalPlaces: 2,
    },
    {
      message:
        'Volume must be a valid number with at most 2 decimal places',
    },
  )
  @Min(0.01, {
    message:
      'Volume must be greater than 0',
  })
  @Max(10000, {
    message:
      'Volume must not exceed 10,000 cubic meters',
  })
  volume?: number;
}