import type {
  PaginatedResponse,
  PaginationParams,
} from './api.types';
import type { User } from './auth.types';

/*
 * Vlerat konkrete të AuditAction duhet të jenë identike
 * me enum-in AuditAction në audit-log.entity.ts.
 *
 * Derisa të kopjohen vlerat reale të backend-it,
 * përdorim string për të mos shpikur enum values.
 */
export type AuditAction = string;

/*
 * Backend-i përdor AuditStatus në statistika dhe filtrim.
 * Zakonisht statuset janë success dhe failure, por këto
 * vlera duhet të verifikohen në audit-log.entity.ts.
 */
export type AuditStatus = string;

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
}

export interface AuditLog {
  id: string;

  userId: string | null;
  user?: User | null;

  action: AuditAction;
  status: AuditStatus;

  targetId: string | null;
  targetType: string | null;

  changes: Record<string, unknown> | null;
  metadata: AuditMetadata | null;

  errorMessage: string | null;

  createdAt: string;
}

export interface AuditQueryParams
  extends PaginationParams {
  userId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  fromDate?: string;
  toDate?: string;
}

export interface AuditCleanupParams {
  days?: number;
}

export interface AuditCleanupResponse {
  deleted: number;
  message: string;
}

export interface AuditStats {
  total: number;
  byAction: Partial<
    Record<AuditAction, number>
  >;
  byStatus: Partial<
    Record<AuditStatus, number>
  >;
  last24h: number;
  last7d: number;
}

export type PaginatedAuditLogsResponse =
  PaginatedResponse<AuditLog>;