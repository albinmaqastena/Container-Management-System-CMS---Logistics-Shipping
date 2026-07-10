// src/modules/auth/auth.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';

import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionDto } from './dto/session.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User, UserRole } from './entities/user.entity';

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import {
  PaginatedResponseDto,
  PaginationDto,
} from '../../common/dto/pagination.dto';

const AUTH_THROTTLE_LIMIT =
  process.env.NODE_ENV === 'test' ? 100000 : 5;

const AUTH_THROTTLE_TTL =
  process.env.NODE_ENV === 'test' ? 1000 : 60000;

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(
    AuthController.name,
  );

  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  @Public()
  @Throttle({
    default: {
      limit: AUTH_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or account unavailable',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
  ): Promise<AuthResponseDto> {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    const ip =
      forwardedIp ||
      req.ip ||
      req.socket?.remoteAddress ||
      '0.0.0.0';

    const userAgent =
      req.headers['user-agent'] || 'unknown';

    this.logger.debug(
      `Login attempt from IP: ${ip}`,
    );

    return this.authService.login(
      loginDto,
      ip,
      userAgent,
    );
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @Throttle({
    default: {
      limit: AUTH_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL,
    },
  })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a new user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Partial<User>> {
    return this.authService.register(
      registerDto,
      req.user,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from the current session',
  })
  @ApiBody({
    type: RefreshTokenDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
  })
  async logout(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RefreshTokenDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(
      req.user.id,
      dto.refreshToken,
    );

    return {
      message: 'Logged out successfully',
    };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from all devices',
  })
  async logoutAll(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.authService.logoutAll(
      req.user.id,
    );

    return {
      message: 'Logged out from all devices',
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access and refresh tokens',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.refreshAccessToken(
      dto.refreshToken,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change the current user password',
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );

    return {
      message: 'Password changed successfully',
    };
  }

  @Post('forgot-password')
  @Public()
  @Throttle({
    default: {
      limit: AUTH_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(
      dto.email,
    );
  }

  @Post('reset-password')
  @Public()
  @Throttle({
    default: {
      limit: AUTH_THROTTLE_LIMIT,
      ttl: AUTH_THROTTLE_TTL,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using a reset token',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      dto.token,
      dto.newPassword,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UserResponseDto,
  })
  async getProfile(
    @Request() req: AuthenticatedRequest,
  ): Promise<Partial<User>> {
    return this.authService.getProfile(
      req.user.id,
    );
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active sessions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [SessionDto],
  })
  async getSessions(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ sessions: SessionDto[] }> {
    const sessions =
      await this.authService.getUserSessionsDetailed(
        req.user.id,
      );

    return { sessions };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke a specific session',
  })
  async revokeSession(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId', UUIDValidationPipe)
    sessionId: string,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(
      req.user.id,
      sessionId,
    );

    return {
      message: 'Session revoked successfully',
    };
  }

  @Get('users/deleted')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get soft-deleted users',
  })
  async getDeletedUsers(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<
    PaginatedResponseDto<Partial<User>>
  > {
    return this.authService.findDeletedUsers(
      this.createPaginationDto(query),
    );
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete a user',
  })
  async softDeleteUser(
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    await this.authService.softDeleteUser(id);
  }

  @Put('users/:id/restore')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Restore a soft-deleted user',
  })
  async restoreUser(
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<User> {
    return this.authService.restoreUser(id);
  }

  @Delete('users/:id/permanent')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete a user',
  })
  async permanentDeleteUser(
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    await this.authService.permanentDeleteUser(
      id,
    );
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a user by ID',
  })
  @ApiQuery({
    name: 'includeDeleted',
    type: Boolean,
    required: false,
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UserResponseDto,
  })
  async getUserById(
    @Param('id', UUIDValidationPipe) id: string,
    @Query(
      'includeDeleted',
      new ParseBoolPipe({ optional: true }),
    )
    includeDeleted?: boolean,
  ): Promise<Partial<User>> {
    return this.authService.findUserById(
      id,
      includeDeleted ?? false,
    );
  }

  private createPaginationDto(
    query: PaginationDto,
  ): PaginationDto {
    const limit = Number(query.limit);
    const offset = Number(query.offset);

    const paginationDto =
      new PaginationDto();

    paginationDto.limit =
      Number.isInteger(limit) && limit > 0
        ? limit
        : 10;

    paginationDto.offset =
      Number.isInteger(offset) && offset >= 0
        ? offset
        : 0;

    paginationDto.sort =
      query.sort || undefined;

    return paginationDto;
  }
}