// ============================================
// AUTH TYPES
// ============================================
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  isActive: boolean;
  lastLogin?: Date;
  lastLoginIp?: string;
  lastLoginUserAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Shtojmë deletedAt për soft delete
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
  role?: 'super_admin' | 'admin' | 'user';
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
  token: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}