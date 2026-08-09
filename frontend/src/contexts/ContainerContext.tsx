// src/contexts/ContainerContext.tsx
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

import { containerService } from '../services/container.service';
import type {
  Container,
  ContainerStatus,
  ContainerQueryParams,
  CreateContainerData,
  UpdateContainerData,
  PaginationParams,
  PaginatedResponse,
  PaginationState,
} from '../types';
import { useAuth } from '../hooks/useAuth';

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
export interface ContainerContextType {
  // State
  containers: Container[];
  activeContainers: Container[];
  archivedContainers: Container[];
  deletedContainers: Container[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  pagination: PaginationState;
  activePagination: PaginationState;
  archivedPagination: PaginationState;
  deletedPagination: PaginationState;

  // Fetch methods
  fetchContainers: (params?: ContainerQueryParams) => Promise<void>;
  fetchActiveContainers: (params?: PaginationParams) => Promise<void>;
  fetchArchivedContainers: (params?: PaginationParams) => Promise<void>;
  fetchDeletedContainers: (params?: PaginationParams) => Promise<void>;

  // CRUD
  getContainer: (id: string, includeDeleted?: boolean) => Promise<Container>;
  createContainer: (data: CreateContainerData) => Promise<Container>;
  updateContainer: (id: string, data: UpdateContainerData) => Promise<Container>;
  updateContainerStatus: (id: string, status: ContainerStatus) => Promise<Container>;
  softDeleteContainer: (id: string) => Promise<void>;
  restoreContainer: (id: string) => Promise<Container>;
  permanentDeleteContainer: (id: string) => Promise<void>;

  // Search
  searchContainers: (query: string, params?: PaginationParams) => Promise<PaginatedResponse<Container>>;

  // Utils
  clearError: () => void;
  resetContainerFilters: () => Promise<void>;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const ContainerContext = createContext<ContainerContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface ContainerProviderProps {
  children: ReactNode;
}

export const ContainerProvider = ({ children }: ContainerProviderProps) => {
  // State
  const [containers, setContainers] = useState<Container[]>([]);
  const [activeContainers, setActiveContainers] = useState<Container[]>([]);
  const [archivedContainers, setArchivedContainers] = useState<Container[]>([]);
  const [deletedContainers, setDeletedContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const [activePagination, setActivePagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const [archivedPagination, setArchivedPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const [deletedPagination, setDeletedPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const {
  isAuthenticated,
  isLoading: authLoading,
} = useAuth();

  // Ref për numërimin e kërkesave aktive për isFetching dhe isLoading
  const fetchCountRef = useRef(0);
  const loadingCountRef = useRef(0);

  // Ref për të mbajtur parametrat më të fundit të kërkesës për refetch
  const containerQueryRef = useRef<ContainerQueryParams | undefined>(undefined);
  const activeQueryRef = useRef<PaginationParams | undefined>(undefined);
  const archivedQueryRef = useRef<PaginationParams | undefined>(undefined);
  const deletedQueryRef = useRef<PaginationParams | undefined>(undefined);

  // ------------------------------------------------------------------
  // Menaxhimi i isFetching dhe isLoading me counter
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

  const startLoading = useCallback((): void => {
    loadingCountRef.current += 1;
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback((): void => {
    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
    if (loadingCountRef.current === 0) {
      setIsLoading(false);
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
    (response: PaginatedResponse<Container>): PaginationState => ({
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
  const loadContainers = useCallback(
    async (params?: ContainerQueryParams): Promise<void> => {
      if (params !== undefined) {
        containerQueryRef.current = params;
      }
      const response = await containerService.getAll(containerQueryRef.current);
      setContainers(response.data);
      setPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadActiveContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      if (params !== undefined) {
        activeQueryRef.current = params;
      }
      const response = await containerService.getActive(activeQueryRef.current);
      setActiveContainers(response.data);
      setActivePagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadArchivedContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      if (params !== undefined) {
        archivedQueryRef.current = params;
      }
      const response = await containerService.getArchived(archivedQueryRef.current);
      setArchivedContainers(response.data);
      setArchivedPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadDeletedContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      if (params !== undefined) {
        deletedQueryRef.current = params;
      }
      const response = await containerService.getDeleted(deletedQueryRef.current);
      setDeletedContainers(response.data);
      setDeletedPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  // ------------------------------------------------------------------
  // Fetch functions (publike – menaxhojnë isFetching dhe gabimet)
  // ------------------------------------------------------------------
  const fetchContainers = useCallback(
    async (params?: ContainerQueryParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadContainers(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadContainers],
  );

  const fetchActiveContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadActiveContainers(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadActiveContainers],
  );

  const fetchArchivedContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadArchivedContainers(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadArchivedContainers],
  );

  const fetchDeletedContainers = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadDeletedContainers(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadDeletedContainers],
  );

  const resetContainerFilters = useCallback(
    async (): Promise<void> => {
      containerQueryRef.current = undefined;

      startFetching();
      setError(null);

      try {
        await loadContainers();
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [
      startFetching,
      stopFetching,
      handleError,
      loadContainers,
    ],
  );

  // ------------------------------------------------------------------
  // CRUD functions
  // ------------------------------------------------------------------
  const getContainer = useCallback(
    async (id: string, includeDeleted = false): Promise<Container> => {
      startLoading();
      setError(null);
      try {
        return await containerService.getById(id, includeDeleted);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError],
  );

  const createContainer = useCallback(
    async (data: CreateContainerData): Promise<Container> => {
      startLoading();
      setError(null);
      try {
        const container = await containerService.create(data);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadActiveContainers(activeQueryRef.current),
          loadArchivedContainers(archivedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container created, but some lists could not be refreshed');
        } else {
          toast.success('Container created successfully!');
        }

        return container;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [
      startLoading,
      stopLoading,
      handleError,
      loadContainers,
      loadActiveContainers,
      loadArchivedContainers,
    ],
  );

  const updateContainer = useCallback(
    async (id: string, data: UpdateContainerData): Promise<Container> => {
      startLoading();
      setError(null);
      try {
        const container = await containerService.update(id, data);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadActiveContainers(activeQueryRef.current),
          loadArchivedContainers(archivedQueryRef.current),
          loadDeletedContainers(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container updated, but some lists could not be refreshed');
        } else {
          toast.success('Container updated successfully!');
        }

        return container;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [
      startLoading,
      stopLoading,
      handleError,
      loadContainers,
      loadActiveContainers,
      loadArchivedContainers,
      loadDeletedContainers,
    ],
  );

  const updateContainerStatus = useCallback(
    async (id: string, status: ContainerStatus): Promise<Container> => {
      startLoading();
      setError(null);
      try {
        const container = await containerService.updateStatus(id, status);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadActiveContainers(activeQueryRef.current),
          loadArchivedContainers(archivedQueryRef.current),
          loadDeletedContainers(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container status updated, but some lists could not be refreshed');
        } else {
          toast.success(`Container status updated to ${status}`);
        }

        return container;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [
      startLoading,
      stopLoading,
      handleError,
      loadContainers,
      loadActiveContainers,
      loadArchivedContainers,
      loadDeletedContainers,
    ],
  );

  const softDeleteContainer = useCallback(
    async (id: string): Promise<void> => {
      startLoading();
      setError(null);
      try {
        await containerService.softDelete(id);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadActiveContainers(activeQueryRef.current),
          loadArchivedContainers(archivedQueryRef.current),
          loadDeletedContainers(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container moved to trash, but some lists could not be refreshed');
        } else {
          toast.success('Container moved to trash');
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [
      startLoading,
      stopLoading,
      handleError,
      loadContainers,
      loadActiveContainers,
      loadArchivedContainers,
      loadDeletedContainers,
    ],
  );

  const restoreContainer = useCallback(
    async (id: string): Promise<Container> => {
      startLoading();
      setError(null);
      try {
        const container = await containerService.restore(id);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadActiveContainers(activeQueryRef.current),
          loadArchivedContainers(archivedQueryRef.current),
          loadDeletedContainers(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container restored, but some lists could not be refreshed');
        } else {
          toast.success('Container restored successfully!');
        }

        return container;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [
      startLoading,
      stopLoading,
      handleError,
      loadContainers,
      loadActiveContainers,
      loadArchivedContainers,
      loadDeletedContainers,
    ],
  );

  const permanentDeleteContainer = useCallback(
    async (id: string): Promise<void> => {
      startLoading();
      setError(null);
      try {
        await containerService.permanentDelete(id);

        const { failed, firstError } = await refreshLists([
          loadContainers(containerQueryRef.current),
          loadDeletedContainers(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Container permanently deleted, but some lists could not be refreshed');
        } else {
          toast.success('Container permanently deleted');
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadContainers, loadDeletedContainers],
  );

  const searchContainers = useCallback(
    async (query: string, params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
      startFetching();
      setError(null);
      try {
        return await containerService.search(query, params);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError],
  );

  // ------------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------------
  useEffect(() => {
  if (authLoading) {
    return;
  }

  if (!isAuthenticated) {
    setContainers([]);
    setActiveContainers([]);
    setArchivedContainers([]);
    setDeletedContainers([]);
    return;
  }

  void Promise.all([
    fetchActiveContainers(),
    fetchArchivedContainers(),
  ]);
}, [
  authLoading,
  isAuthenticated,
  fetchActiveContainers,
  fetchArchivedContainers,
]);

  // ------------------------------------------------------------------
  // Expose context value
  // ------------------------------------------------------------------
  const value = useMemo<ContainerContextType>(
    () => ({
      containers,
      activeContainers,
      archivedContainers,
      deletedContainers,
      isLoading,
      isFetching,
      error,
      pagination,
      activePagination,
      archivedPagination,
      deletedPagination,
      fetchContainers,
      fetchActiveContainers,
      fetchArchivedContainers,
      fetchDeletedContainers,
      getContainer,
      createContainer,
      updateContainer,
      updateContainerStatus,
      softDeleteContainer,
      restoreContainer,
      permanentDeleteContainer,
      searchContainers,
      clearError,
      resetContainerFilters,
    }),
    [
      containers,
      activeContainers,
      archivedContainers,
      deletedContainers,
      isLoading,
      isFetching,
      error,
      pagination,
      activePagination,
      archivedPagination,
      deletedPagination,
      fetchContainers,
      fetchActiveContainers,
      fetchArchivedContainers,
      fetchDeletedContainers,
      getContainer,
      createContainer,
      updateContainer,
      updateContainerStatus,
      softDeleteContainer,
      restoreContainer,
      permanentDeleteContainer,
      searchContainers,
      clearError,
      resetContainerFilters,
    ],
  );

  return <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>;
};