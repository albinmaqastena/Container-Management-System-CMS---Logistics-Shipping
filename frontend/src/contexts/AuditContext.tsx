// src/contexts/AuditContext.tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

import { auditService } from '../services/audit.service';
import type {
  AuditAction,
  AuditCleanupParams,
  AuditCleanupResponse,
  AuditLog,
  AuditQueryParams,
  AuditStats,
  PaginatedAuditLogsResponse,
  PaginationParams,
  PaginationState,
} from '../types';

// ------------------------------------------------------------------
// Helpers (jashtë komponentit)
// ------------------------------------------------------------------
const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred';
};

const DEFAULT_PAGINATION: PaginationState = {
  total: 0,
  limit: 10,
  offset: 0,
  hasMore: false,
};

// Helper për të ekzekutuar disa kërkesa dhe për të kontrolluar nëse ndonjë dështoi
const refreshLists = async (
  tasks: readonly Promise<void>[],
): Promise<{ failed: boolean; firstError?: unknown }> => {
  const results = await Promise.allSettled(tasks);
  const failedResult = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  return {
    failed: !!failedResult,
    firstError: failedResult?.reason,
  };
};

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type ActiveAuditQuery =
  | {
      type: 'all';
      params?: AuditQueryParams;
    }
  | {
      type: 'user';
      userId: string;
      params?: PaginationParams;
    }
  | {
      type: 'action';
      action: AuditAction;
      params?: PaginationParams;
    };

export interface AuditContextType {
  // State
  logs: AuditLog[];
  stats: AuditStats | null;
  isFetching: boolean;
  error: string | null;
  pagination: PaginationState;

  // Fetch methods
  fetchLogs: (params?: AuditQueryParams) => Promise<void>;
  fetchStats: () => Promise<void>;
  getLog: (id: string) => Promise<AuditLog>;
  fetchLogsByUser: (userId: string, params?: PaginationParams) => Promise<void>;
  fetchLogsByAction: (action: AuditAction, params?: PaginationParams) => Promise<void>;

  // Cleanup
  cleanup: (params?: AuditCleanupParams) => Promise<AuditCleanupResponse>;

  // Utils
  clearError: () => void;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const AuditContext = createContext<AuditContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface AuditProviderProps {
  children: ReactNode;
}

export const AuditProvider = ({ children }: AuditProviderProps) => {
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });

  // Ref për numërimin e kërkesave aktive për isFetching
  const fetchCountRef = useRef(0);

  // Ref për të mbajtur filtrin aktiv
  const activeQueryRef = useRef<ActiveAuditQuery>({ type: 'all' });

  // ------------------------------------------------------------------
  // Menaxhimi i isFetching me counter
  // ------------------------------------------------------------------
  const startFetching = useCallback((): void => {
    fetchCountRef.current += 1;
    setIsFetching(true);
  }, []);

  const stopFetching = useCallback((): void => {
    fetchCountRef.current = Math.max(0, fetchCountRef.current - 1);
    if (fetchCountRef.current === 0) {
      setIsFetching(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Error handler
  // ------------------------------------------------------------------
  const handleError = useCallback((err: unknown): void => {
    const message = getErrorMessage(err);
    setError(message);
    toast.error(message);
  }, []);

  const clearError = useCallback((): void => setError(null), []);

  // ------------------------------------------------------------------
  // Helper për të krijuar pagination nga response
  // ------------------------------------------------------------------
  const createPaginationState = useCallback(
    (response: PaginatedAuditLogsResponse): PaginationState => ({
      total: response.total,
      limit: response.limit,
      offset: response.offset,
      hasMore: response.offset + response.data.length < response.total,
    }),
    [],
  );

  // ------------------------------------------------------------------
  // Load functions (private – hedhin gabime për t'u trajtuar nga thirrësi)
  // ------------------------------------------------------------------
  const loadLogs = useCallback(
    async (params?: AuditQueryParams): Promise<void> => {
      const response = await auditService.getAll(params);
      activeQueryRef.current = { type: 'all', params };
      setLogs(response.data);
      setPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadStats = useCallback(async (): Promise<void> => {
    const data = await auditService.getStats();
    setStats(data);
  }, []);

  const loadLogsByUser = useCallback(
    async (userId: string, params?: PaginationParams): Promise<void> => {
      const response = await auditService.getByUser(userId, params);
      activeQueryRef.current = { type: 'user', userId, params };
      setLogs(response.data);
      setPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadLogsByAction = useCallback(
    async (action: AuditAction, params?: PaginationParams): Promise<void> => {
      const response = await auditService.getByAction(action, params);
      activeQueryRef.current = { type: 'action', action, params };
      setLogs(response.data);
      setPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  // ------------------------------------------------------------------
  // Reload active logs (përdoret pas cleanup)
  // ------------------------------------------------------------------
  const reloadActiveLogs = useCallback(async (): Promise<void> => {
    const activeQuery = activeQueryRef.current;

    switch (activeQuery.type) {
      case 'user':
        await loadLogsByUser(activeQuery.userId, activeQuery.params);
        return;
      case 'action':
        await loadLogsByAction(activeQuery.action, activeQuery.params);
        return;
      default:
        await loadLogs(activeQuery.params);
    }
  }, [loadLogs, loadLogsByUser, loadLogsByAction]);

  // ------------------------------------------------------------------
  // Fetch functions (publike – menaxhojnë isFetching dhe gabimet)
  // ------------------------------------------------------------------
  const fetchLogs = useCallback(
    async (params?: AuditQueryParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadLogs(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadLogs],
  );

  const fetchStats = useCallback(async (): Promise<void> => {
    startFetching();
    setError(null);
    try {
      await loadStats();
    } catch (err) {
      handleError(err);
    } finally {
      stopFetching();
    }
  }, [startFetching, stopFetching, handleError, loadStats]);

  const getLog = useCallback(
    async (id: string): Promise<AuditLog> => {
      startFetching();
      setError(null);
      try {
        return await auditService.getById(id);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError],
  );

  const fetchLogsByUser = useCallback(
    async (userId: string, params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadLogsByUser(userId, params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadLogsByUser],
  );

  const fetchLogsByAction = useCallback(
    async (action: AuditAction, params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadLogsByAction(action, params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadLogsByAction],
  );

  const cleanup = useCallback(
    async (params?: AuditCleanupParams): Promise<AuditCleanupResponse> => {
      startFetching();
      setError(null);
      try {
        const response = await auditService.cleanup(params);

        const { failed, firstError } = await refreshLists([
          reloadActiveLogs(),
          loadStats(),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Audit logs were cleaned up, but the data could not be refreshed');
        } else {
          toast.success(response.message || 'Audit logs cleaned up successfully!');
        }

        return response;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, reloadActiveLogs, loadStats],
  );

  // ------------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    void Promise.all([fetchLogs(), fetchStats()]);
  }, [fetchLogs, fetchStats]);

  // ------------------------------------------------------------------
  // Expose context value
  // ------------------------------------------------------------------
  const value = useMemo<AuditContextType>(
    () => ({
      logs,
      stats,
      isFetching,
      error,
      pagination,
      fetchLogs,
      fetchStats,
      getLog,
      fetchLogsByUser,
      fetchLogsByAction,
      cleanup,
      clearError,
    }),
    [
      logs,
      stats,
      isFetching,
      error,
      pagination,
      fetchLogs,
      fetchStats,
      getLog,
      fetchLogsByUser,
      fetchLogsByAction,
      cleanup,
      clearError,
    ],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
};