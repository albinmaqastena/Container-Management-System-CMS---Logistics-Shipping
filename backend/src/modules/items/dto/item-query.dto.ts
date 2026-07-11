// src/modules/items/dto/item-query.dto.ts

import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBooleanString,
  IsOptional,
  IsUUID,
} from 'class-validator';

import {
  PaginationDto,
} from '../../../common/dto/pagination.dto';

export class ItemQueryDto
  extends PaginationDto
{
  @ApiPropertyOptional({
    description:
      'Filter by container ID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', {
    message:
      'Container ID must be a valid UUID version 4',
  })
  containerId?: string;

  @ApiPropertyOptional({
    description:
      'Include soft-deleted items',
    example: 'false',
  })
  @IsOptional()
  @IsBooleanString({
    message:
      'includeDeleted must be true or false',
  })
  includeDeleted?: string;
}