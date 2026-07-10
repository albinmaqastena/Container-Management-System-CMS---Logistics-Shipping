// src/modules/items/dto/item-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsBooleanString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ItemQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by container ID' })
  @IsOptional()
  @IsUUID()
  containerId?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted items', example: 'false' })
  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}