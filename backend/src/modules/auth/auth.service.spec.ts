// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';

// ✅ Mock uuid v4
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-token'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: any;
  let cacheManager: any;
  let configService: any;

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
      setResetToken: jest.fn(),
      clearResetToken: jest.fn(),
      isResetTokenValid: jest.fn(),
      lockAccount: jest.fn(),
      isLocked: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
    };
    return { ...defaultUser, ...overrides } as User;
  };

  const mockCacheStore = {
    keys: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    };

    refreshTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('test-access-token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'auth.jwt.secret': 'test-secret',
          'auth.jwt.accessTokenExpiresIn': '15m',
          'auth.jwt.refreshTokenExpiresIn': '7d',
        };
        return config[key];
      }),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
      store: mockCacheStore,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'admin@example.com',
      password: 'Admin@123',
    };
    const ip = '127.0.0.1';
    const userAgent = 'test-agent';

    it('should return access token, refresh token and user data on successful login', async () => {
  const user = createMockUser({
    validatePassword: jest.fn().mockResolvedValue(true),
    isLocked: jest.fn().mockReturnValue(false),
    incrementFailedAttempts: jest.fn(),
    resetFailedAttempts: jest.fn(),
    failedLoginAttempts: 0,
  });
  userRepository.findOne.mockResolvedValue(user);
  userRepository.save.mockResolvedValue(user);
  refreshTokenRepository.save.mockResolvedValue({ token: 'refresh-token' });
  cacheManager.set.mockResolvedValue(undefined);
  jwtService.sign.mockReturnValue('test-access-token');

  const result = await service.login(loginDto, ip, userAgent);

  expect(result.accessToken).toBe('test-access-token');
  expect(result.refreshToken).toBeDefined();
  expect(result.user).toHaveProperty('id', user.id);
  expect(result.user).not.toHaveProperty('password'); // ✅ Tani kalon
  expect(userRepository.save).toHaveBeenCalled();
  expect(cacheManager.set).toHaveBeenCalled();
  expect(refreshTokenRepository.save).toHaveBeenCalled();
});

    it('should throw UnauthorizedException if user is inactive', async () => {
  const user = createMockUser({
    isActive: false,
    validatePassword: jest.fn().mockResolvedValue(true),
    isLocked: jest.fn().mockReturnValue(false),
  });
  userRepository.findOne.mockResolvedValue(user);
  await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(UnauthorizedException);
});

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
        incrementFailedAttempts: jest.fn(),
        failedLoginAttempts: 0,
        isLocked: jest.fn().mockReturnValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(UnauthorizedException);
      expect(user.incrementFailedAttempts).toHaveBeenCalled();
    });

    it('should lock account after 5 failed attempts', async () => {
      let failedAttempts = 4;
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
        incrementFailedAttempts: jest.fn().mockImplementation(() => {
          failedAttempts += 1;
          // Në mënyrë indirekte, update mock object
          user.failedLoginAttempts = failedAttempts;
        }),
        failedLoginAttempts: 4,
        isLocked: jest.fn().mockReturnValue(false),
        lockAccount: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Too many failed attempts. Account locked for 15 minutes.',
      );
      expect(user.incrementFailedAttempts).toHaveBeenCalled();
      expect(user.lockAccount).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({
        isActive: false,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn().mockReturnValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'password123',
      role: UserRole.USER,
    };

    it('should create first user as SUPER_ADMIN when no users exist', async () => {
      userRepository.count.mockResolvedValue(0);
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(registerDto);
      expect(result.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('should create a user with specified role when SUPER_ADMIN is logged in', async () => {
      const currentUser = createMockUser({ role: UserRole.SUPER_ADMIN });
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(registerDto, currentUser);
      expect(result.role).toBe(UserRole.USER);
    });

    it('should allow SUPER_ADMIN to create ADMIN', async () => {
      const currentUser = createMockUser({ role: UserRole.SUPER_ADMIN });
      const dto = { ...registerDto, role: UserRole.ADMIN };
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(dto, currentUser);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should allow ADMIN to create ADMIN', async () => {
      const currentUser = createMockUser({ role: UserRole.ADMIN });
      const dto = { ...registerDto, role: UserRole.ADMIN };
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(dto, currentUser);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should allow ADMIN to create USER', async () => {
      const currentUser = createMockUser({ role: UserRole.ADMIN });
      const dto = { ...registerDto, role: UserRole.USER };
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(dto, currentUser);
      expect(result.role).toBe(UserRole.USER);
    });

    it('should throw UnauthorizedException if ADMIN tries to create SUPER_ADMIN', async () => {
      const currentUser = createMockUser({ role: UserRole.ADMIN });
      const dto = { ...registerDto, role: UserRole.SUPER_ADMIN };
      await expect(service.register(dto, currentUser)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if regular USER tries to register', async () => {
      const currentUser = createMockUser({ role: UserRole.USER });
      await expect(service.register(registerDto, currentUser)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('logout', () => {
    it('should delete the session token from cache and revoke refresh token', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const token = 'test-token';
      const refreshToken = 'refresh-token';
      
      mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`]);
      cacheManager.get.mockResolvedValue(token);
      cacheManager.del.mockResolvedValue(undefined);
      
      refreshTokenRepository.findOne.mockResolvedValue({
        token: refreshToken,
        userId,
        isActive: true,
        save: jest.fn(),
      });

      await service.logout(userId, refreshToken);
      expect(cacheManager.del).toHaveBeenCalledWith(`session:${userId}:123`);
      expect(refreshTokenRepository.findOne).toHaveBeenCalled();
    });

    it('should not delete anything if refresh token does not exist', async () => {
  const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
  const token = 'test-token';
  mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`]);
  cacheManager.get.mockResolvedValue('different-token');
  
  // ✅ Refresh token nuk ekziston
  refreshTokenRepository.findOne.mockResolvedValue(null);

  await service.logout(userId, token);
  // ✅ Nuk fshijmë cache-in sepse refresh token nuk ekziston
  expect(cacheManager.del).not.toHaveBeenCalled();
});
  });

  describe('refreshAccessToken', () => {
    it('should return new access token and refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const user = createMockUser();
      const storedToken = {
        token: refreshToken,
        user,
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        save: jest.fn(),
      };
      
      refreshTokenRepository.findOne.mockResolvedValue(storedToken);
      refreshTokenRepository.save.mockResolvedValue({});
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAccessToken(refreshToken);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(storedToken.isActive).toBe(false);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentPassword = 'oldPassword';
    const newPassword = 'New@123';

    it('should change password successfully', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(true),
        resetFailedAttempts: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`]);
      cacheManager.del.mockResolvedValue(undefined);

      await service.changePassword(userId, currentPassword, newPassword);
      expect(userRepository.save).toHaveBeenCalled();
      expect(user.resetFailedAttempts).toHaveBeenCalled();
      expect(user.password).toBe(newPassword);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(UnauthorizedException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const email = 'test@example.com';

    it('should generate reset token and save user', async () => {
      const user = createMockUser({
        setResetToken: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.forgotPassword(email);
      expect(user.setResetToken).toHaveBeenCalledWith(expect.any(String), 3600000);
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ message: 'If this email exists, a reset link has been sent' });
    });

    it('should return same message if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword(email);
      expect(result).toEqual({ message: 'If this email exists, a reset link has been sent' });
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const token = 'valid-token';
    const newPassword = 'New@123';
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should reset password successfully', async () => {
      const user = createMockUser({
        isResetTokenValid: jest.fn().mockReturnValue(true),
        clearResetToken: jest.fn(),
        resetFailedAttempts: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`]);
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.resetPassword(token, newPassword);
      expect(user.clearResetToken).toHaveBeenCalled();
      expect(user.resetFailedAttempts).toHaveBeenCalled();
      expect(user.password).toBe(newPassword);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      const user = createMockUser({
        isResetTokenValid: jest.fn().mockReturnValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.resetPassword(token, newPassword))
        .rejects.toThrow(UnauthorizedException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.resetPassword(token, newPassword))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserSessionsDetailed', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should return detailed sessions for user', async () => {
      mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`, `session:${userId}:456`]);
      cacheManager.get.mockResolvedValueOnce('token1').mockResolvedValueOnce('token2');

      const sessions = await service.getUserSessionsDetailed(userId);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('id', '123');
      expect(sessions[0]).toHaveProperty('token', 'token1');
      expect(sessions[0]).toHaveProperty('isActive', true);
    });

    it('should return empty array if no sessions', async () => {
      mockCacheStore.keys.mockResolvedValue([]);
      const sessions = await service.getUserSessionsDetailed(userId);
      expect(sessions).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const sessionId = '123';

    it('should revoke an existing session', async () => {
      cacheManager.get.mockResolvedValue('token');
      cacheManager.del.mockResolvedValue(undefined);

      await service.revokeSession(userId, sessionId);
      expect(cacheManager.get).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
      expect(cacheManager.del).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      await expect(service.revokeSession(userId, sessionId))
        .rejects.toThrow(NotFoundException);
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should return list of tokens for the user', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      mockCacheStore.keys.mockResolvedValue([`session:${userId}:123`, `session:${userId}:456`]);
      cacheManager.get.mockResolvedValueOnce('token1').mockResolvedValueOnce('token2');

      const sessions = await service.getUserSessions(userId);
      expect(sessions).toEqual(['token1', 'token2']);
    });

    it('should return empty array if no sessions', async () => {
      mockCacheStore.keys.mockResolvedValue([]);
      const sessions = await service.getUserSessions('user-id');
      expect(sessions).toEqual([]);
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      const result = await service.validateUser(user.id);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.validateUser('non-existent-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});