// src/modules/audit/audit.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';
import { SkipAudit } from './decorators/audit.decorator';

@ApiTags('Audit Logs')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs (Super Admin only)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiQuery({ name: 'userId', type: String, required: false })
  @ApiQuery({ name: 'action', enum: AuditAction, required: false })
  @ApiQuery({ name: 'status', enum: AuditStatus, required: false })
  @ApiQuery({ name: 'fromDate', type: String, required: false })
  @ApiQuery({ name: 'toDate', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved', type: PaginatedResponseDto })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('status') status?: AuditStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    // ✅ Validimi i datës
    let fromDateObj: Date | undefined;
    let toDateObj: Date | undefined;

    if (fromDate) {
      fromDateObj = new Date(fromDate);
      if (isNaN(fromDateObj.getTime())) {
        throw new BadRequestException('Invalid fromDate format');
      }
    }

    if (toDate) {
      toDateObj = new Date(toDate);
      if (isNaN(toDateObj.getTime())) {
        throw new BadRequestException('Invalid toDate format');
      }
    }

    return this.auditService.findAll(paginationDto, {
      userId,
      action,
      status,
      fromDate: fromDateObj,
      toDate: toDateObj,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit statistics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit statistics retrieved' })
  async getStats(): Promise<{
    total: number;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
    last24h: number;
    last7d: number;
  }> {
    return this.auditService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved', type: AuditLog })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findOne(@Param('id', UUIDValidationPipe) id: string): Promise<AuditLog> {
    return this.auditService.findOne(id);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get audit logs by user (Super Admin only)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved', type: PaginatedResponseDto })
  async findByUser(
    @Param('userId', UUIDValidationPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return this.auditService.findByUser(userId, paginationDto);
  }

  @Get('actions/:action')
  @ApiOperation({ summary: 'Get audit logs by action (Super Admin only)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'offset', type: Number, required: false, example: 0 })
  @ApiQuery({ name: 'sort', type: String, required: false, example: 'createdAt:DESC' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved', type: PaginatedResponseDto })
  async findByAction(
    @Param('action') action: AuditAction,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return this.auditService.findByAction(action, paginationDto);
  }

  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  @SkipAudit()
  @ApiOperation({ summary: 'Clean up old audit logs (Super Admin only)' })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 90 })
  @ApiResponse({ status: 200, description: 'Audit logs cleaned up' })
  async cleanup(@Query('days') days?: number): Promise<{ deleted: number; message: string }> {
    const daysToKeep = days || 90;
    const deleted = await this.auditService.cleanup(daysToKeep);
    return {
      deleted,
      message: `Deleted ${deleted} audit logs older than ${daysToKeep} days`,
    };
  }
}