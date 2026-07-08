// src/modules/containers/dto/update-container.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ContainerStatus } from '../entities/container.entity';

export class UpdateContainerDto {
  @ApiProperty({ required: false })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Container name must be at least 3 characters' })
  @MaxLength(100, { message: 'Container name must not exceed 100 characters' })
  name?: string;

  @ApiProperty({ required: false })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiProperty({ enum: ContainerStatus, required: false })
  @IsEnum(ContainerStatus, {
    message: 'Invalid status. Must be one of: active, shipped, archived',
  })
  @IsOptional()
  status?: ContainerStatus;
}