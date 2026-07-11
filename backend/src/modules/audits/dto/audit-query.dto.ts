// src/modules/audits/dto/audit-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  AuditAction,
  AuditStatus,
} from '../entities/audit-log.entity';

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsUUID('4', {
    message:
      'User ID must be a valid UUID version 4',
  })
  userId?: string;

  @ApiPropertyOptional({
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction, {
    message: 'Invalid audit action',
  })
  action?: AuditAction;

  @ApiPropertyOptional({
    enum: AuditStatus,
  })
  @IsOptional()
  @IsEnum(AuditStatus, {
    message: 'Invalid audit status',
  })
  status?: AuditStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({
    message:
      'fromDate must be a valid ISO date',
  })
  fromDate?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({
    message:
      'toDate must be a valid ISO date',
  })
  toDate?: Date;
}