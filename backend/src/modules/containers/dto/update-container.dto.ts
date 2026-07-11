// src/modules/containers/dto/update-container.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContainerStatus } from '../entities/container.entity';

export class UpdateContainerDto {
  @ApiPropertyOptional({
    example: 'Container Alpha Updated',
    description: 'Updated container name',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(3, {
    message: 'Container name must be at least 3 characters',
  })
  @MaxLength(100, {
    message: 'Container name must not exceed 100 characters',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated container description',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, {
    message: 'Description must not exceed 500 characters',
  })
  description?: string;

  @ApiPropertyOptional({
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ContainerStatus, {
    message: `Invalid status. Must be one of: ${Object.values(ContainerStatus).join(', ')}`,
  })
  status?: ContainerStatus;
}
