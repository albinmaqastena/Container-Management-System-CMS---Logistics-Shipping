// src/modules/audit/audit.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    action: AuditAction,
    userId?: string,
    targetId?: string,
    targetType?: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>,
    status: AuditStatus = AuditStatus.SUCCESS,
    errorMessage?: string,
  ): Promise<AuditLog> {
    const log = new AuditLog({
      action,
      userId,
      targetId,
      targetType,
      changes,
      metadata,
      status,
      errorMessage,
    });

    return this.auditLogRepository.save(log);
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      userId?: string;
      action?: AuditAction;
      status?: AuditStatus;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<PaginatedResponseDto<AuditLog>> {
    const limit = paginationDto.limit || 10;
    const offset = paginationDto.offset || 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    if (filters?.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      queryBuilder.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters?.status) {
      queryBuilder.andWhere('audit.status = :status', { status: filters.status });
    }

    if (filters?.fromDate) {
      queryBuilder.andWhere('audit.createdAt >= :fromDate', { fromDate: filters.fromDate });
    }

    if (filters?.toDate) {
      queryBuilder.andWhere('audit.createdAt <= :toDate', { toDate: filters.toDate });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.audit);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`audit.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    return log;
  }

  async findByUser(userId: string, paginationDto: PaginationDto): Promise<PaginatedResponseDto<AuditLog>> {
    return this.findAll(paginationDto, { userId });
  }

  async findByAction(action: AuditAction, paginationDto: PaginationDto): Promise<PaginatedResponseDto<AuditLog>> {
    return this.findAll(paginationDto, { action });
  }

  async getStats(): Promise<{
    total: number;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
    last24h: number;
    last7d: number;
  }> {
    const total = await this.auditLogRepository.count();
    
    const byActionRaw = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit.action')
      .getRawMany();

    const byAction: Record<string, number> = {};
    byActionRaw.forEach((item) => {
      byAction[item.action] = parseInt(item.count, 10);
    });

    const byStatusRaw = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    byStatusRaw.forEach((item) => {
      byStatus[item.status] = parseInt(item.count, 10);
    });

    const last24h = await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt >= NOW() - INTERVAL \'24 hours\'')
      .getCount();

    const last7d = await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt >= NOW() - INTERVAL \'7 days\'')
      .getCount();

    return {
      total,
      byAction,
      byStatus,
      last24h,
      last7d,
    };
  }

  async cleanup(olderThanDays: number = 90): Promise<number> {
    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < NOW() - INTERVAL :days DAY', { days: olderThanDays })
      .execute();

    return result.affected || 0;
  }
}