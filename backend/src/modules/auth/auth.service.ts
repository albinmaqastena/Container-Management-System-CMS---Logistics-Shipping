// src/modules/auth/auth.service.ts (versioni i plotë me të gjitha ndryshimet)
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import type { StringValue } from 'ms';

import { User, UserRole } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SessionDto } from './dto/session.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionTtl: number;
  private readonly maxSessions: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    this.sessionTtl = this.parseDurationToSeconds(
      this.configService.get<string>('auth.jwt.refreshTokenExpiresIn', '7d'),
    );

    this.maxSessions = this.configService.get<number>('AUTH_MAX_SESSIONS', 10);
  }

  // ================================================================
  // LOGIN
  // ================================================================
  async login(loginDto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
      withDeleted: true,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    if (user.isLocked()) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      user.incrementFailedAttempts();
      await this.userRepository.save(user);

      const maxAttempts = this.configService.get<number>('auth.rateLimit.loginAttempts', 5);

      if (user.failedLoginAttempts >= maxAttempts) {
        user.lockAccount(
          this.configService.get<number>('auth.rateLimit.blockDuration', 15 * 60 * 1000),
        );
        await this.userRepository.save(user);
        throw new UnauthorizedException('Too many failed attempts. Account locked for 15 minutes.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    user.resetFailedAttempts();
    user.lastLogin = new Date();
    user.lastLoginIp = ip || 'unknown';
    user.lastLoginUserAgent = userAgent || 'unknown';
    await this.userRepository.save(user);

    const sessionId = uuidv4();
    const sessionKey = `session:${user.id}:${sessionId}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtl * 1000);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, ip, userAgent, sessionId);

    // ✅ Kontrollo dhe kufizo session-et
    await this.enforceSessionLimit(user.id);

    await this.redis.set(
      sessionKey,
      JSON.stringify({
        accessToken,
        refreshToken,
        userAgent: userAgent || 'unknown',
        ip: ip || 'unknown',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }),
      'EX',
      this.sessionTtl,
    );

    return new AuthResponseDto(accessToken, this.sanitizeUser(user), refreshToken);
  }

  // ================================================================
  // REFRESH ACCESS TOKEN
  // ================================================================
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isActive: true },
      relations: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // ✅ Merr session-id dhe metadata nga Redis
    let ip: string | undefined;
    let userAgent: string | undefined;
    let sessionId: string | undefined;

    try {
      const keys = await this.scanKeys(`session:${storedToken.user.id}:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.refreshToken === refreshToken) {
            ip = session.ip;
            userAgent = session.userAgent;
            sessionId = key.split(':')[2];
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error retrieving session for refresh:', error);
    }

    if (!sessionId) {
      throw new UnauthorizedException('Session not found for this refresh token');
    }

    const newAccessToken = this.generateAccessToken(storedToken.user);
    const newRefreshToken = await this.generateRefreshToken(
      storedToken.user,
      ip,
      userAgent,
      sessionId,
    );

    // ✅ Përditëso session-in në Redis
    try {
      const keys = await this.scanKeys(`session:${storedToken.user.id}:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.refreshToken === refreshToken) {
            session.accessToken = newAccessToken;
            session.refreshToken = newRefreshToken;
            await this.redis.set(key, JSON.stringify(session), 'EX', this.sessionTtl);
            this.logger.debug(`Session updated with new refresh token`);
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error updating Redis session during refresh:', error);
    }

    // ✅ Revoko refresh token-in e vjetër
    storedToken.isActive = false;
    storedToken.revokedAt = new Date();
    storedToken.revokedReason = 'rotated';
    await this.refreshTokenRepository.save(storedToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ================================================================
  // LOGOUT – vetëm session-in aktual
  // ================================================================
  async logout(userId: string, refreshToken: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, userId, isActive: true },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    token.isActive = false;
    token.revokedAt = new Date();
    token.revokedReason = 'logout';
    await this.refreshTokenRepository.save(token);

    try {
      const keys = await this.scanKeys(`session:${userId}:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.refreshToken === refreshToken) {
            await this.redis.del(key);
            this.logger.debug(`Session deleted for user ${userId}`);
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error clearing Redis session during logout:', error);
    }
  }

  // ================================================================
  // LOGOUT ALL
  // ================================================================
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'logout_all',
      },
    );

    await this.invalidateAllSessions(userId);
    this.logger.debug(`All sessions and refresh tokens revoked for user ${userId}`);
  }

  // ================================================================
  // REGISTER
  // ================================================================
  async register(registerDto: RegisterDto, currentUser?: User): Promise<User> {
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

    if (!currentUser) {
      const userCount = await this.userRepository.count();
      if (userCount === 0) {
        role = UserRole.SUPER_ADMIN;
      }
    } else {
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
    }

    const user = new User({
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
      role,
    });

    const savedUser = await this.userRepository.save(user);

    return this.sanitizeUser(savedUser) as unknown as User;
  }

  // ================================================================
  // CHANGE PASSWORD
  // ================================================================
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.password = newPassword;
    user.resetFailedAttempts();
    await this.userRepository.save(user);

    await this.invalidateAllSessions(userId);
  }

  // ================================================================
  // FORGOT & RESET PASSWORD
  // ================================================================
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email },
      withDeleted: true,
    });

    if (!user || user.deletedAt) {
      return { message: 'If this email exists, a reset link has been sent' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresInMs = 3600000;

    user.setResetToken(token, expiresInMs);
    await this.userRepository.save(user);

    this.logger.log(`Password reset requested`);

    return { message: 'If this email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: token },
      withDeleted: true,
    });

    if (!user || !user.isResetTokenValid(token) || user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.clearResetToken();
    user.resetFailedAttempts();
    await this.userRepository.save(user);

    await this.invalidateAllSessions(user.id);

    return { message: 'Password reset successfully' };
  }

  // ================================================================
  // SESSIONS
  // ================================================================
  async getUserSessions(userId: string): Promise<string[]> {
    const sessions: string[] = [];
    try {
      const keys = await this.scanKeys(`session:${userId}:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data);
          sessions.push(session.accessToken);
        }
      }
    } catch (error) {
      this.logger.error('Error fetching sessions:', error);
    }
    return sessions;
  }

  async getUserSessionsDetailed(userId: string): Promise<SessionDto[]> {
    const sessions: SessionDto[] = [];
    try {
      const keys = await this.scanKeys(`session:${userId}:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const session = JSON.parse(data);
          sessions.push({
            userId: userId,
            id: key.split(':')[2],
            createdAt: new Date(session.createdAt),
            expiresAt: new Date(session.expiresAt),
            ip: session.ip,
            userAgent: session.userAgent,
            isActive: true,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error fetching detailed sessions:', error);
    }
    return sessions;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      throw new NotFoundException('Session not found');
    }

    const session = JSON.parse(data);

    await this.refreshTokenRepository.update(
      { token: session.refreshToken },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'session_revoked',
      },
    );

    await this.redis.del(key);
    this.logger.debug(`Session ${sessionId} revoked for user ${userId}`);
  }

  // ================================================================
  // VALIDATE USER
  // ================================================================
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return user;
  }

  // ================================================================
  // PROFILE
  // ================================================================
  async getProfile(userId: string): Promise<UserResponseDto> {
    return this.findUserById(userId, false);
  }

  async findUserById(id: string, includeDeleted = false): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ================================================================
  // SOFT DELETE USERS
  // ================================================================
  async softDeleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('User is already deleted');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot delete Super Admin user');
    }

    await this.userRepository.softDelete(userId);

    await this.invalidateAllSessions(userId);

    await this.refreshTokenRepository.update(
      { userId, isActive: true },
      { isActive: false, revokedAt: new Date(), revokedReason: 'user_deleted' },
    );
  }

  async restoreUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.deletedAt) {
      throw new BadRequestException('User is not deleted');
    }

    await this.userRepository.restore(userId);

    const restored = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!restored) {
      throw new NotFoundException('User not found after restore');
    }

    if (!restored.isActive) {
      restored.isActive = true;
      await this.userRepository.save(restored);
    }

    return restored;
  }

  async permanentDeleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot delete Super Admin user');
    }

    await this.invalidateAllSessions(userId);

    await this.userRepository.remove(user);

    await this.refreshTokenRepository.update(
      { userId },
      { isActive: false, revokedAt: new Date(), revokedReason: 'user_permanently_deleted' },
    );
  }

  async findDeletedUsers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.users);

    if (Object.keys(sortObject).length > 0) {
      Object.entries(sortObject).forEach(([field, direction]) => {
        queryBuilder.addOrderBy(`user.${field}`, direction);
      });
    } else {
      queryBuilder.orderBy('user.deletedAt', 'DESC');
    }

    queryBuilder.skip(offset).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    const sanitizedUsers = users.map((user) => this.sanitizeUser(user));

    return new PaginatedResponseDto<UserResponseDto>(sanitizedUsers, total, limit, offset);
  }

  // ================================================================
  // PRIVATE HELPERS
  // ================================================================

  private sanitizeUser(user: User): UserResponseDto {
    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      failedLoginAttempts,
      lockedUntil,
      ...safeUser
    } = user;

    return safeUser;
  }

  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.getOrThrow<StringValue>('auth.jwt.accessTokenExpiresIn'),
    });
  }

  private async generateRefreshToken(
    user: User,
    ip?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + this.sessionTtl * 1000);

    const refreshToken = new RefreshToken({
      token,
      userId: user.id,
      user,
      expiresAt,
      isActive: true,
      ip,
      userAgent,
      sessionId,
    });

    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    try {
      const keys = await this.scanKeys(`session:${userId}:*`);
      if (keys.length >= this.maxSessions) {
        const oldestKey = keys[0];
        await this.redis.del(oldestKey);
        this.logger.debug(`Removed oldest session for user ${userId} (limit: ${this.maxSessions})`);
      }
    } catch (error) {
      this.logger.warn('Could not enforce session limit:', error);
    }
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    try {
      const keys = await this.scanKeys(`session:${userId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} sessions for user ${userId}`);
      }
    } catch (error) {
      this.logger.error('Error invalidating sessions with Redis:', error);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }
  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());

    if (!match) {
      throw new Error(`Invalid duration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multiplier: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return amount * multiplier[unit];
  }
}
