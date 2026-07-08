// src/services/container.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import {
  Container,
  CreateContainerData,
  UpdateContainerData,
  PaginatedResponse,
  PaginationParams,
} from '../types';

export const containerService = {
  // Get all containers
  getAll: async (params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.BASE,
      { params }
    );
    return response.data;
  },

  // Get active containers
  getActive: async (params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.ACTIVE,
      { params }
    );
    return response.data;
  },

  // Get archived containers
  getArchived: async (params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.ARCHIVED,
      { params }
    );
    return response.data;
  },

  // Get deleted containers
  getDeleted: async (params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.DELETED,
      { params }
    );
    return response.data;
  },

  // Get container by ID
  getById: async (id: string): Promise<Container> => {
    const response = await apiClient.get<Container>(
      `${API_ENDPOINTS.CONTAINERS.BASE}/${id}`
    );
    return response.data;
  },

  // Create container
  create: async (data: CreateContainerData): Promise<Container> => {
    const response = await apiClient.post<Container>(
      API_ENDPOINTS.CONTAINERS.BASE,
      data
    );
    return response.data;
  },

  // Update container
  update: async (id: string, data: UpdateContainerData): Promise<Container> => {
    const response = await apiClient.put<Container>(
      `${API_ENDPOINTS.CONTAINERS.BASE}/${id}`,
      data
    );
    return response.data;
  },

  // Update container status
  updateStatus: async (id: string, status: string): Promise<Container> => {
    const response = await apiClient.put<Container>(
      `${API_ENDPOINTS.CONTAINERS.BASE}/${id}/status`,
      null,
      { params: { status } }
    );
    return response.data;
  },

  // Soft delete container
  softDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.CONTAINERS.BASE}/${id}`);
  },

  // Restore container
  restore: async (id: string): Promise<Container> => {
    const response = await apiClient.put<Container>(
      `${API_ENDPOINTS.CONTAINERS.BASE}/${id}/restore`
    );
    return response.data;
  },

  // Permanent delete
  permanentDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.CONTAINERS.BASE}/${id}/permanent`);
  },

  // Search containers
  search: async (query: string, params?: PaginationParams): Promise<PaginatedResponse<Container>> => {
  const response = await apiClient.get<PaginatedResponse<Container>>(
    API_ENDPOINTS.CONTAINERS.SEARCH,
    { params: { query, ...params } }
  );
  return response.data;
 },
};