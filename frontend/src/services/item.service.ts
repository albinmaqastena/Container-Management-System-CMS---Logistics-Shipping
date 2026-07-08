// src/services/item.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import {
  Item,
  CreateItemData,
  UpdateItemData,
  PaginatedResponse,
  PaginationParams,
} from '../types';

export const itemService = {
  // Get all items
  getAll: async (
    containerId?: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<Item>> => {
    const response = await apiClient.get<PaginatedResponse<Item>>(
      API_ENDPOINTS.ITEMS.BASE,
      {
        params: {
          ...params,
          containerId,
        },
      }
    );
    return response.data;
  },

  // Get deleted items
  getDeleted: async (params?: PaginationParams): Promise<PaginatedResponse<Item>> => {
    const response = await apiClient.get<PaginatedResponse<Item>>(
      API_ENDPOINTS.ITEMS.DELETED,
      { params }
    );
    return response.data;
  },

  // Get item by ID
  getById: async (id: string): Promise<Item> => {
    const response = await apiClient.get<Item>(
      `${API_ENDPOINTS.ITEMS.BASE}/${id}`
    );
    return response.data;
  },

  // Create item
  create: async (data: CreateItemData): Promise<Item> => {
    const response = await apiClient.post<Item>(
      API_ENDPOINTS.ITEMS.BASE,
      data
    );
    return response.data;
  },

  // Update item
  update: async (id: string, data: UpdateItemData): Promise<Item> => {
    const response = await apiClient.put<Item>(
      `${API_ENDPOINTS.ITEMS.BASE}/${id}`,
      data
    );
    return response.data;
  },

  // Soft delete item
  softDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.ITEMS.BASE}/${id}`);
  },

  // Restore item
  restore: async (id: string): Promise<Item> => {
    const response = await apiClient.put<Item>(
      `${API_ENDPOINTS.ITEMS.BASE}/${id}/restore`
    );
    return response.data;
  },

  // Permanent delete
  permanentDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.ITEMS.BASE}/${id}/permanent`);
  },

  // Search items
  search: async (query: string, params?: PaginationParams & { containerId?: string }): Promise<PaginatedResponse<Item>> => {
  const response = await apiClient.get<PaginatedResponse<Item>>(
    API_ENDPOINTS.ITEMS.SEARCH,
    { params: { query, ...params } }
  );
  return response.data;
 },
};