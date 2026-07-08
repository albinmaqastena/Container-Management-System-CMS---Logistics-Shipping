// src/services/auth.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User,
  Session,
  ChangePasswordData,
  ForgotPasswordData,
  ResetPasswordData,
  PaginatedResponse,
} from '../types';

export const authService = {
  // ================================================================
  // AUTHENTICATION
  // ================================================================

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    return response.data;
  },

  register: async (data: RegisterData): Promise<User> => {
    const response = await apiClient.post<User>(
      API_ENDPOINTS.AUTH.REGISTER,
      data
    );
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string }>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken }
    );
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
    return response.data;
  },

  changePassword: async (data: ChangePasswordData): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  },

  forgotPassword: async (data: ForgotPasswordData): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
  },

  resetPassword: async (data: ResetPasswordData): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },

  getSessions: async (): Promise<Session[]> => {
    const response = await apiClient.get<Session[]>(
      API_ENDPOINTS.AUTH.SESSIONS
    );
    return response.data;
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.AUTH.SESSIONS}/${sessionId}`);
  },

  // ================================================================
  // USER MANAGEMENT (Admin & Super Admin only)
  // ================================================================

  getUsers: async (params?: { limit?: number; offset?: number; sort?: string }): Promise<User[]> => {
    const response = await apiClient.get<User[]>(
      API_ENDPOINTS.USERS.BASE,
      { params }
    );
    return response.data;
  },

  getDeletedUsers: async (params?: { limit?: number; offset?: number; sort?: string }): Promise<User[]> => {
    const response = await apiClient.get<User[]>(
      API_ENDPOINTS.USERS.DELETED,
      { params }
    );
    return response.data;
  },

  softDeleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.USERS.BASE}/${userId}`);
  },

  restoreUser: async (userId: string): Promise<User> => {
    const response = await apiClient.put<User>(
      `${API_ENDPOINTS.USERS.BASE}/${userId}/restore`
    );
    return response.data;
  },

  permanentDeleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.USERS.BASE}/${userId}/permanent`);
  },
};