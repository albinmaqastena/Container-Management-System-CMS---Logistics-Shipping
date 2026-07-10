// src/modules/containers/dto/create-container.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContainerDto {
  @ApiProperty({
    example: 'Container Alpha',
    description: 'Unique container name',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Container name is required' })
  @MinLength(3, {
    message: 'Container name must be at least 3 characters',
  })
  @MaxLength(100, {
    message: 'Container name must not exceed 100 characters',
  })
  customName!: string;

  @ApiProperty({
    example: 100,
    minimum: 0.01,
    maximum: 100000,
    description: 'Total volume in cubic meters',
  })
  @IsNumber(
    {
      allowNaN: false,
      allowInfinity: false,
    },
    {
      message: 'Total volume must be a number',
    },
  )
  @Min(0.01, {
    message: 'Total volume must be greater than 0',
  })
  @Max(100000, {
    message: 'Total volume must not exceed 100,000 cubic meters',
  })
  totalVolume!: number;

  @ApiPropertyOptional({
    example: 'Main storage container',
    description: 'Optional container description',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, {
    message: 'Description must not exceed 500 characters',
  })
  description?: string;
}