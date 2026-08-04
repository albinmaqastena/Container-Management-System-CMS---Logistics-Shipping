// src/services/container.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type {
  Container,
  ContainerStatus,
  CreateContainerData,
  PaginatedResponse,
  PaginationParams,
  UpdateContainerData,
} from '../types';

// Parametrat e kërkesës për listimin e container-ave
export interface ContainerQueryParams extends PaginationParams {
  status?: ContainerStatus;
  includeDeleted?: boolean;
}

export const containerService = {
  // Get all containers (with optional filters)
  getAll: async (
    params?: ContainerQueryParams,
  ): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.BASE,
      { params },
    );
    return response.data;
  },

  // Get active containers
  getActive: async (
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.ACTIVE,
      { params },
    );
    return response.data;
  },

  // Get archived containers
  getArchived: async (
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.ARCHIVED,
      { params },
    );
    return response.data;
  },

  // Get deleted containers
  getDeleted: async (
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.DELETED,
      { params },
    );
    return response.data;
  },

  // Get container by ID (with optional includeDeleted)
  getById: async (
    id: string,
    includeDeleted = false,
  ): Promise<Container> => {
    const response = await apiClient.get<Container>(
      API_ENDPOINTS.CONTAINERS.BY_ID(id),
      {
        params: { includeDeleted },
      },
    );
    return response.data;
  },

  // Create container
  create: async (data: CreateContainerData): Promise<Container> => {
    const response = await apiClient.post<Container>(
      API_ENDPOINTS.CONTAINERS.BASE,
      data,
    );
    return response.data;
  },

  // Update container (PATCH)
  update: async (
    id: string,
    data: UpdateContainerData,
  ): Promise<Container> => {
    const response = await apiClient.patch<Container>(
      API_ENDPOINTS.CONTAINERS.BY_ID(id),
      data,
    );
    return response.data;
  },

  // Update container status (PATCH)
  updateStatus: async (
    id: string,
    status: ContainerStatus,
  ): Promise<Container> => {
    const response = await apiClient.patch<Container>(
      API_ENDPOINTS.CONTAINERS.STATUS(id),
      undefined,
      {
        params: { status },
      },
    );
    return response.data;
  },

  // Soft delete container
  softDelete: async (id: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.CONTAINERS.BY_ID(id));
  },

  // Restore container
  restore: async (id: string): Promise<Container> => {
    const response = await apiClient.put<Container>(
      API_ENDPOINTS.CONTAINERS.RESTORE(id),
    );
    return response.data;
  },

  // Permanent delete container
  permanentDelete: async (id: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.CONTAINERS.PERMANENT_DELETE(id));
  },

  // Search containers
  search: async (
    query: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<Container>> => {
    const response = await apiClient.get<PaginatedResponse<Container>>(
      API_ENDPOINTS.CONTAINERS.SEARCH,
      {
        params: {
          ...params,
          query,
        },
      },
    );
    return response.data;
  },
};