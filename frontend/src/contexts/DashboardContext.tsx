// src/contexts/DashboardContext.tsx
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

import { dashboardService } from '../services/dashboard.service';
import type { DashboardSummary } from '../types';

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

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface DashboardContextType {
  // State
  summary: DashboardSummary | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;

  // Methods
  fetchSummary: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  clearError: () => void;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  // State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref për numërimin e kërkesave aktive
  const fetchCountRef = useRef(0);

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
  // Load function (private – hedh gabim për t'u trajtuar nga thirrësi)
  // ------------------------------------------------------------------
  const loadSummary = useCallback(async (): Promise<void> => {
    const data = await dashboardService.getSummary();
    setSummary(data);
  }, []);

  // ------------------------------------------------------------------
  // Fetch function (publike – menaxhon isFetching dhe gabimet)
  // ------------------------------------------------------------------
  const fetchSummary = useCallback(async (): Promise<void> => {
    startFetching();
    setError(null);

    try {
      await loadSummary();
    } catch (err) {
      handleError(err);
    } finally {
      stopFetching();
    }
  }, [startFetching, stopFetching, handleError, loadSummary]);

  // ------------------------------------------------------------------
  // Refresh (alias për fetch)
  // ------------------------------------------------------------------
  const refreshSummary = useCallback(async (): Promise<void> => {
    await fetchSummary();
  }, [fetchSummary]);

  // ------------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  // ------------------------------------------------------------------
  // Expose context value
  // ------------------------------------------------------------------
  const value = useMemo<DashboardContextType>(
    () => ({
      summary,
      isLoading,
      isFetching,
      error,
      fetchSummary,
      refreshSummary,
      clearError,
    }),
    [summary, isLoading, isFetching, error, fetchSummary, refreshSummary, clearError],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};