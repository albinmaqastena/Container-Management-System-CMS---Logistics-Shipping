// src/modules/containers/dto/container-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ContainerStatus } from '../entities/container.entity';

export class ContainerQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ContainerStatus,
    description: 'Filter containers by status',
  })
  @IsOptional()
  @IsEnum(ContainerStatus, {
    message: `Invalid status. Must be one of: ${Object.values(ContainerStatus).join(', ')}`,
  })
  status?: ContainerStatus;

  @ApiPropertyOptional({
    example: 'false',
    description: 'Include soft-deleted containers',
  })
  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}
