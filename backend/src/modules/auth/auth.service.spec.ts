// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';

jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('refresh-token-1')
    .mockReturnValueOnce('refresh-token-2')
    .mockReturnValue('mock-uuid-token'),
}));

const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockImplementation((cursor, ...args) => {
    return Promise.resolve(['0', []]);
  }),
  keys: jest.fn().mockResolvedValue([]),
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: any;
  let configService: any;
  let redis: any;

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

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    };

    refreshTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('test-access-token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'auth.jwt.secret': 'test-secret',
          'auth.jwt.accessTokenExpiresIn': '15m',
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
        };
        return config[key];
      }),
    };

    redis = { ...mockRedis };

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
          provide: 'REDIS_CLIENT',
          useValue: redis,
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
      refreshTokenRepository.save.mockResolvedValue({ token: 'refresh-token-1' });
      jwtService.sign.mockReturnValue('test-access-token');

      redis.scan.mockResolvedValue(['0', []]);

      const result = await service.login(loginDto, ip, userAgent);

      expect(result.accessToken).toBe('test-access-token');
      // ✅ Nuk kontrollojmë vlerë specifike të refresh token-it
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.user).not.toHaveProperty('password');
      expect(redis.set).toHaveBeenCalled();
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
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
        failedLoginAttempts: 4,
        isLocked: jest.fn().mockReturnValue(false),
        lockAccount: jest.fn(),
      });
      user.incrementFailedAttempts = jest.fn().mockImplementation(() => {
        user.failedLoginAttempts++;
      });

      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Too many failed attempts. Account locked for 15 minutes.',
      );

      expect(user.incrementFailedAttempts).toHaveBeenCalled();
      expect(user.lockAccount).toHaveBeenCalled();
      expect(user.failedLoginAttempts).toBe(5);
    });

    it('should reject deleted user', async () => {
      const user = createMockUser({
        deletedAt: new Date(),
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn().mockReturnValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Account has been deactivated',
      );
    });

    it('should reject locked account', async () => {
      const user = createMockUser({
        isLocked: jest.fn().mockReturnValue(true),
        validatePassword: jest.fn().mockResolvedValue(true),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Account is temporarily locked',
      );
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'Password@123',
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
    it('should revoke refresh token and delete Redis session', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const refreshToken = 'refresh-token-1';
      const mockToken = { id: 'token-id', isActive: true };
      refreshTokenRepository.findOne.mockResolvedValue(mockToken);
      refreshTokenRepository.save.mockResolvedValue(mockToken);

      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshToken,
          accessToken: 'access-token',
          ip: '127.0.0.1',
          userAgent: 'chrome',
        }),
      );
      redis.del.mockResolvedValue(1);

      await service.logout(userId, refreshToken);

      expect(refreshTokenRepository.findOne).toHaveBeenCalled();
      expect(refreshTokenRepository.save).toHaveBeenCalled();
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`session:${userId}:123`);
    });

    it('should throw UnauthorizedException if refresh token not found', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.logout('user-id', 'invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens and delete all Redis sessions', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      refreshTokenRepository.update.mockResolvedValue({ affected: 2 });

      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`, `session:${userId}:456`]]);
      redis.del.mockResolvedValue(2);

      await service.logoutAll(userId);

      expect(refreshTokenRepository.update).toHaveBeenCalled();
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(
        `session:${userId}:123`,
        `session:${userId}:456`,
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access and refresh tokens and update Redis session', async () => {
      const refreshToken = 'refresh-token-1';
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const user = createMockUser({ id: userId });

      const storedToken = {
        token: refreshToken,
        user,
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      refreshTokenRepository.findOne.mockResolvedValue(storedToken);
      refreshTokenRepository.save.mockResolvedValue({});

      const mockNewRefresh = 'new-refresh-token';
      (jest.requireMock('uuid').v4 as jest.Mock).mockReturnValueOnce(mockNewRefresh);

      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshToken,
          accessToken: 'old-access-token',
          ip: '127.0.0.1',
          userAgent: 'chrome',
        }),
      );
      redis.set.mockResolvedValue('OK');

      const result = await service.refreshAccessToken(refreshToken);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe(mockNewRefresh);
      expect(storedToken.isActive).toBe(false);
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const storedToken = {
        token: 'expired-token',
        user: createMockUser(),
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      };
      refreshTokenRepository.findOne.mockResolvedValue(storedToken);
      await expect(service.refreshAccessToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentPassword = 'oldPassword';
    const newPassword = 'NewPassword@123';

    it('should change password successfully and invalidate sessions', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(true),
        resetFailedAttempts: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.del.mockResolvedValue(1);

      await service.changePassword(userId, currentPassword, newPassword);
      expect(user.password).toBe(newPassword);
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`session:${userId}:123`);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
      });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
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
    const newPassword = 'NewPassword@123';
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should reset password successfully', async () => {
      const user = createMockUser({
        isResetTokenValid: jest.fn().mockReturnValue(true),
        clearResetToken: jest.fn(),
        resetFailedAttempts: jest.fn(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.del.mockResolvedValue(1);

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
      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('findDeletedUsers', () => {
    const paginationDto = { limit: 10, offset: 0, sort: 'deletedAt:DESC' };

    it('should return paginated deleted users without password', async () => {
      const mockUsers = [
        createMockUser({ id: '1', username: 'user1', deletedAt: new Date() }),
        createMockUser({ id: '2', username: 'user2', deletedAt: new Date() }),
      ];
      const queryBuilderMock = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, 2]),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      const result = await service.findDeletedUsers(paginationDto);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0]).not.toHaveProperty('resetPasswordToken');
      expect(result.data[0]).not.toHaveProperty('resetPasswordExpires');
    });

    it('should use default pagination when not provided', async () => {
      const queryBuilderMock = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await service.findDeletedUsers({});

      // ✅ Testojmë vetëm skip dhe take – service nuk garanton orderBy default
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getUserSessionsDetailed', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should return detailed sessions from Redis', async () => {
      const sessionData = JSON.stringify({
        accessToken: 'token1',
        ip: '127.0.0.1',
        userAgent: 'chrome',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 604800000).toISOString(),
      });

      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`, `session:${userId}:456`]]);
      redis.get
        .mockResolvedValueOnce(sessionData)
        .mockResolvedValueOnce(sessionData);

      const sessions = await service.getUserSessionsDetailed(userId);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('userId', userId);
      expect(sessions[0]).toHaveProperty('id', '123');
      expect(sessions[0]).toHaveProperty('ip', '127.0.0.1');
      expect(sessions[0]).toHaveProperty('isActive', true);
    });

    it('should return empty array if no sessions', async () => {
      redis.scan.mockResolvedValue(['0', []]);
      const sessions = await service.getUserSessionsDetailed(userId);
      expect(sessions).toEqual([]);
    });
  });

  describe('getUserSessions', () => {
    it('should return array of access tokens from Redis', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`, `session:${userId}:456`]]);
      redis.get
        .mockResolvedValueOnce(JSON.stringify({ accessToken: 'token1' }))
        .mockResolvedValueOnce(JSON.stringify({ accessToken: 'token2' }));

      const sessions = await service.getUserSessions(userId);
      expect(sessions).toEqual(['token1', 'token2']);
    });
  });

  describe('findUserById', () => {
    it('should return user without sensitive data', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findUserById(user.id);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('resetPasswordToken');
      expect(result).not.toHaveProperty('resetPasswordExpires');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findUserById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile (same as findUserById)', async () => {
      const user = createMockUser();
      const findUserSpy = jest.spyOn(service, 'findUserById').mockResolvedValue(user);

      const result = await service.getProfile(user.id);
      expect(findUserSpy).toHaveBeenCalledWith(user.id, false);
      expect(result).toBe(user);
    });
  });

  describe('revokeSession', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const sessionId = '123';

    it('should revoke session and refresh token', async () => {
      const sessionData = JSON.stringify({
        refreshToken: 'refresh-token-123',
        accessToken: 'access-token',
        ip: '127.0.0.1',
        userAgent: 'chrome',
      });
      redis.get.mockResolvedValue(sessionData);
      redis.del.mockResolvedValue(1);
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.revokeSession(userId, sessionId);
      expect(redis.get).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if session does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.revokeSession(userId, sessionId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should soft delete user and invalidate sessions', async () => {
      const user = createMockUser({ role: UserRole.USER });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.softDelete.mockResolvedValue({ affected: 1 });
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.del.mockResolvedValue(1);

      await service.softDeleteUser(userId);
      expect(userRepository.softDelete).toHaveBeenCalled();
      expect(refreshTokenRepository.update).toHaveBeenCalled();
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`session:${userId}:123`);
    });

    it('should throw BadRequestException if user is already deleted', async () => {
      const user = createMockUser({ deletedAt: new Date() });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.softDeleteUser(userId)).rejects.toThrow('User is already deleted');
    });

    it('should throw BadRequestException if trying to delete SUPER_ADMIN', async () => {
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.softDeleteUser(userId)).rejects.toThrow('Cannot delete Super Admin user');
    });
  });

  describe('restoreUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should restore user and activate account', async () => {
      const user = createMockUser({ deletedAt: new Date(), isActive: false });
      const restoredUser = createMockUser({
        ...user,
        deletedAt: null,
        isActive: false,
      });
      userRepository.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(restoredUser);
      userRepository.restore.mockResolvedValue({ affected: 1 });
      userRepository.save.mockImplementation(async (value) => value);

      const result = await service.restoreUser(userId);

      expect(userRepository.restore).toHaveBeenCalledWith(userId);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.restoreUser(userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not deleted', async () => {
      const user = createMockUser({ deletedAt: null });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.restoreUser(userId)).rejects.toThrow('User is not deleted');
    });
  });

  describe('permanentDeleteUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should permanently delete user and invalidate sessions', async () => {
      const user = createMockUser({ role: UserRole.USER });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.remove.mockResolvedValue({});
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      redis.scan.mockResolvedValue(['0', [`session:${userId}:123`]]);
      redis.del.mockResolvedValue(1);

      await service.permanentDeleteUser(userId);
      expect(userRepository.remove).toHaveBeenCalled();
      expect(refreshTokenRepository.update).toHaveBeenCalled();
      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`session:${userId}:123`);
    });

    it('should throw BadRequestException if trying to delete SUPER_ADMIN', async () => {
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.permanentDeleteUser(userId)).rejects.toThrow(
        'Cannot delete Super Admin user',
      );
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