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
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

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
      resetPasswordToken: null,
      resetPasswordExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogin: null,
      lastLoginIp: null,
      lastLoginUserAgent: null,
      deletedAt: null,
    };
    return { ...defaultUser, ...overrides } as User;
  };

  const mockUser = createMockUser();

  const createAuthenticatedRequest = (
    user: User = mockUser,
  ) =>
    ({
      user,
      headers: {},
      socket: {},
      ip: '127.0.0.1',
    }) as any;

  const mockAuthResponse: AuthResponseDto = {
    accessToken: 'test-token',
    user: {
      id: mockUser.id,
      username: mockUser.username,
      email: mockUser.email,
      role: mockUser.role,
      isActive: mockUser.isActive,
      lastLogin: mockUser.lastLogin ?? null,
      lastLoginIp: mockUser.lastLoginIp ?? null,
      lastLoginUserAgent: mockUser.lastLoginUserAgent ?? null,
      createdAt: mockUser.createdAt,
      updatedAt: mockUser.updatedAt,
      deletedAt: mockUser.deletedAt ?? null,
    },
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      register: jest.fn().mockResolvedValue(mockUser),
      logout: jest.fn().mockResolvedValue(undefined),
      logoutAll: jest.fn().mockResolvedValue(undefined),
      getUserSessionsDetailed: jest.fn().mockResolvedValue([
        {
          userId: mockUser.id,
          id: 'session-1',
          createdAt: new Date(),
          expiresAt: new Date(),
          ip: '127.0.0.1',
          userAgent: 'chrome',
          isActive: true,
        },
        {
          userId: mockUser.id,
          id: 'session-2',
          createdAt: new Date(),
          expiresAt: new Date(),
          ip: '127.0.0.1',
          userAgent: 'firefox',
          isActive: true,
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
      getProfile: jest.fn().mockResolvedValue(mockUser),
      findDeletedUsers: jest.fn().mockResolvedValue({
        data: [mockUser],
        total: 1,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
      }),
      softDeleteUser: jest.fn().mockResolvedValue(undefined),
      restoreUser: jest.fn().mockResolvedValue(mockUser),
      permanentDeleteUser: jest.fn().mockResolvedValue(undefined),
      findUserById: jest.fn().mockResolvedValue(mockUser),
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
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const result = await controller.login(loginDto, req);

      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        req.ip,
        req.headers['user-agent'],
      );
      expect(result).toBe(mockAuthResponse);
      // ✅ Refresh token duhet të jetë i definuar (nuk lidhet me vlerë specifike)
      expect(result.refreshToken).toBeDefined();
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
      const req = createAuthenticatedRequest();
      const result = await controller.register(registerDto, req);
      expect(authService.register).toHaveBeenCalledWith(registerDto, req.user);
      expect(result).toBe(mockUser);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id and refresh token from body', async () => {
      const req = createAuthenticatedRequest();
      const dto: RefreshTokenDto = { refreshToken: 'refresh-token' };
      const result = await controller.logout(req, dto);
      expect(authService.logout).toHaveBeenCalledWith(mockUser.id, dto.refreshToken);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('logoutAll', () => {
    it('should call authService.logoutAll with user id', async () => {
      const req = createAuthenticatedRequest();
      const result = await controller.logoutAll(req);
      expect(authService.logoutAll).toHaveBeenCalledWith(mockUser.id);
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
      const req = createAuthenticatedRequest();
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

  describe('getProfile', () => {
    it('should delegate profile retrieval to authService', async () => {
      const safeUser = mockAuthResponse.user;
      authService.getProfile.mockResolvedValue(safeUser);

      const req = createAuthenticatedRequest();
      const result = await controller.getProfile(req);

      expect(authService.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(safeUser);
    });
  });

  describe('getSessions', () => {
    it('should call authService.getUserSessionsDetailed and return sessions array', async () => {
      const req = createAuthenticatedRequest();
      const result = await controller.getSessions(req);
      expect(authService.getUserSessionsDetailed).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('sessions');
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]).toHaveProperty('userId', mockUser.id);
      expect(result.sessions[0]).toHaveProperty('id');
      expect(result.sessions[0]).toHaveProperty('createdAt');
      expect(result.sessions[0]).toHaveProperty('expiresAt');
      expect(result.sessions[0]).toHaveProperty('isActive');
    });
  });

  describe('revokeSession', () => {
    it('should call authService.revokeSession with user id and session id', async () => {
      const req = createAuthenticatedRequest();
      const sessionId = 'session-123';
      const result = await controller.revokeSession(req, sessionId);
      expect(authService.revokeSession).toHaveBeenCalledWith(mockUser.id, sessionId);
      expect(result).toEqual({ message: 'Session revoked successfully' });
    });
  });

  describe('getDeletedUsers', () => {
    it('should call authService.findDeletedUsers with pagination dto', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const result = await controller.getDeletedUsers(paginationDto);
      expect(authService.findDeletedUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
      );
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('offset');
    });
  });

  describe('softDeleteUser', () => {
    it('should call authService.softDeleteUser with user id', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      await controller.softDeleteUser(userId);
      expect(authService.softDeleteUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('restoreUser', () => {
    it('should call authService.restoreUser with user id and return restored user', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const result = await controller.restoreUser(userId);
      expect(authService.restoreUser).toHaveBeenCalledWith(userId);
      expect(result).toBe(mockUser);
      // ✅ Nuk presim që restoreUser të thërrasë save direkt
    });
  });

  describe('permanentDeleteUser', () => {
    it('should call authService.permanentDeleteUser with user id', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      await controller.permanentDeleteUser(userId);
      expect(authService.permanentDeleteUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('getUserById', () => {
    it('should call authService.findUserById with user id and includeDeleted flag', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const includeDeleted = true;
      await controller.getUserById(userId, includeDeleted);
      expect(authService.findUserById).toHaveBeenCalledWith(userId, true);
    });

    it('should default includeDeleted to false when not provided', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      await controller.getUserById(userId);
      expect(authService.findUserById).toHaveBeenCalledWith(userId, false);
    });
  });
});