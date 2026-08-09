import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';

import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL } from './auth-throttle.constants';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionsResponseDto } from './dto/sessions-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './entities/user.entity';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-request.interface';

const queryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiOkResponse({ description: 'Login successful', type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or account unavailable' })
  @ApiServiceUnavailableResponse({ description: 'Authentication session could not be created' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
  ): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.login(loginDto, ip, userAgent);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User created successfully', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiConflictResponse({ description: 'User already exists' })
  @ApiBadRequestResponse({ description: 'Invalid registration data' })
  async register(
    @Body() registerDto: RegisterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.authService.register(registerDto, user);
  }

  @Post('logout')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from the current session' })
  @ApiOkResponse({ description: 'Logged out successfully', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.authService.logout(user.id, user.sid);
    return new MessageResponseDto('Logged out successfully');
  }

  @Post('logout-all')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiOkResponse({ description: 'Logged out from all devices', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto> {
    await this.authService.logoutAll(user.id);
    return new MessageResponseDto('Logged out from all devices');
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiOkResponse({ description: 'Tokens refreshed successfully', type: RefreshResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  @ApiServiceUnavailableResponse({ description: 'Token rotation could not be completed' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('change-password')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiOkResponse({ description: 'Password changed successfully', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiBadRequestResponse({
    description: 'New password must be different from the current password',
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return new MessageResponseDto('Password changed successfully');
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiServiceUnavailableResponse({
    description: 'Password reset email service is temporarily unavailable',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  @ApiBadRequestResponse({ description: 'Invalid password or token format' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.authService.getProfile(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiOkResponse({ type: SessionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  async getSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionsResponseDto> {
    const sessions = await this.authService.getUserSessionsDetailed(user.id, user.sid);
    return new SessionsResponseDto(sessions);
  }

  @Delete('sessions/:sessionId')
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiBadRequestResponse({ description: 'Invalid session data' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', UUIDValidationPipe) sessionId: string,
  ): Promise<MessageResponseDto> {
    await this.authService.revokeSession(user.id, sessionId);
    return new MessageResponseDto('Session revoked successfully');
  }

  @Get('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiOperation({ summary: 'Get users' })
@ApiOkResponse({ type: PaginatedUsersResponseDto })
async getUsers(
  @Query(queryValidationPipe) query: PaginationDto,
): Promise<PaginatedUsersResponseDto> {
  const result = await this.authService.findUsers(query);

  return new PaginatedUsersResponseDto(
    result.data,
    result.total,
    result.limit,
    result.offset,
  );
}

  @Get('users/deleted')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get soft-deleted users' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getDeletedUsers(
    @Query(queryValidationPipe) query: PaginationDto,
  ): Promise<PaginatedUsersResponseDto> {
    const result = await this.authService.findDeletedUsers(query);
    return new PaginatedUsersResponseDto(result.data, result.total, result.limit, result.offset);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiNoContentResponse({ description: 'User soft-deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({
    description: 'Cannot delete own account, deleted user, or protected Super Admin',
  })
  async softDeleteUser(
    @Param('id', UUIDValidationPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.authService.softDeleteUser(id, user.id);
  }

  @Put('users/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'User is not deleted' })
  async restoreUser(@Param('id', UUIDValidationPipe) id: string): Promise<UserResponseDto> {
    return this.authService.restoreUser(id);
  }

  @Delete('users/:id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a user' })
  @ApiNoContentResponse({ description: 'User permanently deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({
    description:
      'User must be soft-deleted first, cannot delete own account, or protected Super Admin',
  })
  async permanentDeleteUser(
    @Param('id', UUIDValidationPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.authService.permanentDeleteUser(id, user.id);
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false, example: false })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserById(
    @Param('id', UUIDValidationPipe) id: string,
    @Query('includeDeleted', new ParseBoolPipe({ optional: true })) includeDeleted?: boolean,
  ): Promise<UserResponseDto> {
    return this.authService.findUserById(id, includeDeleted ?? false);
  }
}
