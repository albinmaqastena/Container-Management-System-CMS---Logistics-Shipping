// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, User } from './entities/user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ================================================================
  // AUTHENTICATION ENDPOINTS
  // ================================================================

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const ip = req.ip ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.toString().split(',')[0] ||
               '0.0.0.0';

    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log('📝 Login - IP:', ip);
    console.log('📝 Login - UserAgent:', userAgent);

    return this.authService.login(loginDto, ip, userAgent);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto, @Request() req): Promise<User> {
    return this.authService.register(registerDto, req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req): Promise<{ message: string }> {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('No token provided');
    }
    await this.authService.logout(req.user.id, token);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or incorrect password' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset link sent' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  // ================================================================
  // PROFILE & SESSIONS
  // ================================================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: User,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req): Promise<Partial<User>> {
    const user = req.user;
    const { password, resetPasswordToken, resetPasswordExpires, ...profile } = user;
    return profile;
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getSessions(@Request() req): Promise<{ sessions: string[] }> {
    const sessions = await this.authService.getUserSessions(req.user.id);
    return { sessions };
  }

  @Get('sessions/detailed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getSessionsDetailed(@Request() req): Promise<{ sessions: any[] }> {
    const sessions = await this.authService.getUserSessionsDetailed(req.user.id);
    return { sessions };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(req.user.id, sessionId);
    return { message: 'Session revoked successfully' };
  }

  // ================================================================
  // ✅ SOFT DELETE FOR USERS (Only SUPER_ADMIN)
  // ================================================================

  @Get('users/deleted')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted users (Super Admin only)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'deletedAt:DESC' })
  @ApiResponse({ status: 200, description: 'Deleted users retrieved', type: PaginatedResponseDto })
  async getDeletedUsers(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Partial<User>>> {
    return this.authService.findDeletedUsers(paginationDto);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a user (Super Admin only)' })
  @ApiResponse({ status: 204, description: 'User soft deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete Super Admin' })
  async softDeleteUser(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.authService.softDeleteUser(id);
  }

  @Put('users/:id/restore')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore a soft-deleted user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'User restored', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'User is not deleted' })
  async restoreUser(@Param('id', UUIDValidationPipe) id: string): Promise<User> {
    return this.authService.restoreUser(id);
  }

  @Delete('users/:id/permanent')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Permanently delete a user (Super Admin only)' })
  @ApiResponse({ status: 204, description: 'User permanently deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete Super Admin' })
  async permanentDeleteUser(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
    await this.authService.permanentDeleteUser(id);
  }
}