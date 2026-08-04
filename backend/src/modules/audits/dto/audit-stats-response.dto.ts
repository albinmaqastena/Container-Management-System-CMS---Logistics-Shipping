// src/modules/audits/dto/audit-stats-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditStatus } from '../entities/audit-log.entity';

export class AuditStatsResponseDto {
  @ApiProperty({
    example: 1024,
    description: 'Total number of audit logs',
  })
  total!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Count of audit logs grouped by action',
    example: { login: 150, logout: 120, user_create: 45 },
  })
  byAction!: Partial<Record<AuditAction, number>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Count of audit logs grouped by status',
    example: { success: 950, failed: 74 },
  })
  byStatus!: Partial<Record<AuditStatus, number>>;

  @ApiProperty({
    example: 42,
    description: 'Number of audit logs created in the last 24 hours',
  })
  last24h!: number;

  @ApiProperty({
    example: 320,
    description: 'Number of audit logs created in the last 7 days',
  })
  last7d!: number;

  constructor(partial?: Partial<AuditStatsResponseDto>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
