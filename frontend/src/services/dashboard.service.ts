import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type { DashboardSummary } from '../types';

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response =
      await apiClient.get<DashboardSummary>(
        API_ENDPOINTS.DASHBOARD.SUMMARY,
      );

    return response.data;
  },
};