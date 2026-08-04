// src/services/auth.service.ts
import { apiClient } from '../api/axios.config';
import { API_ENDPOINTS } from '../api/endpoints';
import type {
  AuthResponse,
  ChangePasswordData,
  ForgotPasswordData,
  LoginCredentials,
  PaginatedResponse,
  PaginationParams,
  RefreshTokenResponse,
  RegisterData,
  ResetPasswordData,
  Session,
  User,
} from '../types';

// Tip lokal për përgjigjen e sessions (nëse nuk ekziston te types)
interface SessionsResponse {
  sessions: Session[];
}

export const authService = {
  // ================================================================
  // AUTHENTICATION
  // ================================================================

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials,
    );
    return response.data;
  },

  register: async (data: RegisterData): Promise<User> => {
    const response = await apiClient.post<User>(
      API_ENDPOINTS.AUTH.REGISTER,
      data,
    );
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  logoutAll: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT_ALL);
  },

  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken },
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
    const response = await apiClient.get<SessionsResponse>(
      API_ENDPOINTS.AUTH.SESSIONS,
    );
    return response.data.sessions;
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.AUTH.SESSION_BY_ID(sessionId));
  },

  // ================================================================
  // USER MANAGEMENT (Super Admin only)
  // ================================================================

  getDeletedUsers: async (
    params?: PaginationParams,
  ): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>(
      API_ENDPOINTS.USERS.DELETED,
      { params },
    );
    return response.data;
  },

  getUserById: async (
    userId: string,
    includeDeleted = false,
  ): Promise<User> => {
    const response = await apiClient.get<User>(
      API_ENDPOINTS.USERS.BY_ID(userId),
      {
        params: { includeDeleted },
      },
    );
    return response.data;
  },

  softDeleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.USERS.BY_ID(userId));
  },

  restoreUser: async (userId: string): Promise<User> => {
    const response = await apiClient.put<User>(
      API_ENDPOINTS.USERS.RESTORE(userId),
    );
    return response.data;
  },

  permanentDeleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.USERS.PERMANENT_DELETE(userId));
  },
};