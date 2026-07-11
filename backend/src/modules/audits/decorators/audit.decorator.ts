// src/modules/audits/decorators/audit.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../entities/audit-log.entity';

export const SKIP_AUDIT_KEY = 'skipAudit';
export const AUDIT_ACTION_KEY = 'auditAction';

export const SkipAudit = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_AUDIT_KEY, true);

export const Audit = (action: AuditAction): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDIT_ACTION_KEY, action);
