// src/contexts/AuthContext.tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';

import { tokenStorage } from '../api/tokenStorage';
import { authService } from '../services/auth.service';
import type {
  User,
  LoginCredentials,
  RegisterData,
  Session,
  ChangePasswordData,
  ForgotPasswordData,
  ResetPasswordData,
} from '../types';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  forgotPassword: (data: ForgotPasswordData) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  getSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializimi i auth-it - interceptor-i i axios.config.ts kujdeset për refresh-in
  useEffect(() => {
    let active = true;

    const initializeAuth = async (): Promise<void> => {
      const accessToken = tokenStorage.getAccessToken();
      const refreshToken = tokenStorage.getRefreshToken();

      if (!accessToken && !refreshToken) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await authService.getMe();
        if (active) {
          setUser(userData);
        }
      } catch {
        // Interceptori kujdeset për pastrimin e token-ave në rast 401.
        // Këtu thjesht e lëmë përdoruesin pa u identifikuar.
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  // -------------------- Auth methods --------------------
  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    tokenStorage.setTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
    toast.success('Login successful!');
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await authService.register(data);
    toast.success('User registered successfully!');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      toast.info('Logged out');
    } catch {
      toast.warning('Logged out locally, but server may still have session');
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async (): Promise<void> => {
    try {
      await authService.logoutAll();
      toast.info('Logged out from all devices');
    } catch {
      toast.warning('Logged out locally, but other sessions may still be active');
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordData) => {
    await authService.changePassword(data);
  }, []);

  const forgotPassword = useCallback(async (data: ForgotPasswordData) => {
    await authService.forgotPassword(data);
  }, []);

  const resetPassword = useCallback(async (data: ResetPasswordData) => {
    await authService.resetPassword(data);
  }, []);

  const getSessions = useCallback((): Promise<Session[]> => {
    return authService.getSessions();
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    await authService.revokeSession(sessionId);
    toast.success('Session revoked');
  }, []);

  const refreshUser = useCallback(async () => {
    const userData = await authService.getMe();
    setUser(userData);
  }, []);

  // ------------------------------------------------------------------
  // Ekspozimi i context-it
  // ------------------------------------------------------------------
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      logoutAll,
      changePassword,
      forgotPassword,
      resetPassword,
      getSessions,
      revokeSession,
      refreshUser,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      logoutAll,
      changePassword,
      forgotPassword,
      resetPassword,
      getSessions,
      revokeSession,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};