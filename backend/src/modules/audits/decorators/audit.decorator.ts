// src/modules/audits/decorators/audit.decorator.ts

import { applyDecorators, SetMetadata } from '@nestjs/common';

import { AuditAction } from '../entities/audit-log.entity';

export const SKIP_AUDIT_KEY = Symbol('SKIP_AUDIT');
export const AUDIT_ACTION_KEY = Symbol('AUDIT_ACTION');

export const SkipAudit = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(SKIP_AUDIT_KEY, true));

export const Audit = (action: AuditAction): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(AUDIT_ACTION_KEY, action));
