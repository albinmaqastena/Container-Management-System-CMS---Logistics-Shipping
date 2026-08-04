// src/modules/reports/dto/report-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

import { ContainerStatus } from '../../containers/entities/container.entity';

export class ReportQueryDto {
  @ApiPropertyOptional({
    enum: ContainerStatus,
    description: 'Filter reports by container status',
  })
  @IsOptional()
  @IsEnum(ContainerStatus, {
    message: `Invalid status. Must be one of: ${Object.values(ContainerStatus).join(', ')}`,
  })
  status?: ContainerStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Include containers created on or after this date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'fromDate must be a valid date' })
  fromDate?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Include containers created on or before this date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'toDate must be a valid date' })
  toDate?: Date;
}
