// src/modules/audits/audit.controller.ts

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuditService, AuditStats } from './audit.service';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditCleanupQueryDto } from './dto/audit-cleanup-query.dto';
import { SkipAudit } from './decorators/audit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { UUIDValidationPipe } from '../../common/pipes/uuid-validation.pipe';

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
    type: PaginatedResponseDto,
  })
  async findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: AuditQueryDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    return this.auditService.findAll(this.createPaginationDto(query), {
      userId: query.userId,
      action: query.action,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get audit statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit statistics retrieved successfully',
  })
  async getStats(): Promise<AuditStats> {
    return this.auditService.getStats();
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get audit logs by user',
  })
  async findByUser(
    @Param('userId', UUIDValidationPipe)
    userId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return this.auditService.findByUser(userId, this.createPaginationDto(query));
  }

  @Get('actions/:action')
  @ApiOperation({
    summary: 'Get audit logs by action',
  })
  async findByAction(
    @Param('action')
    action: AuditAction,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    if (!Object.values(AuditAction).includes(action)) {
      throw new BadRequestException('Invalid audit action');
    }

    return this.auditService.findByAction(action, this.createPaginationDto(query));
  }

  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  @SkipAudit()
  @ApiOperation({
    summary: 'Clean up old audit logs',
  })
  async cleanup(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: AuditCleanupQueryDto,
  ): Promise<{
    deleted: number;
    message: string;
  }> {
    const daysToKeep = query.days ?? 90;

    const deleted = await this.auditService.cleanup(daysToKeep);

    return {
      deleted,
      message: `Deleted ${deleted} audit logs older than ${daysToKeep} days`,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get audit log by ID',
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
