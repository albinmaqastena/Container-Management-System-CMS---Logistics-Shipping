// src/modules/items/dto/create-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({
    example: 'ITEM-001',
    description: 'Unique item identifier',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Unique number must be a string',
  })
  @IsNotEmpty({
    message: 'Unique number is required',
  })
  @MinLength(3, {
    message: 'Unique number must be at least 3 characters',
  })
  @MaxLength(50, {
    message: 'Unique number must not exceed 50 characters',
  })
  uniqueNumber!: string;

  @ApiProperty({
    example: 'Electronic Components',
    description: 'Item name',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'Name must be a string',
  })
  @IsNotEmpty({
    message: 'Item name is required',
  })
  @MinLength(3, {
    message: 'Item name must be at least 3 characters',
  })
  @MaxLength(200, {
    message: 'Item name must not exceed 200 characters',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/photo.jpg',
    description: 'Optional item photo URL',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({
    message: 'Photo URL must be a string',
  })
  @MaxLength(500, {
    message: 'Photo URL must not exceed 500 characters',
  })
  @Matches(/^https?:\/\/.+/i, {
    message:
      'Photo must be a valid URL starting with http:// or https://',
  })
  photo?: string;

  @ApiProperty({
    example: 5,
    minimum: 1,
    description: 'Number of packages',
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'Package quantity must be a number',
    },
  )
  @Min(1, {
    message: 'Package quantity must be at least 1',
  })
  packageQuantity!: number;

  @ApiProperty({
    example: 100,
    minimum: 1,
    description: 'Number of products inside each package',
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'Products per package must be a number',
    },
  )
  @Min(1, {
    message: 'Products per package must be at least 1',
  })
  productsPerPackage!: number;

  @ApiProperty({
    example: 150.5,
    minimum: 0,
    description: 'Price per package',
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'Package price must be a number',
    },
  )
  @Min(0, {
    message: 'Package price must be greater than or equal to 0',
  })
  packagePrice!: number;

  @ApiProperty({
    example: 2.5,
    minimum: 0.01,
    maximum: 10000,
    description: 'Volume per package in cubic meters',
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'Volume must be a number',
    },
  )
  @Min(0.01, {
    message: 'Volume must be greater than 0',
  })
  @Max(10000, {
    message: 'Volume must not exceed 10,000 cubic meters',
  })
  volume!: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
    description: 'ID of the container where the item will be stored',
  })
  @IsUUID('4', {
    message: 'Container ID must be a valid UUID version 4',
  })
  @IsNotEmpty({
    message: 'Container ID is required',
  })
  containerId!: string;
}