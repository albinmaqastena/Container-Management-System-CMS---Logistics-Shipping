// src/modules/containers/dto/container-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
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
    type: Boolean,
    description: 'Include soft-deleted containers',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): boolean | string | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return typeof value === 'string' ? value : '[invalid-boolean]';
  })
  @IsBoolean({
    message: 'includeDeleted must be a boolean value',
  })
  includeDeleted?: boolean;
}
