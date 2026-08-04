// src/modules/containers/dto/update-container.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateContainerDto {
  @ApiPropertyOptional({
    example: 'Container Alpha Updated',
    description: 'Updated container name',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({
    message: 'Name must be a string',
  })
  @MinLength(3, {
    message: 'Container name must be at least 3 characters',
  })
  @MaxLength(100, {
    message: 'Container name must not exceed 100 characters',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated container description',
    description: 'Updated container description',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({
    message: 'Description must be a string',
  })
  @MaxLength(500, {
    message: 'Description must not exceed 500 characters',
  })
  description?: string;

  @ApiPropertyOptional({
    example: 250.5,
    description:
      'Updated total container volume. Must not be lower than the currently used volume.',
    minimum: 0.01,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {
      allowInfinity: false,
      allowNaN: false,
      maxDecimalPlaces: 2,
    },
    {
      message: 'Total volume must be a valid number with at most 2 decimal places',
    },
  )
  @IsPositive({
    message: 'Total volume must be greater than 0',
  })
  totalVolume?: number;
}
