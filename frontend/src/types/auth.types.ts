// src/types/auth.types.ts
import { ROLES } from '../utilis/constants';

// ============================================
// AUTH TYPES
// ============================================

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface Session {
  id: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
  isCurrent: boolean;
}