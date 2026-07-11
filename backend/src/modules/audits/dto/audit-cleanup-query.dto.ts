// src/modules/audits/dto/audit-cleanup-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AuditCleanupQueryDto {
  @ApiPropertyOptional({
    example: 90,
    minimum: 1,
    maximum: 3650,
    default: 90,
    description: 'Delete audit logs older than this number of days',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Days must be an integer',
  })
  @Min(1, {
    message: 'Days must be at least 1',
  })
  @Max(3650, {
    message: 'Days must not exceed 3650',
  })
  days?: number;
}
