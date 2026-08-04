// src/modules/audits/audit.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditAction, AuditLog, AuditStatus } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditCleanupQueryDto } from './dto/audit-cleanup-query.dto';
import { AuditCleanupResponseDto } from './dto/audit-cleanup-response.dto';
import { AuditStatsResponseDto } from './dto/audit-stats-response.dto';
import { PaginatedAuditLogsResponseDto } from './dto/paginated-audit-logs-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  const mockAuditLog: AuditLog = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    action: AuditAction.LOGIN,
    status: AuditStatus.SUCCESS,
    userId: '550e8400-e29b-41d4-a716-446655440001',
    user: null,
    targetId: null,
    targetType: null,
    changes: null,
    metadata: null,
    errorMessage: null,
    createdAt: new Date(),
  };

  const createPaginatedResponse = (
    data: AuditLog[],
    total: number,
    limit: number,
    offset: number,
  ): PaginatedResponseDto<AuditLog> => new PaginatedResponseDto(data, total, limit, offset);

  beforeEach(async () => {
    auditService = {
      findAll: jest.fn(),
      getStats: jest.fn(),
      findByUser: jest.fn(),
      findByAction: jest.fn(),
      cleanup: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return audit logs with pagination defaults', async () => {
      const query = {} as AuditQueryDto;

      auditService.findAll.mockResolvedValue(createPaginatedResponse([mockAuditLog], 1, 10, 0));

      const result = await controller.findAll(query);

      expect(result).toBeInstanceOf(PaginatedAuditLogsResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          data: [mockAuditLog],
          total: 1,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasMore: false,
        }),
      );

      expect(auditService.findAll).toHaveBeenCalledTimes(1);
      expect(auditService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
        {
          userId: undefined,
          action: undefined,
          status: undefined,
          fromDate: undefined,
          toDate: undefined,
        },
      );
    });

    it('should pass all filters and pagination values to the service', async () => {
      const fromDate = new Date('2026-01-01T00:00:00.000Z');
      const toDate = new Date('2026-01-31T23:59:59.999Z');

      const query = {
        limit: 20,
        offset: 40,
        sort: 'createdAt:DESC',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        fromDate,
        toDate,
      } as AuditQueryDto;

      auditService.findAll.mockResolvedValue(createPaginatedResponse([], 0, 20, 40));

      await controller.findAll(query);

      expect(auditService.findAll).toHaveBeenCalledTimes(1);
      expect(auditService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 40,
          sort: 'createdAt:DESC',
        }),
        {
          userId: query.userId,
          action: AuditAction.LOGIN,
          status: AuditStatus.SUCCESS,
          fromDate,
          toDate,
        },
      );
    });

    it('should preserve validated pagination values', async () => {
      const query = {
        limit: 25,
        offset: 50,
      } as AuditQueryDto;

      auditService.findAll.mockResolvedValue(createPaginatedResponse([], 0, 25, 50));

      await controller.findAll(query);

      expect(auditService.findAll).toHaveBeenCalledTimes(1);
      expect(auditService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          offset: 50,
          sort: undefined,
        }),
        {
          userId: undefined,
          action: undefined,
          status: undefined,
          fromDate: undefined,
          toDate: undefined,
        },
      );
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      const stats = {
        total: 100,
        byAction: { login: 50, logout: 30 },
        byStatus: { success: 90, failed: 10 },
        last24h: 10,
        last7d: 50,
      };

      auditService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toBeInstanceOf(AuditStatsResponseDto);
      expect(result).toEqual(expect.objectContaining(stats));
      expect(auditService.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByUser', () => {
    it('should call service with userId and pagination and return DTO', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const query = { limit: 15, offset: 30, sort: 'createdAt:DESC' } as PaginationDto;

      auditService.findByUser.mockResolvedValue(createPaginatedResponse([], 0, 15, 30));

      const result = await controller.findByUser(userId, query);

      expect(result).toBeInstanceOf(PaginatedAuditLogsResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          data: [],
          total: 0,
          limit: 15,
          offset: 30,
          hasMore: false,
        }),
      );

      expect(auditService.findByUser).toHaveBeenCalledTimes(1);
      expect(auditService.findByUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 15,
          offset: 30,
          sort: 'createdAt:DESC',
        }),
      );
    });

    it('should use default pagination when query is empty', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      auditService.findByUser.mockResolvedValue(createPaginatedResponse([], 0, 10, 0));

      const result = await controller.findByUser(userId, {});

      expect(result).toBeInstanceOf(PaginatedAuditLogsResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          data: [],
          total: 0,
          limit: 10,
          offset: 0,
          hasMore: false,
        }),
      );

      expect(auditService.findByUser).toHaveBeenCalledTimes(1);
      expect(auditService.findByUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
      );
    });
  });

  describe('findByAction', () => {
    it('should call service with action and pagination and return DTO', async () => {
      const action = AuditAction.LOGIN;
      const query = { limit: 20, offset: 10, sort: 'createdAt:DESC' } as PaginationDto;

      auditService.findByAction.mockResolvedValue(createPaginatedResponse([], 0, 20, 10));

      const result = await controller.findByAction(action, query);

      expect(result).toBeInstanceOf(PaginatedAuditLogsResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          data: [],
          total: 0,
          limit: 20,
          offset: 10,
          hasMore: false,
        }),
      );

      expect(auditService.findByAction).toHaveBeenCalledTimes(1);
      expect(auditService.findByAction).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          limit: 20,
          offset: 10,
          sort: 'createdAt:DESC',
        }),
      );
    });

    it('should use default pagination when query is empty', async () => {
      const action = AuditAction.LOGIN;

      auditService.findByAction.mockResolvedValue(createPaginatedResponse([], 0, 10, 0));

      const result = await controller.findByAction(action, {});

      expect(result).toBeInstanceOf(PaginatedAuditLogsResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          data: [],
          total: 0,
          limit: 10,
          offset: 0,
          hasMore: false,
        }),
      );

      expect(auditService.findByAction).toHaveBeenCalledTimes(1);
      expect(auditService.findByAction).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
      );
    });
  });

  describe('cleanup', () => {
    it('should clean up old audit logs using the default retention', async () => {
      auditService.cleanup.mockResolvedValue(5);

      const result = await controller.cleanup({});

      expect(result).toBeInstanceOf(AuditCleanupResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          deleted: 5,
          message: 'Deleted 5 audit logs older than 90 days',
        }),
      );

      expect(auditService.cleanup).toHaveBeenCalledTimes(1);
      expect(auditService.cleanup).toHaveBeenCalledWith(90);
    });

    it('should use the provided retention period', async () => {
      const query = { days: 30 } as AuditCleanupQueryDto;

      auditService.cleanup.mockResolvedValue(3);

      const result = await controller.cleanup(query);

      expect(result).toBeInstanceOf(AuditCleanupResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          deleted: 3,
          message: 'Deleted 3 audit logs older than 30 days',
        }),
      );

      expect(auditService.cleanup).toHaveBeenCalledTimes(1);
      expect(auditService.cleanup).toHaveBeenCalledWith(30);
    });

    it('should return zero when no logs are deleted', async () => {
      auditService.cleanup.mockResolvedValue(0);

      const result = await controller.cleanup({ days: 90 });

      expect(result).toBeInstanceOf(AuditCleanupResponseDto);
      expect(result).toEqual(
        expect.objectContaining({
          deleted: 0,
          message: 'Deleted 0 audit logs older than 90 days',
        }),
      );

      expect(auditService.cleanup).toHaveBeenCalledTimes(1);
      expect(auditService.cleanup).toHaveBeenCalledWith(90);
    });
  });

  describe('findOne', () => {
    it('should call service with id', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';

      auditService.findOne.mockResolvedValue(mockAuditLog);

      const result = await controller.findOne(id);

      expect(result).toBe(mockAuditLog);
      expect(auditService.findOne).toHaveBeenCalledTimes(1);
      expect(auditService.findOne).toHaveBeenCalledWith(id);
    });
  });
});
