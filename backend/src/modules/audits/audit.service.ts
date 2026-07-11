// src/modules/audits/audit.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';

import { AuditAction, AuditLog, AuditMetadata, AuditStatus } from './entities/audit-log.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { ALLOWED_SORT_FIELDS, buildSortObject } from '../../common/utils/sort.utils';

export interface AuditFilters {
  userId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  last24h: number;
  last7d: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    action: AuditAction,
    userId?: string,
    targetId?: string,
    targetType?: string,
    changes?: Record<string, unknown>,
    metadata?: AuditMetadata,
    status: AuditStatus = AuditStatus.SUCCESS,
    errorMessage?: string,
  ): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      action,
      userId: userId ?? null,
      targetId: targetId ?? null,
      targetType: targetType ?? null,
      changes: changes ?? null,
      metadata: metadata ?? null,
      status,
      errorMessage: errorMessage?.slice(0, 5000) ?? null,
    });

    return this.auditLogRepository.save(log);
  }

  async findAll(
    paginationDto: PaginationDto,
    filters: AuditFilters = {},
  ): Promise<PaginatedResponseDto<AuditLog>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;

    const qb = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    if (filters.userId) {
      qb.andWhere('audit.userId = :userId', {
        userId: filters.userId,
      });
    }

    if (filters.action) {
      qb.andWhere('audit.action = :action', {
        action: filters.action,
      });
    }

    if (filters.status) {
      qb.andWhere('audit.status = :status', {
        status: filters.status,
      });
    }

    if (filters.fromDate && filters.toDate) {
      qb.andWhere('audit.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      });
    } else if (filters.fromDate) {
      qb.andWhere('audit.createdAt >= :fromDate', {
        fromDate: filters.fromDate,
      });
    } else if (filters.toDate) {
      qb.andWhere('audit.createdAt <= :toDate', {
        toDate: filters.toDate,
      });
    }

    const sortEntries = Object.entries(
      buildSortObject(paginationDto.sort, ALLOWED_SORT_FIELDS.audit),
    );

    sortEntries.forEach(([key, direction], index) => {
      const field = `audit.${key}`;

      if (index === 0) {
        qb.orderBy(field, direction);
      } else {
        qb.addOrderBy(field, direction);
      }
    });

    qb.skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    return log;
  }

  async findByUser(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return this.findAll(paginationDto, { userId });
  }

  async findByAction(
    action: AuditAction,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    return this.findAll(paginationDto, { action });
  }

  async getStats(): Promise<AuditStats> {
    const now = Date.now();

    const last24hDate = new Date(now - 24 * 60 * 60 * 1000);

    const last7dDate = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [total, byActionRaw, byStatusRaw, last24h, last7d] = await Promise.all([
      this.auditLogRepository.count(),

      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.action')
        .getRawMany<{
          action: string;
          count: string;
        }>(),

      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.status')
        .getRawMany<{
          status: string;
          count: string;
        }>(),

      this.auditLogRepository.count({
        where: {
          createdAt: MoreThanOrEqual(last24hDate),
        },
      }),

      this.auditLogRepository.count({
        where: {
          createdAt: MoreThanOrEqual(last7dDate),
        },
      }),
    ]);

    return {
      total,
      byAction: Object.fromEntries(byActionRaw.map(({ action, count }) => [action, Number(count)])),
      byStatus: Object.fromEntries(byStatusRaw.map(({ status, count }) => [status, Number(count)])),
      last24h,
      last7d,
    };
  }

  async cleanup(olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }
}
