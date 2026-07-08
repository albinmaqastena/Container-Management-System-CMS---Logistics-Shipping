// src/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole } from './entities/user.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const createMockUser = (overrides: Partial<User> = {}): User => {
    const defaultUser: Partial<User> = {
      id: '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d',
      username: 'admin',
      email: 'admin@example.com',
      password: 'hashed',
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      containers: [],
      validatePassword: jest.fn(),
      hashPassword: jest.fn(),
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastLogin: undefined,
      lastLoginIp: undefined,
      lastLoginUserAgent: undefined,
    };
    return { ...defaultUser, ...overrides } as User;
  };

  const mockUser = createMockUser();

  const mockAuthResponse: AuthResponseDto = {
    accessToken: 'test-token',
    user: { ...mockUser, password: undefined } as Partial<User> as User,
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      register: jest.fn().mockResolvedValue(mockUser),
      logout: jest.fn().mockResolvedValue(undefined),
      getUserSessions: jest.fn().mockResolvedValue(['token1', 'token2']),
      getUserSessionsDetailed: jest.fn().mockResolvedValue([
        { id: 'session1', createdAt: new Date() },
        { id: 'session2', createdAt: new Date() },
      ]),
      getProfile: jest.fn().mockResolvedValue(mockUser),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
      changePassword: jest.fn().mockResolvedValue(undefined),
      // ✅ Kthejmë objektet e duhura
      forgotPassword: jest.fn().mockResolvedValue({ message: 'Reset link sent' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successfully' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should call authService.login with loginDto, ip and userAgent', async () => {
      const loginDto: LoginDto = { email: 'admin@example.com', password: 'Admin@123' };
      const req = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        connection: { remoteAddress: '127.0.0.1' },
      };

      const result = await controller.login(loginDto, req);

      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        req.ip,
        req.headers['user-agent'],
      );
      expect(result).toBe(mockAuthResponse);
    });
  });

  describe('register', () => {
    it('should call authService.register with registerDto and current user', async () => {
      const registerDto: RegisterDto = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: UserRole.USER,
      };
      const req = { user: mockUser };
      const result = await controller.register(registerDto, req);
      expect(authService.register).toHaveBeenCalledWith(registerDto, req.user);
      expect(result).toBe(mockUser);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id and token', async () => {
      const req = {
        user: { id: mockUser.id },
        headers: { authorization: 'Bearer test-token' },
      };
      const result = await controller.logout(req);
      expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'test-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should throw error if token is missing', async () => {
      const req = {
        user: { id: mockUser.id },
        headers: {},
      };
      await expect(controller.logout(req)).rejects.toThrow('No token provided');
    });
  });

  describe('getSessions', () => {
    it('should call authService.getUserSessions and return sessions', async () => {
      const req = { user: { id: mockUser.id } };
      const result = await controller.getSessions(req);
      expect(authService.getUserSessions).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ sessions: ['token1', 'token2'] });
    });
  });

  describe('getSessionsDetailed', () => {
    it('should call authService.getUserSessionsDetailed and return detailed sessions', async () => {
      const req = { user: { id: mockUser.id } };
      const result = await controller.getSessionsDetailed(req);
      expect(authService.getUserSessionsDetailed).toHaveBeenCalledWith(mockUser.id);
      expect(result.sessions).toHaveLength(2);
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshAccessToken with refresh token string', async () => {
      const refreshToken = 'refresh-token';
      const result = await controller.refreshToken(refreshToken);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('getProfile', () => {
    it('should return user without sensitive fields', async () => {
      const req = { user: { ...mockUser } };
      const result = await controller.getProfile(req);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('resetPasswordToken');
      expect(result).not.toHaveProperty('resetPasswordExpires');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('email');
    });
  });

  describe('changePassword', () => {
    it('should call authService.changePassword with user id and passwords', async () => {
      const req = { user: { id: mockUser.id } };
      const dto: ChangePasswordDto = { currentPassword: 'old', newPassword: 'New@123' };
      const result = await controller.changePassword(dto, req);
      expect(authService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        dto.currentPassword,
        dto.newPassword,
      );
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword with email', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      const result = await controller.forgotPassword(dto);
      expect(authService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual({ message: 'Reset link sent' });
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword with token and new password', async () => {
      const dto: ResetPasswordDto = { token: 'reset-token', newPassword: 'New@123' };
      const result = await controller.resetPassword(dto);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });
  });

  describe('revokeSession', () => {
    it('should call authService.revokeSession with user id and session id', async () => {
      const req = { user: { id: mockUser.id } };
      const sessionId = 'session-123';
      const result = await controller.revokeSession(req, sessionId);
      expect(authService.revokeSession).toHaveBeenCalledWith(mockUser.id, sessionId);
      expect(result).toEqual({ message: 'Session revoked successfully' });
    });
  });
});