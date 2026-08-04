// src/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from './entities/user.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from './interfaces/authenticated-request.interface';
import type { Request } from 'express';

type AuthServiceMock = {
  login: jest.MockedFunction<AuthService['login']>;
  register: jest.MockedFunction<AuthService['register']>;
  logout: jest.MockedFunction<AuthService['logout']>;
  logoutAll: jest.MockedFunction<AuthService['logoutAll']>;
  getUserSessionsDetailed: jest.MockedFunction<AuthService['getUserSessionsDetailed']>;
  revokeSession: jest.MockedFunction<AuthService['revokeSession']>;
  refreshAccessToken: jest.MockedFunction<AuthService['refreshAccessToken']>;
  changePassword: jest.MockedFunction<AuthService['changePassword']>;
  forgotPassword: jest.MockedFunction<AuthService['forgotPassword']>;
  resetPassword: jest.MockedFunction<AuthService['resetPassword']>;
  getProfile: jest.MockedFunction<AuthService['getProfile']>;
  findDeletedUsers: jest.MockedFunction<AuthService['findDeletedUsers']>;
  softDeleteUser: jest.MockedFunction<AuthService['softDeleteUser']>;
  restoreUser: jest.MockedFunction<AuthService['restoreUser']>;
  permanentDeleteUser: jest.MockedFunction<AuthService['permanentDeleteUser']>;
  findUserById: jest.MockedFunction<AuthService['findUserById']>;
};

type TestRequestOverrides = {
  ip?: string;
  headers?: Record<string, string | undefined>;
  socket?: {
    remoteAddress?: string;
  };
};

const createRequest = (overrides: TestRequestOverrides = {}): Request =>
  ({
    ip: '127.0.0.1',
    headers: {},
    socket: {},
    ...overrides,
  }) as unknown as Request;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthServiceMock;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d',
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isActive: true,
    sid: 'session-id',
  };

  const mockUserResponse = {
    id: mockAuthenticatedUser.id,
    username: mockAuthenticatedUser.username,
    email: mockAuthenticatedUser.email,
    role: mockAuthenticatedUser.role,
    isActive: mockAuthenticatedUser.isActive,
    lastLogin: null,
    lastLoginIp: null,
    lastLoginUserAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockAuthResponse: AuthResponseDto = {
    accessToken: 'test-token',
    user: mockUserResponse,
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      register: jest.fn().mockResolvedValue(mockUserResponse),
      logout: jest.fn().mockResolvedValue(undefined),
      logoutAll: jest.fn().mockResolvedValue(undefined),
      getUserSessionsDetailed: jest.fn().mockResolvedValue([
        {
          userId: mockAuthenticatedUser.id,
          id: 'session-1',
          createdAt: new Date(),
          expiresAt: new Date(),
          ip: '127.0.0.1',
          userAgent: 'chrome',
          isActive: true,
          isCurrent: true,
        },
        {
          userId: mockAuthenticatedUser.id,
          id: 'session-2',
          createdAt: new Date(),
          expiresAt: new Date(),
          ip: '127.0.0.1',
          userAgent: 'firefox',
          isActive: true,
          isCurrent: false,
        },
      ]),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
      changePassword: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'Reset link sent' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successfully' }),
      getProfile: jest.fn().mockResolvedValue(mockUserResponse),
      findDeletedUsers: jest.fn().mockResolvedValue({
        data: [mockUserResponse],
        total: 1,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasMore: false,
      }),
      softDeleteUser: jest.fn().mockResolvedValue(undefined),
      restoreUser: jest.fn().mockResolvedValue(mockUserResponse),
      permanentDeleteUser: jest.fn().mockResolvedValue(undefined),
      findUserById: jest.fn().mockResolvedValue(mockUserResponse),
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
      const req = createRequest({
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        socket: { remoteAddress: '127.0.0.1' },
      });

      const result = await controller.login(loginDto, req);

      expect(authService.login).toHaveBeenCalledWith(loginDto, req.ip, req.headers['user-agent']);
      expect(result).toBe(mockAuthResponse);
      expect(result.refreshToken).toBeDefined();
    });

    it('should use socket IP and default user-agent when request values are missing', async () => {
      const loginDto: LoginDto = {
        email: 'admin@example.com',
        password: 'Admin@123',
      };

      const req = createRequest({
        ip: undefined,
        headers: {},
        socket: {
          remoteAddress: '10.0.0.5',
        },
      });

      const result = await controller.login(loginDto, req);

      expect(authService.login).toHaveBeenCalledWith(loginDto, '10.0.0.5', 'unknown');
      expect(result).toBe(mockAuthResponse);
    });

    it('should fallback to 0.0.0.0 when no IP is available', async () => {
      const loginDto: LoginDto = {
        email: 'admin@example.com',
        password: 'Admin@123',
      };

      const req = createRequest({
        ip: undefined,
        headers: {},
        socket: {},
      });

      const result = await controller.login(loginDto, req);

      expect(authService.login).toHaveBeenCalledWith(loginDto, '0.0.0.0', 'unknown');
      expect(result).toBe(mockAuthResponse);
    });
  });

  describe('register', () => {
    it('should call authService.register with registerDto and current user', async () => {
      const registerDto: RegisterDto = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password@123',
        role: UserRole.USER,
      };
      const result = await controller.register(registerDto, mockAuthenticatedUser);
      expect(authService.register).toHaveBeenCalledWith(registerDto, mockAuthenticatedUser);
      expect(result).toBe(mockUserResponse);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id and current session id', async () => {
      const result = await controller.logout(mockAuthenticatedUser);
      expect(authService.logout).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        mockAuthenticatedUser.sid,
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should propagate service errors', async () => {
      authService.logout.mockRejectedValueOnce(new UnauthorizedException());
      await expect(controller.logout(mockAuthenticatedUser)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logoutAll', () => {
    it('should call authService.logoutAll with user id', async () => {
      const result = await controller.logoutAll(mockAuthenticatedUser);
      expect(authService.logoutAll).toHaveBeenCalledWith(mockAuthenticatedUser.id);
      expect(result).toEqual({ message: 'Logged out from all devices' });
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshAccessToken with refresh token from body', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'refresh-token' };
      const result = await controller.refreshToken(dto);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('changePassword', () => {
    it('should call authService.changePassword with user id and passwords', async () => {
      const dto: ChangePasswordDto = {
        currentPassword: 'OldPassword@123',
        newPassword: 'NewPassword@123',
      };
      const result = await controller.changePassword(dto, mockAuthenticatedUser);
      expect(authService.changePassword).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
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
      const dto: ResetPasswordDto = { token: 'reset-token', newPassword: 'NewPassword@123' };
      const result = await controller.resetPassword(dto);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });
  });

  describe('getProfile', () => {
    it('should delegate profile retrieval to authService with current user', async () => {
      const result = await controller.getProfile(mockAuthenticatedUser);
      expect(authService.getProfile).toHaveBeenCalledWith(mockAuthenticatedUser.id);
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('getSessions', () => {
    it('should call authService.getUserSessionsDetailed with user id and current session id', async () => {
      const result = await controller.getSessions(mockAuthenticatedUser);
      expect(authService.getUserSessionsDetailed).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        mockAuthenticatedUser.sid,
      );
      expect(result).toHaveProperty('sessions');
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]).toHaveProperty('userId', mockAuthenticatedUser.id);
      expect(result.sessions[0]).toHaveProperty('id');
      expect(result.sessions[0]).toHaveProperty('createdAt');
      expect(result.sessions[0]).toHaveProperty('expiresAt');
      expect(result.sessions[0]).toHaveProperty('isActive');
      expect(result.sessions[0].isCurrent).toBe(true);
      expect(result.sessions[1].isCurrent).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('should call authService.revokeSession with user id and session id', async () => {
      const sessionId = 'session-123';
      const result = await controller.revokeSession(mockAuthenticatedUser, sessionId);
      expect(authService.revokeSession).toHaveBeenCalledWith(mockAuthenticatedUser.id, sessionId);
      expect(result).toEqual({ message: 'Session revoked successfully' });
    });
  });

  describe('getDeletedUsers', () => {
    it('should call authService.findDeletedUsers with pagination dto and return paginated result', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const result = await controller.getDeletedUsers(paginationDto);
      expect(authService.findDeletedUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
      );
      expect(result).toHaveProperty('data', [mockUserResponse]);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('offset', 0);
      expect(result).toHaveProperty('totalPages', 1);
      expect(result).toHaveProperty('currentPage', 1);
      expect(result).toHaveProperty('hasMore', false);
    });
  });

  describe('softDeleteUser', () => {
    it('should call authService.softDeleteUser with target user id and current user id', async () => {
      const userId = 'target-user-id';
      const result = await controller.softDeleteUser(userId, mockAuthenticatedUser);
      expect(authService.softDeleteUser).toHaveBeenCalledWith(userId, mockAuthenticatedUser.id);
      expect(result).toBeUndefined();
    });
  });

  describe('restoreUser', () => {
    it('should call authService.restoreUser with user id and return restored user', async () => {
      const userId = 'target-user-id';
      const result = await controller.restoreUser(userId);
      expect(authService.restoreUser).toHaveBeenCalledWith(userId);
      expect(result).toBe(mockUserResponse);
    });
  });

  describe('permanentDeleteUser', () => {
    it('should call authService.permanentDeleteUser with target user id and current user id', async () => {
      const userId = 'target-user-id';
      const result = await controller.permanentDeleteUser(userId, mockAuthenticatedUser);
      expect(authService.permanentDeleteUser).toHaveBeenCalledWith(
        userId,
        mockAuthenticatedUser.id,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should call authService.findUserById with user id and includeDeleted flag', async () => {
      const userId = 'target-user-id';
      const includeDeleted = true;
      const result = await controller.getUserById(userId, includeDeleted);
      expect(authService.findUserById).toHaveBeenCalledWith(userId, true);
      expect(result).toBe(mockUserResponse);
    });

    it('should default includeDeleted to false when not provided', async () => {
      const userId = 'target-user-id';
      const result = await controller.getUserById(userId);
      expect(authService.findUserById).toHaveBeenCalledWith(userId, false);
      expect(result).toBe(mockUserResponse);
    });
  });
});
