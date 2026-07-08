// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { authService } from '../services/auth.service';
import { apiClient } from '../api/axios.config';
import { User, LoginCredentials, RegisterData, Session } from '../types';
import { toast } from 'react-toastify';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  getSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to set tokens in localStorage and axios headers
  const setAuthTokens = (accessToken: string, refreshToken?: string) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    apiClient.defaults.headers.Authorization = `Bearer ${accessToken}`;
  };

  const clearAuthTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete apiClient.defaults.headers.Authorization;
  };

  // Refresh token logic (used by axios interceptor)
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      const response = await authService.refreshToken(refreshToken);
      const { accessToken, refreshToken: newRefreshToken } = response;
      setAuthTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch (error) {
      // Refresh failed – force logout
      clearAuthTokens();
      setUser(null);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          apiClient.defaults.headers.Authorization = `Bearer ${token}`;
          const userData = await authService.getMe();
          setUser(userData);
        }
      } catch (error) {
        // Token invalid – try to refresh
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const userData = await authService.getMe();
            setUser(userData);
          } catch {
            clearAuthTokens();
            setUser(null);
          }
        } else {
          clearAuthTokens();
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [refreshAccessToken]);

  // Set up axios interceptor for automatic token refresh
  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const newToken = await refreshAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [refreshAccessToken]);

  // -------------------- Auth methods --------------------
  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    setAuthTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
    toast.success('Login successful!');
  };

  const register = async (data: RegisterData) => {
    await authService.register(data);
    toast.success('User registered successfully!');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Ignore server errors during logout
    } finally {
      clearAuthTokens();
      setUser(null);
      toast.info('Logged out');
    }
  };

  const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    await authService.changePassword(data);
    toast.success('Password changed successfully!');
  };

  const forgotPassword = async (email: string) => {
    await authService.forgotPassword({ email });
    toast.success('Password reset email sent!');
  };

  const resetPassword = async (token: string, newPassword: string) => {
    await authService.resetPassword({ token, newPassword });
    toast.success('Password reset successfully!');
  };

  const getSessions = async (): Promise<Session[]> => {
    return authService.getSessions();
  };

  const revokeSession = async (sessionId: string) => {
    await authService.revokeSession(sessionId);
    toast.success('Session revoked');
  };

  const refreshUser = async () => {
    const userData = await authService.getMe();
    setUser(userData);
  };

  // ------------------------------------------------------------------
  // Expose context value
  // ------------------------------------------------------------------
  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
    getSessions,
    revokeSession,
    refreshUser,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};