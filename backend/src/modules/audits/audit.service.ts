// src/modules/audits/audit.service.ts

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  byAction: Partial<Record<AuditAction, number>>;
  byStatus: Partial<Record<AuditStatus, number>>;
  last24h: number;
  last7d: number;
}

// Constants for sanitization
const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'resetpasswordtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
]);

const MAX_AUDIT_PAYLOAD_BYTES = 32_000;

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private validateFilters(filters: AuditFilters): void {
    if (filters.fromDate && Number.isNaN(filters.fromDate.getTime())) {
      throw new BadRequestException('Invalid fromDate');
    }

    if (filters.toDate && Number.isNaN(filters.toDate.getTime())) {
      throw new BadRequestException('Invalid toDate');
    }

    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      throw new BadRequestException('fromDate must be earlier than or equal to toDate');
    }
  }

  /**
   * Sanitizes audit data by redacting sensitive keys, handling circular references,
   * special object types, and limiting total size.
   */
  private sanitizeAuditData(
    value: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    const visited = new WeakSet<object>();

    const sanitize = (input: unknown): unknown => {
      // Primitive values
      if (input === null || input === undefined || typeof input !== 'object') {
        return input;
      }

      // Circular reference detection
      if (visited.has(input)) {
        return '[CIRCULAR]';
      }

      // Handle special object types
      if (input instanceof Date) {
        return input.toISOString();
      }

      if (Buffer.isBuffer(input)) {
        return `[BUFFER:${input.length}_BYTES]`;
      }

      if (input instanceof Error) {
        return {
          name: input.name,
          message: input.message,
          // stack is omitted (may contain sensitive paths)
        };
      }

      if (input instanceof Map) {
        visited.add(input);

        const safeMap = input as Map<unknown, unknown>;
        const obj: Record<string, unknown> = {};

        for (const [key, value] of safeMap.entries()) {
          const stringKey =
            typeof key === 'string' ? key : (JSON.stringify(key) ?? '[UNKNOWN_KEY]');

          const normalizedKey = stringKey.replace(/[-_\s]/g, '').toLowerCase();

          obj[stringKey] = SENSITIVE_AUDIT_KEYS.has(normalizedKey) ? '[REDACTED]' : sanitize(value);
        }

        return obj;
      }

      if (input instanceof Set) {
        visited.add(input);

        const safeSet = input as Set<unknown>;

        return Array.from(safeSet.values(), (value: unknown) => sanitize(value));
      }

      if (input instanceof RegExp) {
        return `[REGEXP:${input.source}]`;
      }

      // Check if it's a plain object (not a custom class instance)
      const prototype: object | null = Reflect.getPrototypeOf(input);

      const isPlainObject = prototype === Object.prototype || prototype === null;

      if (!isPlainObject) {
        return '[NON_PLAIN_OBJECT]';
      }

      // Plain object
      visited.add(input);
      const obj = input as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, nestedValue] of Object.entries(obj)) {
        // Skip prototype-pollution keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        const normalizedKey = key.replace(/[-_\s]/g, '').toLowerCase();

        if (SENSITIVE_AUDIT_KEYS.has(normalizedKey)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(nestedValue);
        }
      }

      return result;
    };

    let sanitized: unknown;
    try {
      sanitized = sanitize(value);
    } catch {
      return { _sanitizationFailed: true };
    }

    // Ensure we have a plain object
    if (typeof sanitized !== 'object' || sanitized === null || Array.isArray(sanitized)) {
      return { _sanitizationFailed: true };
    }

    // Serialize to check size
    let serialized: string;
    try {
      serialized = JSON.stringify(sanitized);
    } catch {
      return { _serializationFailed: true };
    }

    const size = Buffer.byteLength(serialized, 'utf8');

    if (size > MAX_AUDIT_PAYLOAD_BYTES) {
      return {
        _truncated: true,
        _originalSizeBytes: size,
        _maxSizeBytes: MAX_AUDIT_PAYLOAD_BYTES,
      };
    }

    return sanitized as Record<string, unknown>;
  }

  /**
   * Explicitly sanitizes metadata according to known schema.
   * Validates numeric fields and truncates string fields.
   * Only includes fields that are valid and present.
   */
  private sanitizeMetadata(metadata?: AuditMetadata): AuditMetadata | null {
    if (!metadata) {
      return null;
    }

    const result: AuditMetadata = {};

    const ip = metadata.ip?.trim().slice(0, 45);
    if (ip) {
      result.ip = ip;
    }

    const userAgent = metadata.userAgent?.trim().slice(0, 500);
    if (userAgent) {
      result.userAgent = userAgent;
    }

    const method = metadata.method?.trim().toUpperCase().slice(0, 20);
    if (method) {
      result.method = method;
    }

    const url = metadata.url?.trim().slice(0, 2000);
    if (url) {
      result.url = url;
    }

    if (
      Number.isInteger(metadata.statusCode) &&
      metadata.statusCode! >= 100 &&
      metadata.statusCode! <= 599
    ) {
      result.statusCode = metadata.statusCode;
    }

    if (Number.isFinite(metadata.duration) && metadata.duration! >= 0) {
      result.duration = metadata.duration;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

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
      targetType: targetType?.trim().slice(0, 100) || null,
      changes: this.sanitizeAuditData(changes),
      metadata: this.sanitizeMetadata(metadata),
      status,
      errorMessage: errorMessage?.trim().slice(0, 5000) || null,
    });

    return this.auditLogRepository.save(log);
  }

  async findAll(
    paginationDto: PaginationDto,
    filters: AuditFilters = {},
  ): Promise<PaginatedResponseDto<AuditLog>> {
    this.validateFilters(filters);

    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;

    const qb = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoin('audit.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.email', 'user.role', 'user.isActive']);

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

    // Apply sorting
    sortEntries.forEach(([key, direction], index) => {
      const field = `audit.${key}`;
      if (index === 0) {
        qb.orderBy(field, direction);
      } else {
        qb.addOrderBy(field, direction);
      }
    });

    // Tie-breaker: ensure deterministic order by adding ID with the same direction as the primary sort
    if (!sortEntries.some(([key]) => key === 'id')) {
      const primaryDirection = sortEntries[0]?.[1] ?? 'DESC';
      qb.addOrderBy('audit.id', primaryDirection);
    }

    qb.skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoin('audit.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.email', 'user.role', 'user.isActive'])
      .where('audit.id = :id', { id })
      .getOne();

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
        .getRawMany<{ action: string; count: string }>(),

      this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.status')
        .getRawMany<{ status: string; count: string }>(),

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

    // Filter only known actions/statuses
    const validActions = new Set(Object.values(AuditAction));
    const validStatuses = new Set(Object.values(AuditStatus));

    const byAction = Object.fromEntries(
      byActionRaw
        .filter(({ action }) => validActions.has(action as AuditAction))
        .map(({ action, count }) => [action, Number.parseInt(count, 10) || 0]),
    ) as Partial<Record<AuditAction, number>>;

    const byStatus = Object.fromEntries(
      byStatusRaw
        .filter(({ status }) => validStatuses.has(status as AuditStatus))
        .map(({ status, count }) => [status, Number.parseInt(count, 10) || 0]),
    ) as Partial<Record<AuditStatus, number>>;

    return {
      total,
      byAction,
      byStatus,
      last24h,
      last7d,
    };
  }

  async cleanup(olderThanDays = 90): Promise<number> {
    if (!Number.isInteger(olderThanDays) || olderThanDays < 1) {
      throw new BadRequestException('Retention period must be a positive integer');
    }

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }
}
