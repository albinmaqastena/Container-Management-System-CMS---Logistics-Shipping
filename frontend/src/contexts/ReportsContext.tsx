// src/contexts/ReportsContext.tsx

import {
  createContext,
  useCallback,
  useMemo,
  useState,
} from 'react';

import type { ReactNode } from 'react';

import axios from 'axios';

import { reportsService } from '../services/reports.service';

import type { ReportQuery } from '../types';

export interface ReportsLoadingState {
  allContainersExcel: boolean;
  allContainersPdf: boolean;
  containerExcel: boolean;
  containerPdf: boolean;
}

export interface ReportsContextType {
  loading: ReportsLoadingState;
  isLoading: boolean;
  error: string | null;

  exportAllContainersExcel: (
    params?: ReportQuery,
  ) => Promise<void>;

  exportAllContainersPdf: (
    params?: ReportQuery,
  ) => Promise<void>;

  exportContainerExcel: (
    id: string,
  ) => Promise<void>;

  exportContainerPdf: (
    id: string,
  ) => Promise<void>;

  clearError: () => void;
}

interface ReportsProviderProps {
  children: ReactNode;
}

const initialLoadingState: ReportsLoadingState = {
  allContainersExcel: false,
  allContainersPdf: false,
  containerExcel: false,
  containerPdf: false,
};

const getErrorMessage = (
  error: unknown,
): string => {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (
      typeof message === 'string'
    ) {
      return message;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to generate report';
};

export const ReportsContext =
  createContext<ReportsContextType | undefined>(
    undefined,
  );

export const ReportsProvider = ({
  children,
}: ReportsProviderProps) => {
  const [
    loading,
    setLoading,
  ] = useState<ReportsLoadingState>(
    initialLoadingState,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const clearError =
    useCallback((): void => {
      setError(null);
    }, []);

  const setLoadingState = useCallback(
    (
      key: keyof ReportsLoadingState,
      value: boolean,
    ): void => {
      setLoading((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const exportAllContainersExcel =
    useCallback(
      async (
        params?: ReportQuery,
      ): Promise<void> => {
        setLoadingState(
          'allContainersExcel',
          true,
        );

        setError(null);

        try {
          await reportsService.exportAllContainersExcel(
            params,
          );
        } catch (
          err: unknown
        ) {
          const message =
            getErrorMessage(err);

          setError(message);

          throw err;
        } finally {
          setLoadingState(
            'allContainersExcel',
            false,
          );
        }
      },
      [setLoadingState],
    );

  const exportAllContainersPdf =
    useCallback(
      async (
        params?: ReportQuery,
      ): Promise<void> => {
        setLoadingState(
          'allContainersPdf',
          true,
        );

        setError(null);

        try {
          await reportsService.exportAllContainersPdf(
            params,
          );
        } catch (
          err: unknown
        ) {
          const message =
            getErrorMessage(err);

          setError(message);

          throw err;
        } finally {
          setLoadingState(
            'allContainersPdf',
            false,
          );
        }
      },
      [setLoadingState],
    );

  const exportContainerExcel =
    useCallback(
      async (
        id: string,
      ): Promise<void> => {
        setLoadingState(
          'containerExcel',
          true,
        );

        setError(null);

        try {
          await reportsService.exportContainerExcel(
            id,
          );
        } catch (
          err: unknown
        ) {
          const message =
            getErrorMessage(err);

          setError(message);

          throw err;
        } finally {
          setLoadingState(
            'containerExcel',
            false,
          );
        }
      },
      [setLoadingState],
    );

  const exportContainerPdf =
    useCallback(
      async (
        id: string,
      ): Promise<void> => {
        setLoadingState(
          'containerPdf',
          true,
        );

        setError(null);

        try {
          await reportsService.exportContainerPdf(
            id,
          );
        } catch (
          err: unknown
        ) {
          const message =
            getErrorMessage(err);

          setError(message);

          throw err;
        } finally {
          setLoadingState(
            'containerPdf',
            false,
          );
        }
      },
      [setLoadingState],
    );

  const isLoading =
    loading.allContainersExcel ||
    loading.allContainersPdf ||
    loading.containerExcel ||
    loading.containerPdf;

  const value =
    useMemo<ReportsContextType>(
      () => ({
        loading,
        isLoading,
        error,

        exportAllContainersExcel,
        exportAllContainersPdf,
        exportContainerExcel,
        exportContainerPdf,

        clearError,
      }),
      [
        loading,
        isLoading,
        error,
        exportAllContainersExcel,
        exportAllContainersPdf,
        exportContainerExcel,
        exportContainerPdf,
        clearError,
      ],
    );

  return (
    <ReportsContext.Provider
      value={value}
    >
      {children}
    </ReportsContext.Provider>
  );
};

export default ReportsContext;