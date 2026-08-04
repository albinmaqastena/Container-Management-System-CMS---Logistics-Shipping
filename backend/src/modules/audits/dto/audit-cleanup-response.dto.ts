// src/modules/audits/dto/audit-cleanup-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class AuditCleanupResponseDto {
  @ApiProperty({
    example: 125,
    description: 'Number of audit logs deleted',
  })
  deleted!: number;

  @ApiProperty({
    example: 'Deleted 125 audit logs older than 90 days',
    description: 'Human-readable message about the cleanup operation',
  })
  message!: string;

  constructor(partial?: Partial<AuditCleanupResponseDto>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
