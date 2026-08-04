import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type {
  AuditAction,
  AuditCleanupParams,
  AuditCleanupResponse,
  AuditLog,
  AuditQueryParams,
  AuditStats,
  PaginatedAuditLogsResponse,
  PaginationParams,
} from '../types';

export const auditService = {
  getAll: async (
    params?: AuditQueryParams,
  ): Promise<PaginatedAuditLogsResponse> => {
    const response =
      await apiClient.get<PaginatedAuditLogsResponse>(
        API_ENDPOINTS.AUDIT.BASE,
        { params },
      );

    return response.data;
  },

  getStats: async (): Promise<AuditStats> => {
    const response =
      await apiClient.get<AuditStats>(
        API_ENDPOINTS.AUDIT.STATS,
      );

    return response.data;
  },

  getById: async (
    id: string,
  ): Promise<AuditLog> => {
    const response = await apiClient.get<AuditLog>(
      API_ENDPOINTS.AUDIT.BY_ID(id),
    );

    return response.data;
  },

  getByUser: async (
    userId: string,
    params?: PaginationParams,
  ): Promise<PaginatedAuditLogsResponse> => {
    const response =
      await apiClient.get<PaginatedAuditLogsResponse>(
        API_ENDPOINTS.AUDIT.BY_USER(userId),
        { params },
      );

    return response.data;
  },

  getByAction: async (
    action: AuditAction,
    params?: PaginationParams,
  ): Promise<PaginatedAuditLogsResponse> => {
    const response =
      await apiClient.get<PaginatedAuditLogsResponse>(
        API_ENDPOINTS.AUDIT.BY_ACTION(action),
        { params },
      );

    return response.data;
  },

  cleanup: async (
    params?: AuditCleanupParams,
  ): Promise<AuditCleanupResponse> => {
    // Normalizimi i days para dërgimit
    const days =
      params?.days !== undefined
        ? Math.max(1, Math.floor(params.days))
        : undefined;

    const response =
      await apiClient.delete<AuditCleanupResponse>(
        API_ENDPOINTS.AUDIT.CLEANUP,
        {
          params: { days },
        },
      );

    return response.data;
  },
};