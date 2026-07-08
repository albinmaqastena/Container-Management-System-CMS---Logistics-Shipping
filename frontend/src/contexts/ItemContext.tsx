// src/contexts/ItemContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { itemService } from '../services/item.service';
import {
  Item,
  CreateItemData,
  UpdateItemData,
  PaginationParams,
  PaginatedResponse, // ✅ Shto këtë import
} from '../types';
import { toast } from 'react-toastify';

interface ItemContextType {
  items: Item[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  fetchItems: (containerId?: string, params?: PaginationParams) => Promise<void>;
  fetchDeletedItems: (params?: PaginationParams) => Promise<void>;
  getItem: (id: string) => Promise<Item>;
  createItem: (data: CreateItemData) => Promise<Item>;
  updateItem: (id: string, data: UpdateItemData) => Promise<Item>;
  softDeleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<Item>;
  permanentDeleteItem: (id: string) => Promise<void>;
  searchItems: (query: string, params?: PaginationParams & { containerId?: string }) => Promise<PaginatedResponse<Item>>; // ✅ Përditësuar
  clearError: () => void;
}

// ✅ Krijimi i context-it
const ItemContext = createContext<ItemContextType | undefined>(undefined);

// ✅ Hook i personalizuar për përdorimin e context-it
export const useItems = () => {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error('useItems must be used within an ItemProvider');
  }
  return context;
};

interface ItemProviderProps {
  children: ReactNode;
}

// ✅ Provider komponenti
export const ItemProvider: React.FC<ItemProviderProps> = ({ children }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false,
  });

  const handleError = (error: any) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    setError(message);
    toast.error(message);
  };

  const fetchItems = async (containerId?: string, params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await itemService.getAll(containerId, params);
      setItems(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
      });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedItems = async (params?: PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await itemService.getDeleted(params);
      setItems(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
      });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const getItem = async (id: string): Promise<Item> => {
    setLoading(true);
    setError(null);
    try {
      return await itemService.getById(id);
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (data: CreateItemData): Promise<Item> => {
    setLoading(true);
    setError(null);
    try {
      const item = await itemService.create(data);
      await fetchItems(data.containerId);
      toast.success('Item created successfully!');
      return item;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (id: string, data: UpdateItemData): Promise<Item> => {
    setLoading(true);
    setError(null);
    try {
      const item = await itemService.update(id, data);
      await fetchItems(item.container.id);
      toast.success('Item updated successfully!');
      return item;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const softDeleteItem = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await itemService.softDelete(id);
      await fetchItems();
      toast.success('Item moved to trash');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const restoreItem = async (id: string): Promise<Item> => {
    setLoading(true);
    setError(null);
    try {
      const item = await itemService.restore(id);
      await fetchItems();
      toast.success('Item restored successfully!');
      return item;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const permanentDeleteItem = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await itemService.permanentDelete(id);
      await fetchItems();
      toast.success('Item permanently deleted');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ searchItems - përditësuar për të kthyer PaginatedResponse
  const searchItems = async (
    query: string,
    params?: PaginationParams & { containerId?: string }
  ): Promise<PaginatedResponse<Item>> => {
    setLoading(true);
    setError(null);
    try {
      const results = await itemService.search(query, params);
      return results;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value: ItemContextType = {
    items,
    loading,
    error,
    pagination,
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
  };

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};

export { ItemContext };