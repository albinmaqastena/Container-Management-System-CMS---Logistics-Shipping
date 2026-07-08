// src/modules/items/dto/update-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  Max
} from 'class-validator';

export class UpdateItemDto {
  @ApiProperty({ required: false })
  @IsString({ message: 'Unique number must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Unique number must be at least 3 characters' })
  @MaxLength(50, { message: 'Unique number must not exceed 50 characters' })
  uniqueNumber?: string;

  @ApiProperty({ required: false })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Item name must be at least 3 characters' })
  @MaxLength(200, { message: 'Item name must not exceed 200 characters' })
  name?: string;

  @ApiProperty({ required: false })
  @IsString({ message: 'Photo URL must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Photo URL must not exceed 500 characters' })
  @Matches(/^https?:\/\/.+/, {
    message: 'Photo must be a valid URL starting with http:// or https://',
  })
  photo?: string;

  @ApiProperty({ required: false })
  @IsNumber({}, { message: 'Package quantity must be a number' })
  @IsOptional()
  @Min(1, { message: 'Package quantity must be at least 1' })
  packageQuantity?: number;

  @ApiProperty({ required: false })
  @IsNumber({}, { message: 'Products per package must be a number' })
  @IsOptional()
  @Min(1, { message: 'Products per package must be at least 1' })
  productsPerPackage?: number;

  @ApiProperty({ required: false })
  @IsNumber({}, { message: 'Package price must be a number' })
  @IsOptional()
  @Min(0, { message: 'Package price must be greater than or equal to 0' })
  packagePrice?: number;

  @ApiProperty({ required: false })
  @IsNumber({}, { message: 'Volume must be a number' })
  @IsOptional()
  @Min(0, { message: 'Volume must be greater than or equal to 0' })
  @Max(10000, { message: 'Volume must not exceed 10,000 cubic meters' })
  volume?: number;
}