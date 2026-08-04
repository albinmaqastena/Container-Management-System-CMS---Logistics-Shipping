import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';

export interface HealthResponse {
  status: string;
}

export const healthService = {
  check: async (): Promise<HealthResponse> => {
    const response =
      await apiClient.get<HealthResponse>(
        API_ENDPOINTS.HEALTH,
      );

    return response.data;
  },
};