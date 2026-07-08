// src/modules/audit/decorators/audit.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../entities/audit-log.entity';

export const SKIP_AUDIT_KEY = 'skipAudit';
export const AUDIT_ACTION_KEY = 'auditAction';

/**
 * Dekorator për të çaktivizuar auditimin për një endpoint
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/**
 * Dekorator për të specifikuar veprimin e auditimit
 */
export const Audit = (action: AuditAction) => SetMetadata(AUDIT_ACTION_KEY, action);