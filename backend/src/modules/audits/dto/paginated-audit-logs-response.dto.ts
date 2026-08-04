// src/modules/audits/dto/paginated-audit-logs-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { AuditLog } from '../entities/audit-log.entity';
import { PaginatedResponseDto } from '../../../common/dto/pagination.dto';

export class PaginatedAuditLogsResponseDto extends PaginatedResponseDto<AuditLog> {
  @ApiProperty({
    type: () => [AuditLog],
    description: 'Array of audit logs for the current page',
  })
  declare data: AuditLog[];

  constructor(data: AuditLog[], total: number, limit: number, offset: number) {
    super(data, total, limit, offset);
  }
}
