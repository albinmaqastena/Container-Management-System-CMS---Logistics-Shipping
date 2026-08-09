// src/contexts/ItemContext.tsx
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

import { itemService } from '../services/item.service';
import type {
  Item,
  CreateItemData,
  UpdateItemData,
  PaginationParams,
  PaginatedResponse,
  PaginationState,
  ItemQueryParams,
  ItemSearchParams,
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
export interface ItemContextType {
  // State
  items: Item[];
  deletedItems: Item[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  pagination: PaginationState;
  deletedPagination: PaginationState;

  // Fetch methods
  fetchItems: (params?: ItemQueryParams) => Promise<void>;
  fetchDeletedItems: (params?: PaginationParams) => Promise<void>;

  // CRUD
  getItem: (id: string, includeDeleted?: boolean) => Promise<Item>;
  createItem: (data: CreateItemData) => Promise<Item>;
  updateItem: (id: string, data: UpdateItemData) => Promise<Item>;
  softDeleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<Item>;
  permanentDeleteItem: (id: string) => Promise<void>;

  // Search
  searchItems: (query: string, params?: ItemSearchParams) => Promise<PaginatedResponse<Item>>;

  // Utils
  clearError: () => void;
  resetItemFilters: () => Promise<void>;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const ItemContext = createContext<ItemContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface ItemProviderProps {
  children: ReactNode;
}

export const ItemProvider = ({ children }: ItemProviderProps) => {
  // State
  const [items, setItems] = useState<Item[]>([]);
  const [deletedItems, setDeletedItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const [deletedPagination, setDeletedPagination] = useState<PaginationState>({ ...DEFAULT_PAGINATION });
  const {
  isAuthenticated,
  isLoading: authLoading,
} = useAuth();

  // Ref për numërimin e kërkesave aktive për isFetching dhe isLoading
  const fetchCountRef = useRef(0);
  const loadingCountRef = useRef(0);

  // Ref për të mbajtur parametrat më të fundit të kërkesës për refetch
  const itemQueryRef = useRef<ItemQueryParams | undefined>(undefined);
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
    (response: PaginatedResponse<Item>): PaginationState => ({
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
  const loadItems = useCallback(
    async (params?: ItemQueryParams): Promise<void> => {
      if (params !== undefined) {
        itemQueryRef.current = params;
      }
      const response = await itemService.getAll(itemQueryRef.current);
      setItems(response.data);
      setPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  const loadDeletedItems = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      if (params !== undefined) {
        deletedQueryRef.current = params;
      }
      const response = await itemService.getDeleted(deletedQueryRef.current);
      setDeletedItems(response.data);
      setDeletedPagination(createPaginationState(response));
    },
    [createPaginationState],
  );

  // ------------------------------------------------------------------
  // Fetch functions (publike – menaxhojnë isFetching dhe gabimet)
  // ------------------------------------------------------------------
  const fetchItems = useCallback(
    async (params?: ItemQueryParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadItems(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadItems],
  );

  const fetchDeletedItems = useCallback(
    async (params?: PaginationParams): Promise<void> => {
      startFetching();
      setError(null);
      try {
        await loadDeletedItems(params);
      } catch (err) {
        handleError(err);
      } finally {
        stopFetching();
      }
    },
    [startFetching, stopFetching, handleError, loadDeletedItems],
  );

  const resetItemFilters = useCallback(
    async (): Promise<void> => {
      itemQueryRef.current = undefined;

      startFetching();
      setError(null);

      try {
        await loadItems();
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
      loadItems,
    ],
  );

  // ------------------------------------------------------------------
  // CRUD functions
  // ------------------------------------------------------------------
  const getItem = useCallback(
    async (id: string, includeDeleted = false): Promise<Item> => {
      startLoading();
      setError(null);
      try {
        return await itemService.getById(id, includeDeleted);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError],
  );

  const createItem = useCallback(
    async (data: CreateItemData): Promise<Item> => {
      startLoading();
      setError(null);
      try {
        const item = await itemService.create(data);

        const { failed, firstError } = await refreshLists([
          loadItems(itemQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Item created, but some lists could not be refreshed');
        } else {
          toast.success('Item created successfully!');
        }

        return item;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadItems],
  );

  const updateItem = useCallback(
    async (id: string, data: UpdateItemData): Promise<Item> => {
      startLoading();
      setError(null);
      try {
        const item = await itemService.update(id, data);

        const { failed, firstError } = await refreshLists([
          loadItems(itemQueryRef.current),
          loadDeletedItems(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Item updated, but some lists could not be refreshed');
        } else {
          toast.success('Item updated successfully!');
        }

        return item;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadItems, loadDeletedItems],
  );

  const softDeleteItem = useCallback(
    async (id: string): Promise<void> => {
      startLoading();
      setError(null);
      try {
        await itemService.softDelete(id);

        const { failed, firstError } = await refreshLists([
          loadItems(itemQueryRef.current),
          loadDeletedItems(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Item moved to trash, but some lists could not be refreshed');
        } else {
          toast.success('Item moved to trash');
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadItems, loadDeletedItems],
  );

  const restoreItem = useCallback(
    async (id: string): Promise<Item> => {
      startLoading();
      setError(null);
      try {
        const item = await itemService.restore(id);

        const { failed, firstError } = await refreshLists([
          loadItems(itemQueryRef.current),
          loadDeletedItems(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Item restored, but some lists could not be refreshed');
        } else {
          toast.success('Item restored successfully!');
        }

        return item;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadItems, loadDeletedItems],
  );

  const permanentDeleteItem = useCallback(
    async (id: string): Promise<void> => {
      startLoading();
      setError(null);
      try {
        await itemService.permanentDelete(id);

        const { failed, firstError } = await refreshLists([
          loadItems(itemQueryRef.current),
          loadDeletedItems(deletedQueryRef.current),
        ]);

        if (failed) {
          setError(getErrorMessage(firstError));
          toast.warning('Item permanently deleted, but some lists could not be refreshed');
        } else {
          toast.success('Item permanently deleted');
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, handleError, loadItems, loadDeletedItems],
  );

  const searchItems = useCallback(
    async (query: string, params?: ItemSearchParams): Promise<PaginatedResponse<Item>> => {
      startFetching();
      setError(null);
      try {
        return await itemService.search(query, params);
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
    setItems([]);
    setDeletedItems([]);
    return;
  }

  void fetchItems();
}, [
  authLoading,
  isAuthenticated,
  fetchItems,
]);

  // ------------------------------------------------------------------
  // Expose context value
  // ------------------------------------------------------------------
  const value = useMemo<ItemContextType>(
    () => ({
      items,
      deletedItems,
      isLoading,
      isFetching,
      error,
      pagination,
      deletedPagination,
      fetchItems,
      fetchDeletedItems,
      getItem,
      createItem,
      updateItem,
      softDeleteItem,
      restoreItem,
      permanentDeleteItem,
      searchItems,
      clearError,
      resetItemFilters,
    }),
    [
      items,
      deletedItems,
      isLoading,
      isFetching,
      error,
      pagination,
      deletedPagination,
      fetchItems,
      fetchDeletedItems,
      getItem,
      createItem,
      updateItem,
      softDeleteItem,
      restoreItem,
      permanentDeleteItem,
      searchItems,
      clearError,
      resetItemFilters,
    ],
  );

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};