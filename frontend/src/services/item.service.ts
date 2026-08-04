// src/services/item.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type {
  Item,
  CreateItemData,
  UpdateItemData,
  PaginatedResponse,
  PaginationParams,
} from '../types';

// ================================================================
// TIPAT
// ================================================================

export interface ItemQueryParams extends PaginationParams {
  containerId?: string;
  includeDeleted?: boolean;
}

export interface ItemSearchParams extends PaginationParams {
  containerId?: string;
}

// ================================================================
// SERVICE
// ================================================================

export const itemService = {
  /**
   * Get all items with optional filters
   */
  getAll: async (
    params?: ItemQueryParams,
  ): Promise<PaginatedResponse<Item>> => {
    const response = await apiClient.get<PaginatedResponse<Item>>(
      API_ENDPOINTS.ITEMS.BASE,
      { params },
    );
    return response.data;
  },

  /**
   * Get deleted items
   */
  getDeleted: async (
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Item>> => {
    const response = await apiClient.get<PaginatedResponse<Item>>(
      API_ENDPOINTS.ITEMS.DELETED,
      { params },
    );
    return response.data;
  },

  /**
   * Get item by ID with optional includeDeleted
   */
  getById: async (
    id: string,
    includeDeleted = false,
  ): Promise<Item> => {
    const response = await apiClient.get<Item>(
      API_ENDPOINTS.ITEMS.BY_ID(id),
      {
        params: { includeDeleted },
      },
    );
    return response.data;
  },

  /**
   * Create a new item
   */
  create: async (data: CreateItemData): Promise<Item> => {
    const response = await apiClient.post<Item>(
      API_ENDPOINTS.ITEMS.BASE,
      data,
    );
    return response.data;
  },

  /**
   * Update an existing item
   */
  update: async (
    id: string,
    data: UpdateItemData,
  ): Promise<Item> => {
    const response = await apiClient.put<Item>(
      API_ENDPOINTS.ITEMS.BY_ID(id),
      data,
    );
    return response.data;
  },

  /**
   * Soft delete an item
   */
  softDelete: async (id: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.ITEMS.BY_ID(id));
  },

  /**
   * Restore a soft-deleted item
   */
  restore: async (id: string): Promise<Item> => {
    const response = await apiClient.put<Item>(
      API_ENDPOINTS.ITEMS.RESTORE(id),
    );
    return response.data;
  },

  /**
   * Permanently delete an item
   */
  permanentDelete: async (id: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.ITEMS.PERMANENT_DELETE(id));
  },

  /**
   * Search items by query
   */
  search: async (
    query: string,
    params?: ItemSearchParams,
  ): Promise<PaginatedResponse<Item>> => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new Error('Search query cannot be empty');
    }

    const response = await apiClient.get<PaginatedResponse<Item>>(
      API_ENDPOINTS.ITEMS.SEARCH,
      {
        params: {
          ...params,
          query: normalizedQuery,
        },
      },
    );
    return response.data;
  },
};