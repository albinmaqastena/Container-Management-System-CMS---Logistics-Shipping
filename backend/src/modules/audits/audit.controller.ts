// src/modules/audits/audit.controller.ts

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuditService } from './audit.service';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditCleanupQueryDto } from './dto/audit-cleanup-query.dto';
import { AuditCleanupResponseDto } from './dto/audit-cleanup-response.dto';
import { AuditStatsResponseDto } from './dto/audit-stats-response.dto';
import { PaginatedAuditLogsResponseDto } from './dto/paginated-audit-logs-response.dto';
import { SkipAudit } from './decorators/audit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';

const AUDIT_QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all audit logs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedAuditLogsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async findAll(
    @Query(AUDIT_QUERY_PIPE)
    query: AuditQueryDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const result = await this.auditService.findAll(this.createPaginationDto(query), {
      userId: query.userId,
      action: query.action,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    return new PaginatedAuditLogsResponseDto(
      result.data,
      result.total,
      result.limit,
      result.offset,
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get audit statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuditStatsResponseDto,
    description: 'Audit statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async getStats(): Promise<AuditStatsResponseDto> {
    return new AuditStatsResponseDto(await this.auditService.getStats());
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get audit logs by user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedAuditLogsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid user ID or pagination query',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async findByUser(
    @Param('userId', UUIDValidationPipe)
    userId: string,
    @Query(AUDIT_QUERY_PIPE)
    query: PaginationDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const result = await this.auditService.findByUser(userId, this.createPaginationDto(query));

    return new PaginatedAuditLogsResponseDto(
      result.data,
      result.total,
      result.limit,
      result.offset,
    );
  }

  @Get('actions/:action')
  @ApiOperation({
    summary: 'Get audit logs by action',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedAuditLogsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid audit action or pagination query',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async findByAction(
    @Param(
      'action',
      new ParseEnumPipe(AuditAction, {
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    action: AuditAction,
    @Query(AUDIT_QUERY_PIPE)
    query: PaginationDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const result = await this.auditService.findByAction(action, this.createPaginationDto(query));

    return new PaginatedAuditLogsResponseDto(
      result.data,
      result.total,
      result.limit,
      result.offset,
    );
  }

  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  @SkipAudit()
  @ApiOperation({
    summary: 'Clean up old audit logs',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuditCleanupResponseDto,
    description: 'Audit logs cleaned up successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid retention period',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async cleanup(
    @Query(AUDIT_QUERY_PIPE)
    query: AuditCleanupQueryDto,
  ): Promise<AuditCleanupResponseDto> {
    const daysToKeep = query.days ?? 90;
    const deleted = await this.auditService.cleanup(daysToKeep);

    return new AuditCleanupResponseDto({
      deleted,
      message: `Deleted ${deleted} audit logs older than ${daysToKeep} days`,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get audit log by ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AuditLog,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid audit log ID',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Audit log not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Super Admin access required',
  })
  async findOne(
    @Param('id', UUIDValidationPipe)
    id: string,
  ): Promise<AuditLog> {
    return this.auditService.findOne(id);
  }

  private createPaginationDto(query: PaginationDto): PaginationDto {
    const paginationDto = new PaginationDto();
    paginationDto.limit = query.limit ?? 10;
    paginationDto.offset = query.offset ?? 0;
    paginationDto.sort = query.sort;
    return paginationDto;
  }
}
