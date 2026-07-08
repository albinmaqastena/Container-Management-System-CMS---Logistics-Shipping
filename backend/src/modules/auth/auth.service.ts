// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { randomBytes } from 'crypto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  // ------------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------------
  async login(
    loginDto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
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
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.',
      );
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      user.incrementFailedAttempts();
      await this.userRepository.save(user);

      if (user.failedLoginAttempts >= 5) {
        user.lockAccount(15 * 60 * 1000);
        await this.userRepository.save(user);
        throw new UnauthorizedException(
          'Too many failed attempts. Account locked for 15 minutes.',
        );
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

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    const sessionKey = `session:${user.id}:${Date.now()}`;
    await this.cacheManager.set(sessionKey, accessToken, 604800);

    const { password: _, ...userWithoutPassword } = user;

    return new AuthResponseDto(accessToken, userWithoutPassword, refreshToken);
  }

  // ------------------------------------------------------------------
  // REFRESH ACCESS TOKEN
  // ------------------------------------------------------------------
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

    const newAccessToken = this.generateAccessToken(storedToken.user);
    const newRefreshToken = await this.generateRefreshToken(storedToken.user);

    storedToken.isActive = false;
    storedToken.revokedAt = new Date();
    storedToken.revokedReason = 'rotated';
    await this.refreshTokenRepository.save(storedToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ------------------------------------------------------------------
  // LOGOUT
  // ------------------------------------------------------------------
  async logout(userId: string, refreshToken: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, userId, isActive: true },
    });

    if (token) {
      token.isActive = false;
      token.revokedAt = new Date();
      token.revokedReason = 'logout';
      await this.refreshTokenRepository.save(token);

      try {
        const cacheStore = (this.cacheManager as any).store;
        if (cacheStore && typeof cacheStore.keys === 'function') {
          const keys = await cacheStore.keys(`session:${userId}:*`);
          for (const key of keys) {
            await this.cacheManager.del(key);
          }
        }
      } catch (error) {
        console.error('Error clearing cache sessions:', error);
      }
    }
  }

  // ------------------------------------------------------------------
  // REGISTER
  // ------------------------------------------------------------------
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
        role = registerDto.role === UserRole.SUPER_ADMIN
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

    return this.userRepository.save(user);
  }

  // ------------------------------------------------------------------
  // CHANGE PASSWORD
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // FORGOT & RESET PASSWORD
  // ------------------------------------------------------------------
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

    console.log(`🔑 Reset token for ${email}: ${token}`);

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

  // ------------------------------------------------------------------
  // SESSIONS
  // ------------------------------------------------------------------
  async getUserSessions(userId: string): Promise<string[]> {
    const sessions: string[] = [];
    try {
      const cacheStore = (this.cacheManager as any).store;
      if (cacheStore && typeof cacheStore.keys === 'function') {
        const keys = await cacheStore.keys(`session:${userId}:*`);
        for (const key of keys) {
          const token = await this.cacheManager.get(key);
          if (token) sessions.push(token as string);
        }
      }
    } catch (error) {
      console.error('Error getting user sessions:', error);
    }
    return sessions; // ✅ return i shtuar
  }

  async getUserSessionsDetailed(userId: string): Promise<any[]> {
    const sessions: any[] = [];
    try {
      const cacheStore = (this.cacheManager as any).store;
      if (cacheStore && typeof cacheStore.keys === 'function') {
        const keys = await cacheStore.keys(`session:${userId}:*`);
        for (const key of keys) {
          const token = await this.cacheManager.get(key);
          if (token) {
            sessions.push({
              id: key.split(':').pop(),
              token: token,
              createdAt: new Date(parseInt(key.split(':')[2])),
              expiresAt: new Date(Date.now() + 604800000),
              isActive: true,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting user sessions:', error);
    }
    return sessions; // ✅ return i shtuar
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    const exists = await this.cacheManager.get(key);
    if (!exists) {
      throw new NotFoundException('Session not found');
    }
    await this.cacheManager.del(key);
  }

  // ------------------------------------------------------------------
  // VALIDATE USER
  // ------------------------------------------------------------------
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

    return user; // ✅ tani `user` nuk është `null`
  }

  // ------------------------------------------------------------------
  // SOFT DELETE FOR USERS
  // ------------------------------------------------------------------
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

    const restored = await this.userRepository.findOne({ where: { id: userId } });
    if (!restored) {
      throw new NotFoundException('User not found after restore');
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

    await this.userRepository.remove(user);

    await this.refreshTokenRepository.update(
      { userId },
      { isActive: false, revokedAt: new Date(), revokedReason: 'user_permanently_deleted' },
    );
  }

  async findDeletedUsers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Partial<User>>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.users);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`user.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    // ✅ Sanitizo të dhënat
    const sanitizedData = data.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;
      return safeUser;
    });

    return new PaginatedResponseDto<Partial<User>>(sanitizedData, total, limit, offset);
  }

  // ------------------------------------------------------------------
  // PRIVATE HELPERS
  // ------------------------------------------------------------------
  private generateAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('auth.jwt.secret'),
      expiresIn: this.configService.get('auth.jwt.accessTokenExpiresIn'),
    });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = new RefreshToken({
      token,
      userId: user.id,
      user,
      expiresAt,
      isActive: true,
    });

    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    try {
      const cacheStore = (this.cacheManager as any).store;
      if (cacheStore && typeof cacheStore.keys === 'function') {
        const keys = await cacheStore.keys(`session:${userId}:*`);
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
    } catch (error) {
      console.error('Error invalidating sessions:', error);
    }
  }
}