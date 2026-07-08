// src/modules/items/dto/create-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Max,
  Matches,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'ITEM-001' })
  @IsString({ message: 'Unique number must be a string' })
  @IsNotEmpty({ message: 'Unique number is required' })
  @MinLength(3, { message: 'Unique number must be at least 3 characters' })
  @MaxLength(50, { message: 'Unique number must not exceed 50 characters' })
  uniqueNumber!: string;

  @ApiProperty({ example: 'Electronic Components' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Item name is required' })
  @MinLength(3, { message: 'Item name must be at least 3 characters' })
  @MaxLength(200, { message: 'Item name must not exceed 200 characters' })
  name!: string;

  @ApiProperty({ required: false, example: 'https://example.com/photo.jpg' })
  @IsString({ message: 'Photo URL must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Photo URL must not exceed 500 characters' })
  @Matches(/^https?:\/\/.+/, {
    message: 'Photo must be a valid URL starting with http:// or https://',
  })
  photo?: string;

  @ApiProperty({ example: 5 })
  @IsNumber({}, { message: 'Package quantity must be a number' })
  @IsNotEmpty({ message: 'Package quantity is required' })
  @Min(1, { message: 'Package quantity must be at least 1' })
  packageQuantity!: number;

  @ApiProperty({ example: 100 })
  @IsNumber({}, { message: 'Products per package must be a number' })
  @IsNotEmpty({ message: 'Products per package is required' })
  @Min(1, { message: 'Products per package must be at least 1' })
  productsPerPackage!: number;

  @ApiProperty({ example: 150.50 })
  @IsNumber({}, { message: 'Package price must be a number' })
  @IsNotEmpty({ message: 'Package price is required' })
  @Min(0, { message: 'Package price must be greater than or equal to 0' })
  packagePrice!: number;

  @ApiProperty({ example: 2.5, description: 'Volume per package in cubic meters' })
  @IsNumber({}, { message: 'Volume must be a number' })
  @IsNotEmpty({ message: 'Volume is required' })
  @Min(0, { message: 'Volume must be greater than or equal to 0' })
  @Max(10000, { message: 'Volume must not exceed 10,000 cubic meters' })
  volume!: number;

  @ApiProperty()
  @IsUUID('4', { message: 'Container ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Container ID is required' })
  containerId!: string;
}