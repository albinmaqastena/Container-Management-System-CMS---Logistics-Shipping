// src/modules/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { StringValue } from 'ms';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionDto } from './dto/session.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User, UserRole } from './entities/user.entity';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { ALLOWED_SORT_FIELDS, buildSortObject } from '../../common/utils/sort.utils';
import { MailService } from '../mail/mail.service';
import type { AuthenticatedUser } from './interfaces/authenticated-request.interface';

interface RedisSessionData {
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

// ─── REDIS SCRIPT ──────────────────────────────────────────────────────────

/**
 * Lua script për përditësimin e session-it vetëm nëse hash-i përputhet
 */
const COMPARE_AND_SET_SESSION_SCRIPT = `
  local current = redis.call('GET', KEYS[1])
  if not current then
    return 0
  end
  local data = cjson.decode(current)
  if data.refreshTokenHash ~= ARGV[1] then
    return 0
  end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionTtl: number;
  private readonly maxSessions: number;
  private readonly compareAndSetScript: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    this.sessionTtl = this.parseDurationToSeconds(
      this.configService.get<string>('auth.jwt.refreshTokenExpiresIn', '7d'),
    );
    this.maxSessions = this.configService.get<number>('auth.sessions.max', 10);
    this.compareAndSetScript = COMPARE_AND_SET_SESSION_SCRIPT;
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  async login(loginDto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponseDto> {
    const { email, password } = loginDto;
    const publicAuthError = 'Invalid credentials or account unavailable';

    // ✅ Transaction që nuk hedh exception për rastet e dështimit (për të ruajtur failedAttempts)
    const loginResult = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.email = :email', { email })
        .withDeleted()
        .getOne();

      if (!user) {
        return { success: false as const, reason: 'not_found' as const };
      }

      if (user.deletedAt || !user.isActive || user.isLocked()) {
        return { success: false as const, reason: 'unavailable' as const };
      }

      const validPassword = await user.validatePassword(password);
      if (!validPassword) {
        user.incrementFailedAttempts();
        const maxAttempts = this.configService.get<number>('auth.rateLimit.loginAttempts', 5);
        if (user.failedLoginAttempts >= maxAttempts) {
          user.lockAccount(
            this.configService.get<number>('auth.rateLimit.blockDuration', 15 * 60 * 1000),
          );
        }
        await repository.save(user);
        return {
          success: false as const,
          reason: 'invalid_password' as const,
          userId: user.id,
        };
      }

      user.resetFailedAttempts();
      user.lastLogin = new Date();
      user.lastLoginIp = ip || 'unknown';
      user.lastLoginUserAgent = userAgent || 'unknown';
      await repository.save(user);
      return { success: true as const, user };
    });

    if (!loginResult.success) {
      this.logger.warn(`Login rejected: ${loginResult.reason}`);
      throw new UnauthorizedException(publicAuthError);
    }

    const user = loginResult.user;

    const sessionId = randomUUID();
    const now = new Date();
    const refreshToken = await this.generateRefreshToken(user, ip, userAgent, sessionId);
    const refreshTokenHash = this.hashToken(refreshToken);
    const sessionKey = this.sessionKey(user.id, sessionId);

    try {
      const result = await this.redis
        .multi()
        .set(
          sessionKey,
          JSON.stringify({
            refreshTokenHash,
            userAgent: userAgent || 'unknown',
            ip: ip || 'unknown',
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + this.sessionTtl * 1000).toISOString(),
          }),
          'EX',
          this.sessionTtl,
        )
        .zadd(this.sessionIndexKey(user.id), now.getTime(), sessionId)
        .exec();

      this.assertRedisExec(result, 'Redis session creation failed');
      await this.enforceSessionLimit(user.id);
    } catch (error: unknown) {
      // Rollback
      await this.refreshTokenRepository.update(
        { token: refreshTokenHash, userId: user.id, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'session_creation_failed',
        },
      );
      await this.deleteSession(user.id, sessionId).catch(() => undefined);
      this.logError('Unable to create Redis session during login', error);
      throw new ServiceUnavailableException('Unable to create authentication session');
    }

    return new AuthResponseDto(
      this.generateAccessToken(user, sessionId),
      this.sanitizeUser(user),
      refreshToken,
    );
  }

  // ─── REFRESH TOKEN ──────────────────────────────────────────────────────

  async refreshAccessToken(refreshToken: string): Promise<RefreshResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    const tokenReference = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash, isActive: true },
      select: { id: true, userId: true, sessionId: true },
    });

    if (!tokenReference?.sessionId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const sessionKey = this.sessionKey(tokenReference.userId, tokenReference.sessionId);

    let sessionValue: string | null;
    try {
      sessionValue = await this.redis.get(sessionKey);
    } catch (error: unknown) {
      this.logError('Unable to read refresh session from Redis', error);
      throw new ServiceUnavailableException('Authentication session service is unavailable');
    }

    const session = sessionValue ? this.parseRedisSession(sessionValue) : null;

    if (!session || session.refreshTokenHash !== tokenHash) {
      throw new UnauthorizedException('Session not found for this refresh token');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshToken);
      const storedToken = await repository
        .createQueryBuilder('token')
        .innerJoinAndSelect('token.user', 'user')
        .where('token.id = :id', {
          id: tokenReference.id,
        })
        .andWhere('token.token = :tokenHash', {
          tokenHash,
        })
        .andWhere('token.isActive = true')
        .setLock('pessimistic_write', undefined, ['token'])
        .getOne();

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      if (storedToken.user.deletedAt || !storedToken.user.isActive) {
        throw new UnauthorizedException('Invalid credentials or account unavailable');
      }
      if (storedToken.sessionId !== tokenReference.sessionId) {
        throw new UnauthorizedException('Session does not match refresh token');
      }

      storedToken.isActive = false;
      storedToken.revokedAt = new Date();
      storedToken.revokedReason = 'rotated';
      await repository.save(storedToken);

      const newRefreshToken = await this.generateRefreshToken(
        storedToken.user,
        session.ip,
        session.userAgent,
        storedToken.sessionId,
        repository,
      );

      return {
        userId: storedToken.user.id,
        sessionId: storedToken.sessionId,
        accessToken: this.generateAccessToken(storedToken.user, storedToken.sessionId),
        refreshToken: newRefreshToken,
        refreshTokenHash: this.hashToken(newRefreshToken),
      };
    });

    // CAS update
    const newSessionData = JSON.stringify({
      ...session,
      refreshTokenHash: result.refreshTokenHash,
      expiresAt: new Date(Date.now() + this.sessionTtl * 1000).toISOString(),
    });

    // Funksion ndihmës për të pastruar token-in e ri dhe session-in në rast dështimi
    const cleanupAfterCasFailure = async (reason: string): Promise<void> => {
      const results = await Promise.allSettled([
        this.refreshTokenRepository.update(
          {
            token: result.refreshTokenHash,
            userId: result.userId,
            isActive: true,
          },
          {
            isActive: false,
            revokedAt: new Date(),
            revokedReason: reason,
          },
        ),
        this.deleteSession(result.userId, result.sessionId),
      ]);

      for (const cleanupResult of results) {
        if (cleanupResult.status === 'rejected') {
          this.logError(`Refresh CAS cleanup failed (${reason})`, cleanupResult.reason);
        }
      }

      this.logger.warn(`Refresh rotation cleanup performed: ${reason}`);
    };

    try {
      const updated = await this.compareAndSetSession(
        sessionKey,
        tokenHash,
        newSessionData,
        this.sessionTtl,
      );

      if (!updated) {
        // Hash mismatch – session-i është ndryshuar nga një tjetër
        await cleanupAfterCasFailure('redis_cas_mismatch');
        throw new UnauthorizedException(
          'Token refresh could not be completed. Please sign in again.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Gabim tjetër (Redis outage)
      this.logError('Compare-and-set session failed', error);
      await cleanupAfterCasFailure('redis_cas_error');
      throw new ServiceUnavailableException('Authentication session service is unavailable');
    }

    return new RefreshResponseDto(result.accessToken, result.refreshToken);
  }

  // ─── LOGOUT ──────────────────────────────────────────────────────────────

  async logout(userId: string, sessionId: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: {
        userId,
        sessionId,
        isActive: true,
      },
    });

    if (!token) {
      throw new UnauthorizedException('Current session is not active');
    }

    token.isActive = false;
    token.revokedAt = new Date();
    token.revokedReason = 'logout';

    await this.refreshTokenRepository.save(token);

    try {
      await this.deleteSession(userId, sessionId);
    } catch (error: unknown) {
      this.logError('Unable to remove Redis session during logout', error);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllRefreshTokens(userId, 'logout_all');
    await this.invalidateAllSessions(userId);
  }

  // ─── REGISTER ────────────────────────────────────────────────────────────

  async register(
    registerDto: RegisterDto,
    currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: registerDto.email }, { username: registerDto.username }],
      withDeleted: true,
    });
    if (existingUser) {
      if (existingUser.deletedAt) {
        throw new ConflictException(
          'This account was previously deleted. Please contact support to restore it.',
        );
      }
      throw new ConflictException('User already exists');
    }

    let role = registerDto.role || UserRole.USER;
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      role =
        registerDto.role === UserRole.SUPER_ADMIN
          ? UserRole.SUPER_ADMIN
          : registerDto.role === UserRole.ADMIN
            ? UserRole.ADMIN
            : UserRole.USER;
    } else if (currentUser.role === UserRole.ADMIN) {
      if (registerDto.role === UserRole.SUPER_ADMIN) {
        throw new UnauthorizedException('Admin cannot create Super Admin');
      }
      role = registerDto.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;
    } else {
      throw new UnauthorizedException('Only admins can register new users');
    }

    try {
      const savedUser = await this.userRepository.save(
        new User({
          username: registerDto.username,
          email: registerDto.email,
          password: registerDto.password,
          role,
        }),
      );
      return this.sanitizeUser(savedUser);
    } catch (error: unknown) {
      if (this.isDatabaseError(error, '23505')) {
        throw new ConflictException('A user with this email or username already exists');
      }
      this.rethrowUnknown(error);
    }
  }

  // ─── CHANGE PASSWORD ────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .withDeleted()
        .getOne();

      if (!user || user.deletedAt || !user.isActive) {
        throw new UnauthorizedException('User account is unavailable');
      }
      if (!(await user.validatePassword(currentPassword))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      if (await user.validatePassword(newPassword)) {
        throw new BadRequestException('New password must be different from the current password');
      }

      user.password = newPassword;
      user.resetFailedAttempts();
      await repo.save(user);

      await this.revokeAllRefreshTokens(userId, 'password_changed', manager);
    });

    await this.invalidateAllSessions(userId);
  }

  // ─── FORGOT / RESET PASSWORD ───────────────────────────────────────────

  async forgotPassword(email: string): Promise<MessageResponseDto> {
    const genericMessage = 'If this email exists, a reset link has been sent';
    const user = await this.userRepository.findOne({ where: { email }, withDeleted: true });
    if (!user || user.deletedAt || !user.isActive) {
      return new MessageResponseDto(genericMessage);
    }

    const rawToken = randomBytes(32).toString('hex');
    user.setResetToken(this.hashToken(rawToken), 60 * 60 * 1000);
    await this.userRepository.save(user);

    try {
      await this.mailService.sendPasswordResetEmail(user.email, rawToken);
    } catch (error: unknown) {
      user.clearResetToken();
      await this.userRepository.save(user);
      this.logError('Unable to send password reset email', error);
      throw new ServiceUnavailableException('Password reset service is temporarily unavailable');
    }

    return new MessageResponseDto(genericMessage);
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageResponseDto> {
    const tokenHash = this.hashToken(token);

    const userId = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.resetPasswordToken = :tokenHash', { tokenHash })
        .withDeleted()
        .getOne();

      if (!user || !user.isResetTokenValid(tokenHash) || user.deletedAt || !user.isActive) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      user.password = newPassword;
      user.clearResetToken();
      user.resetFailedAttempts();
      await repository.save(user);

      await this.revokeAllRefreshTokens(user.id, 'password_reset', manager);
      return user.id;
    });

    await this.invalidateAllSessions(userId);
    return new MessageResponseDto('Password reset successfully');
  }

  // ─── SESSIONS ────────────────────────────────────────────────────────────

  async getUserSessionsDetailed(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const indexKey = this.sessionIndexKey(userId);
    const sessionIds = await this.redis.zrange(indexKey, 0, -1);

    if (sessionIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();

    for (const sessionId of sessionIds) {
      pipeline.get(this.sessionKey(userId, sessionId));
    }

    const results = await pipeline.exec();

    if (!results) {
      throw new ServiceUnavailableException('Unable to retrieve authentication sessions');
    }

    const sessions: SessionDto[] = [];

    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const pipelineResult = results[i];

      if (!sessionId || !pipelineResult) {
        continue;
      }

      const [pipelineError, value] = pipelineResult;

      if (pipelineError) {
        this.logError(`Unable to retrieve session ${sessionId}`, pipelineError);
        continue;
      }

      if (typeof value !== 'string') {
        await this.redis.zrem(indexKey, sessionId);
        continue;
      }

      const session = this.parseRedisSession(value);

      if (!session) {
        await this.redis.zrem(indexKey, sessionId);
        continue;
      }

      sessions.push({
        userId,
        id: sessionId,
        createdAt: new Date(session.createdAt),
        expiresAt: new Date(session.expiresAt),
        ip: session.ip,
        userAgent: session.userAgent,
        isActive: true,
        isCurrent: sessionId === currentSessionId,
      });
    }

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const value = await this.redis.get(this.sessionKey(userId, sessionId));
    if (!value) throw new NotFoundException('Session not found');
    const session = this.parseRedisSession(value);
    if (!session) {
      await this.deleteSession(userId, sessionId);
      throw new BadRequestException('Invalid session data');
    }

    await this.refreshTokenRepository.update(
      { token: session.refreshTokenHash, userId, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'session_revoked',
      },
    );
    await this.deleteSession(userId, sessionId);
  }

  // ─── USER VALIDATION & PROFILE ─────────────────────────────────────────

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId }, withDeleted: true });
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('User account is unavailable');
    }
    return user;
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    return this.findUserById(userId, false);
  }

  async findUserById(id: string, includeDeleted = false): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id }, withDeleted: includeDeleted });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  // ─── SOFT DELETE / RESTORE / PERMANENT DELETE ──────────────────────────

  async softDeleteUser(userId: string, currentUserId: string): Promise<void> {
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const tokenRepository = manager.getRepository(RefreshToken);
      const user = await userRepository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .withDeleted()
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if (user.deletedAt) throw new BadRequestException('User is already deleted');
      if (user.role === UserRole.SUPER_ADMIN) {
        throw new BadRequestException('Cannot delete Super Admin user');
      }

      await userRepository.softDelete(userId);
      await tokenRepository.update(
        { userId, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'user_deleted',
        },
      );
    });

    await this.invalidateAllSessions(userId);
  }

  async restoreUser(userId: string): Promise<UserResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .withDeleted()
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if (!user.deletedAt) throw new BadRequestException('User is not deleted');

      await repository.restore(userId);
      user.deletedAt = null;
      user.isActive = true;
      return this.sanitizeUser(await repository.save(user));
    });
  }

  async permanentDeleteUser(userId: string, currentUserId: string): Promise<void> {
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot permanently delete your own account');
    }

    await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const tokenRepository = manager.getRepository(RefreshToken);
      const user = await userRepository
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .withDeleted()
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if (!user.deletedAt) {
        throw new BadRequestException('User must be soft-deleted before permanent deletion');
      }
      if (user.role === UserRole.SUPER_ADMIN) {
        throw new BadRequestException('Cannot delete Super Admin user');
      }

      await tokenRepository.delete({ userId });
      await userRepository.remove(user);
    });

    await this.invalidateAllSessions(userId);
  }

  async findDeletedUsers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(paginationDto.sort, ALLOWED_SORT_FIELDS.users);
    if (Object.keys(sortObject).length > 0) {
      for (const [field, direction] of Object.entries(sortObject)) {
        queryBuilder.addOrderBy(`user.${field}`, direction);
      }
    } else {
      queryBuilder.orderBy('user.deletedAt', 'DESC');
    }

    queryBuilder.skip(offset).take(limit);
    const [users, total] = await queryBuilder.getManyAndCount();
    return new PaginatedResponseDto<UserResponseDto>(
      users.map((user) => this.sanitizeUser(user)),
      total,
      limit,
      offset,
    );
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private sanitizeUser(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin ?? null,
      lastLoginIp: user.lastLoginIp ?? null,
      lastLoginUserAgent: user.lastLoginUserAgent ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt ?? null,
    };
  }

  private generateAccessToken(user: User, sessionId: string): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, sid: sessionId },
      {
        expiresIn: this.configService.getOrThrow<StringValue>('auth.jwt.accessTokenExpiresIn'),
      },
    );
  }

  private async generateRefreshToken(
    user: User,
    ip: string | undefined,
    userAgent: string | undefined,
    sessionId: string,
    repository: Repository<RefreshToken> = this.refreshTokenRepository,
  ): Promise<string> {
    const token = randomBytes(48).toString('hex');
    await repository.save(
      new RefreshToken({
        token: this.hashToken(token),
        userId: user.id,
        user,
        expiresAt: new Date(Date.now() + this.sessionTtl * 1000),
        isActive: true,
        ip,
        userAgent,
        sessionId,
      }),
    );
    return token;
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const indexKey = this.sessionIndexKey(userId);
    const overflow = (await this.redis.zcard(indexKey)) - this.maxSessions;
    if (overflow <= 0) return;

    const oldest = await this.redis.zpopmin(indexKey, overflow);
    for (const item of oldest) {
      const sessionId = item[0];
      const originalScore = Number(item[1]);
      try {
        await this.revokeAndDeleteSession(userId, sessionId, 'session_limit');
      } catch (error) {
        // Kompenso: rikthe session ID në ZSET me score origjinale
        this.logError(`Failed to revoke session ${sessionId} during limit enforcement`, error);
        await this.redis.zadd(indexKey, originalScore, sessionId);
      }
    }
  }

  private async revokeAndDeleteSession(
    userId: string,
    sessionId: string,
    reason: string,
  ): Promise<void> {
    const value = await this.redis.get(this.sessionKey(userId, sessionId));
    const session = value ? this.parseRedisSession(value) : null;
    if (session) {
      await this.refreshTokenRepository.update(
        { token: session.refreshTokenHash, userId, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      );
    }
    await this.deleteSession(userId, sessionId);
  }

  private async deleteSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.redis
      .multi()
      .del(this.sessionKey(userId, sessionId))
      .zrem(this.sessionIndexKey(userId), sessionId)
      .exec();
    this.assertRedisExec(result, 'Redis session deletion failed');
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    try {
      const indexKey = this.sessionIndexKey(userId);
      const sessionIds = await this.redis.zrange(indexKey, 0, -1);
      const pipeline = this.redis.multi();
      for (const sessionId of sessionIds) {
        pipeline.del(this.sessionKey(userId, sessionId));
      }
      pipeline.del(indexKey);
      this.assertRedisExec(await pipeline.exec(), 'Redis session invalidation failed');
    } catch (error: unknown) {
      // Best effort – access token-et e vjetër do të skadojnë normalisht
      this.logError('Error invalidating sessions with Redis', error);
    }
  }

  private async revokeAllRefreshTokens(
    userId: string,
    reason: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository;
    await repository.update(
      { userId, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  // ─── COMPARE-AND-SET ────────────────────────────────────────────────────

  private async compareAndSetSession(
    key: string,
    expectedHash: string,
    newValue: string,
    ttl: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        this.compareAndSetScript,
        1,
        key,
        expectedHash,
        newValue,
        ttl,
      );
      return result === 1;
    } catch (error) {
      this.logError('Compare-and-set session failed', error);
      return false;
    }
  }

  // ─── SESSION KEY HELPERS ───────────────────────────────────────────────

  private sessionKey(userId: string, sessionId: string): string {
    return `session:${userId}:${sessionId}`;
  }

  private sessionIndexKey(userId: string): string {
    return `user-sessions:${userId}`;
  }

  // ─── HASHING ────────────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ─── REDIS SESSION PARSER ─────────────────────────────────────────────

  private parseRedisSession(value: string): RedisSessionData | null {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const session = parsed as Record<string, unknown>;
      if (
        typeof session.refreshTokenHash !== 'string' ||
        typeof session.createdAt !== 'string' ||
        typeof session.expiresAt !== 'string' ||
        Number.isNaN(Date.parse(session.createdAt)) ||
        Number.isNaN(Date.parse(session.expiresAt))
      ) {
        return null;
      }
      return {
        refreshTokenHash: session.refreshTokenHash,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ip: typeof session.ip === 'string' ? session.ip : undefined,
        userAgent: typeof session.userAgent === 'string' ? session.userAgent : undefined,
      };
    } catch {
      return null;
    }
  }

  // ─── REDIS EXEC ASSERT ────────────────────────────────────────────────

  private assertRedisExec(result: [Error | null, unknown][] | null, context: string): void {
    if (!result) throw new Error(context);
    const error = result.find(([entryError]) => entryError)?.[0];
    if (error) throw error;
  }

  // ─── ERROR HELPERS ────────────────────────────────────────────────────

  private isDatabaseError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code
    );
  }

  private rethrowUnknown(error: unknown): never {
    if (error instanceof Error) throw error;
    throw new Error('Unknown database error');
  }

  private logError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : this.stringifyUnknown(error);
    this.logger.error(`${context}: ${message}`);
  }

  private stringifyUnknown(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    try {
      return JSON.stringify(value);
    } catch {
      return 'Unknown error';
    }
  }

  // ─── DURATION PARSER ──────────────────────────────────────────────────

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());
    if (!match) throw new Error(`Invalid duration format: ${value}`);
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
    if (!unit || !(unit in multipliers)) {
      throw new Error(`Unsupported duration unit: ${unit ?? 'unknown'}`);
    }
    return amount * multipliers[unit as keyof typeof multipliers];
  }
}
