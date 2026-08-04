// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { MailService } from '../mail/mail.service';
import { AuthenticatedUser } from './interfaces/authenticated-request.interface';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: any;
  let configService: any;
  let redis: any;
  let dataSource: any;
  let mailService: any;

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

  const createUserQueryBuilder = (user: User | null) => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(user),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  });

  const createRedisMulti = () => ({
    set: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    zrem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 'OK'],
      [null, 1],
    ]),
  });

  const currentUser: AuthenticatedUser = {
    id: 'admin-id',
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.SUPER_ADMIN,
    isActive: true,
    sid: 'session-id',
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
      createQueryBuilder: jest.fn(() => createUserQueryBuilder(null)),
    };

    refreshTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('test-access-token'),
    };

    const configValues: Record<string, unknown> = {
      'auth.jwt.secret': 'test-secret-with-at-least-32-characters',
      'auth.jwt.accessTokenExpiresIn': '15m',
      'auth.jwt.refreshTokenExpiresIn': '7d',
      'auth.jwt.issuer': 'container-management-system',
      'auth.jwt.audience': 'container-management-users',
      'auth.rateLimit.loginAttempts': 5,
      'auth.rateLimit.blockDuration': 15 * 60 * 1000,
      'auth.sessions.max': 10,
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => configValues[key] ?? defaultValue),
      getOrThrow: jest.fn((key: string) => {
        if (configValues[key] === undefined) {
          throw new Error(`Missing config: ${key}`);
        }
        return configValues[key];
      }),
    };

    // Create fresh Redis mock for each test
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zcard: jest.fn(),
      zpopmin: jest.fn(),
      eval: jest.fn(),
      multi: jest.fn(createRedisMulti),
      pipeline: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
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
          provide: REDIS_CLIENT,
          useValue: redis,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: MailService,
          useValue: mailService,
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

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
          save: jest.fn().mockResolvedValue(user),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      refreshTokenRepository.save.mockResolvedValue({ token: 'refresh-token-1' });
      jwtService.sign.mockReturnValue('test-access-token');

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redis.zcard.mockResolvedValue(0);

      const result = await service.login(loginDto, ip, userAgent);

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken).toHaveLength(96);
      expect(result.refreshToken).toMatch(/^[a-f0-9]{96}$/);
      expect(result.user).not.toHaveProperty('password');
      expect(redis.multi).toHaveBeenCalled();
      expect(refreshTokenRepository.save).toHaveBeenCalled();

      expect(user.resetFailedAttempts).toHaveBeenCalled();
      expect(user.lastLogin).toBeInstanceOf(Date);
      expect(user.lastLoginIp).toBe(ip);
      expect(user.lastLoginUserAgent).toBe(userAgent);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({
        isActive: false,
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn().mockReturnValue(false),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(null)),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
        incrementFailedAttempts: jest.fn(),
        failedLoginAttempts: 0,
        isLocked: jest.fn().mockReturnValue(false),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
          save: jest.fn().mockResolvedValue(user),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
      );
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

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
          save: jest.fn().mockResolvedValue(user),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
      );

      expect(user.incrementFailedAttempts).toHaveBeenCalled();
      expect(user.lockAccount).toHaveBeenCalledWith(15 * 60 * 1000);
      expect(user.failedLoginAttempts).toBe(5);
    });

    it('should reject deleted user', async () => {
      const user = createMockUser({
        deletedAt: new Date(),
        validatePassword: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn().mockReturnValue(false),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
      );
    });

    it('should reject locked account', async () => {
      const user = createMockUser({
        isLocked: jest.fn().mockReturnValue(true),
        validatePassword: jest.fn().mockResolvedValue(true),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => createUserQueryBuilder(user)),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.login(loginDto, ip, userAgent)).rejects.toThrow(
        'Invalid credentials or account unavailable',
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

    it('should create a user with specified role when SUPER_ADMIN is logged in', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(registerDto, currentUser);
      expect(result.role).toBe(UserRole.USER);
    });

    it('should allow SUPER_ADMIN to create ADMIN', async () => {
      const dto = { ...registerDto, role: UserRole.ADMIN };
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(dto, currentUser);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should allow ADMIN to create ADMIN', async () => {
      const adminUser: AuthenticatedUser = {
        ...currentUser,
        role: UserRole.ADMIN,
      };
      const dto = { ...registerDto, role: UserRole.ADMIN };
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register(dto, adminUser);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should throw UnauthorizedException if ADMIN tries to create SUPER_ADMIN', async () => {
      const adminUser: AuthenticatedUser = {
        ...currentUser,
        role: UserRole.ADMIN,
      };
      const dto = { ...registerDto, role: UserRole.SUPER_ADMIN };
      await expect(service.register(dto, adminUser)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if regular USER tries to register', async () => {
      const regularUser: AuthenticatedUser = {
        ...currentUser,
        role: UserRole.USER,
      };
      await expect(service.register(registerDto, regularUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());
      await expect(service.register(registerDto, currentUser)).rejects.toThrow(ConflictException);
    });

    it('should handle DB unique violation 23505', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const dbError = new Error('duplicate key');
      (dbError as any).code = '23505';
      userRepository.save.mockRejectedValue(dbError);
      await expect(service.register(registerDto, currentUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and delete Redis session', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const sessionId = 'session-id-123';
      const mockToken = { id: 'token-id', userId, sessionId, isActive: true };

      refreshTokenRepository.findOne.mockResolvedValue(mockToken);
      refreshTokenRepository.save.mockImplementation(async (token) => token);

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);

      await service.logout(userId, sessionId);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId,
          sessionId,
          isActive: true,
        },
      });
      expect(refreshTokenRepository.save).toHaveBeenCalled();
      expect(redis.multi).toHaveBeenCalled();
      expect(redisMulti.del).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
      expect(redisMulti.zrem).toHaveBeenCalledWith(`user-sessions:${userId}`, sessionId);

      const savedToken = refreshTokenRepository.save.mock.calls[0][0];
      expect(savedToken.isActive).toBe(false);
      expect(savedToken.revokedReason).toBe('logout');
      expect(savedToken.revokedAt).toBeInstanceOf(Date);
    });

    it('should throw UnauthorizedException if session not found', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.logout('user-id', 'session-id')).rejects.toThrow(
        'Current session is not active',
      );
    });

    it('should continue even if Redis cleanup fails', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const sessionId = 'session-id-123';
      const mockToken = { id: 'token-id', userId, sessionId, isActive: true };

      refreshTokenRepository.findOne.mockResolvedValue(mockToken);
      refreshTokenRepository.save.mockResolvedValue(mockToken);

      const redisMulti = createRedisMulti();
      redisMulti.exec.mockRejectedValue(new Error('Redis error'));
      redis.multi.mockReturnValue(redisMulti);

      await expect(service.logout(userId, sessionId)).resolves.not.toThrow();
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens and delete all Redis sessions', async () => {
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      refreshTokenRepository.update.mockResolvedValue({ affected: 2 });

      redis.zrange.mockResolvedValue(['session-1', 'session-2']);

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redisMulti.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 1],
      ]);

      await service.logoutAll(userId);

      expect(refreshTokenRepository.update).toHaveBeenCalled();
      expect(redis.zrange).toHaveBeenCalledWith(`user-sessions:${userId}`, 0, -1);
      expect(redis.multi).toHaveBeenCalled();
      expect(redisMulti.exec).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access and refresh tokens and update Redis session', async () => {
      const refreshToken = 'refresh-token-1';
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const sessionId = 'session-123';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const user = createMockUser({ id: userId });

      const tokenReference = {
        id: 'token-id',
        userId,
        sessionId,
      };

      refreshTokenRepository.findOne.mockResolvedValue(tokenReference);

      const transactionalTokenRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'token-id',
            token: tokenHash,
            user,
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sessionId,
            userId,
          }),
        })),
        save: jest.fn().mockResolvedValue({ token: 'new-refresh-token' }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          if (entity === User) {
            return {
              createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                withDeleted: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(user),
              })),
            };
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshTokenHash: tokenHash,
          ip: '127.0.0.1',
          userAgent: 'chrome',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 604800000).toISOString(),
        }),
      );

      redis.eval.mockResolvedValue(1);

      const result = await service.refreshAccessToken(refreshToken);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(transactionalTokenRepository.save).toHaveBeenCalledTimes(2);
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        `session:${userId}:${sessionId}`,
        tokenHash,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const refreshToken = 'expired-token';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const tokenReference = {
        id: 'token-id',
        userId: 'user-id',
        sessionId: 'session-id',
      };

      refreshTokenRepository.findOne.mockResolvedValue(tokenReference);

      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshTokenHash: tokenHash,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        }),
      );

      const transactionalTokenRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'token-id',
            token: tokenHash,
            user: createMockUser(),
            isActive: true,
            expiresAt: new Date(Date.now() - 1000),
            sessionId: 'session-id',
            userId: 'user-id',
          }),
        })),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should throw UnauthorizedException on CAS mismatch with cleanup', async () => {
      const refreshToken = 'refresh-token-1';
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const sessionId = 'session-123';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const user = createMockUser({ id: userId });

      const tokenReference = {
        id: 'token-id',
        userId,
        sessionId,
      };

      refreshTokenRepository.findOne.mockResolvedValue(tokenReference);

      const transactionalTokenRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'token-id',
            token: tokenHash,
            user,
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sessionId,
            userId,
          }),
        })),
        save: jest.fn().mockResolvedValue({ token: 'new-refresh-token' }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          if (entity === User) {
            return {
              createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                withDeleted: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(user),
              })),
            };
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshTokenHash: tokenHash,
          ip: '127.0.0.1',
          userAgent: 'chrome',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 604800000).toISOString(),
        }),
      );

      redis.eval.mockResolvedValue(0);

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          isActive: true,
        }),
        expect.objectContaining({
          isActive: false,
          revokedReason: 'redis_cas_mismatch',
        }),
      );
      expect(redis.multi).toHaveBeenCalled();
      expect(redisMulti.del).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
    });

    it('should throw UnauthorizedException on Redis error (CAS helper returns false with mismatch cleanup)', async () => {
      const refreshToken = 'refresh-token-1';
      const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
      const sessionId = 'session-123';
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const user = createMockUser({ id: userId });

      const tokenReference = {
        id: 'token-id',
        userId,
        sessionId,
      };

      refreshTokenRepository.findOne.mockResolvedValue(tokenReference);

      const transactionalTokenRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'token-id',
            token: tokenHash,
            user,
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sessionId,
            userId,
          }),
        })),
        save: jest.fn().mockResolvedValue({ token: 'new-refresh-token' }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          if (entity === User) {
            return {
              createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                withDeleted: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(user),
              })),
            };
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.get.mockResolvedValue(
        JSON.stringify({
          refreshTokenHash: tokenHash,
          ip: '127.0.0.1',
          userAgent: 'chrome',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 604800000).toISOString(),
        }),
      );

      redis.eval.mockRejectedValue(new Error('Redis unavailable'));

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          isActive: true,
        }),
        expect.objectContaining({
          isActive: false,
          revokedReason: 'redis_cas_mismatch',
        }),
      );
      expect(redis.multi).toHaveBeenCalled();
      expect(redisMulti.del).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
    });
  });

  describe('changePassword', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentPassword = 'oldPassword';
    const newPassword = 'NewPassword@123';

    it('should change password successfully and invalidate sessions', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
        resetFailedAttempts: jest.fn(),
      });

      const transactionalUserRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withDeleted: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(user),
        })),
        save: jest.fn().mockResolvedValue(user),
      };

      const transactionalTokenRepository = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === User) {
            return transactionalUserRepository;
          }
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.zrange.mockResolvedValue(['session-1']);
      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redisMulti.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);

      await service.changePassword(userId, currentPassword, newPassword);
      expect(transactionalUserRepository.save).toHaveBeenCalled();
      expect(transactionalTokenRepository.update).toHaveBeenCalled();
      expect(redis.multi).toHaveBeenCalled();
      expect(user.password).toBe(newPassword);
      expect(user.resetFailedAttempts).toHaveBeenCalled();
    });

    it('should throw BadRequestException if new password is same as current', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
        resetFailedAttempts: jest.fn(),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      const user = createMockUser({
        validatePassword: jest.fn().mockResolvedValue(false),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    const email = 'test@example.com';

    it('should generate reset token and save user', async () => {
      const user = createMockUser({
        email,
        setResetToken: jest.fn(),
      });

      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      mailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword(email);
      expect(user.setResetToken).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/),
        3600000,
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      expect(result).toEqual({ message: 'If this email exists, a reset link has been sent' });
    });

    it('should return same message if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(email);
      expect(result).toEqual({ message: 'If this email exists, a reset link has been sent' });
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException if email fails and clear token', async () => {
      const user = createMockUser({
        email,
        setResetToken: jest.fn(),
        clearResetToken: jest.fn(),
      });

      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);
      mailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP unavailable'));

      await expect(service.forgotPassword(email)).rejects.toThrow(ServiceUnavailableException);
      expect(user.clearResetToken).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const token = 'valid-token';
    const newPassword = 'NewPassword@123';

    it('should reset password successfully', async () => {
      const user = createMockUser({
        isResetTokenValid: jest.fn().mockReturnValue(true),
        clearResetToken: jest.fn(),
        resetFailedAttempts: jest.fn(),
      });

      const transactionalUserRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withDeleted: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(user),
        })),
        save: jest.fn().mockResolvedValue(user),
      };

      const transactionalTokenRepository = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === User) {
            return transactionalUserRepository;
          }
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.zrange.mockResolvedValue(['session-1']);
      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redisMulti.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);

      const result = await service.resetPassword(token, newPassword);
      expect(user.clearResetToken).toHaveBeenCalled();
      expect(user.resetFailedAttempts).toHaveBeenCalled();
      expect(transactionalUserRepository.save).toHaveBeenCalled();
      expect(transactionalTokenRepository.update).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = createMockUser({
        deletedAt: new Date(),
        isResetTokenValid: jest.fn().mockReturnValue(true),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({
        isActive: false,
        isResetTokenValid: jest.fn().mockReturnValue(true),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      const user = createMockUser({
        isResetTokenValid: jest.fn().mockReturnValue(false),
      });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

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
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0]).not.toHaveProperty('resetPasswordToken');
      expect(result.data[0]).not.toHaveProperty('resetPasswordExpires');
    });

    it('should use default pagination when not provided', async () => {
      const queryBuilderMock = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      userRepository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await service.findDeletedUsers({});

      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getUserSessionsDetailed', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentSessionId = '123';

    it('should return detailed sessions from Redis', async () => {
      const sessionData1 = JSON.stringify({
        refreshTokenHash: 'hash-1',
        ip: '127.0.0.1',
        userAgent: 'chrome',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 604800000).toISOString(),
      });

      const sessionData2 = JSON.stringify({
        refreshTokenHash: 'hash-2',
        ip: '127.0.0.2',
        userAgent: 'firefox',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 604800000).toISOString(),
      });

      redis.zrange.mockResolvedValue(['123', '456']);

      const redisPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, sessionData1],
          [null, sessionData2],
        ]),
      };
      redis.pipeline.mockReturnValue(redisPipeline);

      const sessions = await service.getUserSessionsDetailed(userId, currentSessionId);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('userId', userId);
      expect(sessions[0]).toHaveProperty('id', '123');
      expect(sessions[0]).toHaveProperty('ip', '127.0.0.1');
      expect(sessions[0]).toHaveProperty('isActive', true);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
    });

    it('should return empty array if no sessions', async () => {
      redis.zrange.mockResolvedValue([]);
      const sessions = await service.getUserSessionsDetailed(userId, currentSessionId);
      expect(sessions).toEqual([]);
    });

    it('should handle pipeline.exec() === null', async () => {
      redis.zrange.mockResolvedValue(['123']);
      const redisPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      redis.pipeline.mockReturnValue(redisPipeline);

      await expect(service.getUserSessionsDetailed(userId, currentSessionId)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should remove corrupted session data from ZSET', async () => {
      redis.zrange.mockResolvedValue(['123']);

      const redisPipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 'invalid-json']]),
      };
      redis.pipeline.mockReturnValue(redisPipeline);

      redis.zrem.mockResolvedValue(1);

      const sessions = await service.getUserSessionsDetailed(userId, currentSessionId);
      expect(sessions).toEqual([]);
      expect(redis.zrem).toHaveBeenCalledWith(`user-sessions:${userId}`, '123');
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
      const userResponse = {
        id: 'user-id',
        username: 'admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        isActive: true,
        lastLogin: null,
        lastLoginIp: null,
        lastLoginUserAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const findUserSpy = jest.spyOn(service, 'findUserById').mockResolvedValue(userResponse);

      const result = await service.getProfile('user-id');
      expect(findUserSpy).toHaveBeenCalledWith('user-id', false);
      expect(result).toBe(userResponse);
    });
  });

  describe('revokeSession', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const sessionId = '123';

    it('should revoke session and refresh token', async () => {
      const sessionData = JSON.stringify({
        refreshTokenHash: 'refresh-token-hash',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        ip: '127.0.0.1',
        userAgent: 'chrome',
      });

      redis.get.mockResolvedValue(sessionData);

      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);

      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.revokeSession(userId, sessionId);
      expect(redis.get).toHaveBeenCalledWith(`session:${userId}:${sessionId}`);
      expect(redis.multi).toHaveBeenCalled();
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if session does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.revokeSession(userId, sessionId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentUserId = 'different-admin-id';

    it('should soft delete user and invalidate sessions', async () => {
      const user = createMockUser({ role: UserRole.USER });

      const transactionalUserRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withDeleted: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(user),
        })),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const transactionalTokenRepository = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === User) {
            return transactionalUserRepository;
          }
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.zrange.mockResolvedValue(['session-1']);
      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redisMulti.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);

      await service.softDeleteUser(userId, currentUserId);
      expect(transactionalUserRepository.softDelete).toHaveBeenCalled();
      expect(transactionalTokenRepository.update).toHaveBeenCalled();
      expect(redis.multi).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete own account', async () => {
      // No need to mock transaction because it should not be called
      await expect(service.softDeleteUser(userId, userId)).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is already deleted', async () => {
      const user = createMockUser({ deletedAt: new Date() });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.softDeleteUser(userId, currentUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if trying to delete SUPER_ADMIN', async () => {
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.softDeleteUser(userId, currentUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('restoreUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';

    it('should restore user and activate account', async () => {
      const user = createMockUser({ deletedAt: new Date(), isActive: false });

      const transactionalUserRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withDeleted: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(user),
        })),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn().mockImplementation(async (value: User) => value),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === User) {
            return transactionalUserRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      const result = await service.restoreUser(userId);

      expect(transactionalUserRepository.restore).toHaveBeenCalledWith(userId);
      expect(transactionalUserRepository.save).toHaveBeenCalled();
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.restoreUser(userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not deleted', async () => {
      const user = createMockUser({ deletedAt: null });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.restoreUser(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('permanentDeleteUser', () => {
    const userId = '70dd2947-2b10-4ddb-aa44-48f1d5f71e1d';
    const currentUserId = 'different-admin-id';

    it('should permanently delete user and invalidate sessions', async () => {
      const user = createMockUser({ role: UserRole.USER, deletedAt: new Date() });

      const transactionalUserRepository = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          withDeleted: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(user),
        })),
        remove: jest.fn().mockResolvedValue({}),
      };

      const transactionalTokenRepository = {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === User) {
            return transactionalUserRepository;
          }
          if (entity === RefreshToken) {
            return transactionalTokenRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      redis.zrange.mockResolvedValue(['session-1']);
      const redisMulti = createRedisMulti();
      redis.multi.mockReturnValue(redisMulti);
      redisMulti.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
      ]);

      await service.permanentDeleteUser(userId, currentUserId);
      expect(transactionalUserRepository.remove).toHaveBeenCalled();
      expect(transactionalTokenRepository.delete).toHaveBeenCalled();
      expect(redis.multi).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to delete own account', async () => {
      // No need to mock transaction because it should not be called
      await expect(service.permanentDeleteUser(userId, userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is not soft-deleted', async () => {
      const user = createMockUser({ role: UserRole.USER, deletedAt: null });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.permanentDeleteUser(userId, currentUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if trying to delete SUPER_ADMIN', async () => {
      const user = createMockUser({ role: UserRole.SUPER_ADMIN, deletedAt: new Date() });

      const manager = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn(() => ({
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            withDeleted: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(user),
          })),
        }),
      };

      dataSource.transaction.mockImplementation(async (callback: (manager: any) => Promise<any>) =>
        callback(manager),
      );

      await expect(service.permanentDeleteUser(userId, currentUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user if found and active', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      const result = await service.validateUser(user.id);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.validateUser('non-existent-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const user = createMockUser({ isActive: false });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.validateUser('user-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      const user = createMockUser({ deletedAt: new Date() });
      userRepository.findOne.mockResolvedValue(user);
      await expect(service.validateUser('user-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});
