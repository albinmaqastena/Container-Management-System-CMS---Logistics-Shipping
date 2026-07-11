// src/modules/audit/audit.service.spec.ts

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditService } from './audit.service';
import { AuditAction, AuditLog, AuditStatus } from './entities/audit-log.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<Repository<AuditLog>>;

  const mockAuditLog = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    action: AuditAction.LOGIN,
    status: AuditStatus.SUCCESS,
    userId: '550e8400-e29b-41d4-a716-446655440001',
    user: null,
    targetId: '550e8400-e29b-41d4-a716-446655440002',
    targetType: 'User',
    changes: null,
    metadata: {
      ip: '127.0.0.1',
    },
    errorMessage: null,
    createdAt: new Date(),
  } as AuditLog;

  const createQueryBuilderMock = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);

    repository = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create and save an audit log', async () => {
      const createdLog = {
        ...mockAuditLog,
        changes: {
          field: 'value',
        },
      } as AuditLog;

      repository.create.mockReturnValue(createdLog);

      repository.save.mockResolvedValue(createdLog);

      const result = await service.log(
        AuditAction.LOGIN,
        mockAuditLog.userId!,
        mockAuditLog.targetId!,
        'User',
        {
          field: 'value',
        },
        {
          ip: '127.0.0.1',
        },
        AuditStatus.SUCCESS,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN,
          userId: mockAuditLog.userId,
          targetId: mockAuditLog.targetId,
          targetType: 'User',
          changes: {
            field: 'value',
          },
          status: AuditStatus.SUCCESS,
          errorMessage: null,
        }),
      );

      expect(repository.save).toHaveBeenCalledWith(createdLog);

      expect(result).toEqual(createdLog);
    });

    it('should store nulls for missing optional fields', async () => {
      repository.create.mockReturnValue(mockAuditLog);

      repository.save.mockResolvedValue(mockAuditLog);

      await service.log(AuditAction.LOGIN);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          targetId: null,
          targetType: null,
          changes: null,
          metadata: null,
          errorMessage: null,
        }),
      );
    });

    it('should truncate very long error messages', async () => {
      repository.create.mockReturnValue(mockAuditLog);

      repository.save.mockResolvedValue(mockAuditLog);

      const errorMessage = 'x'.repeat(6000);

      await service.log(
        AuditAction.LOGIN,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        AuditStatus.FAILED,
        errorMessage,
      );

      const createArgument = repository.create.mock.calls[0][0];

      expect(createArgument.errorMessage).toHaveLength(5000);
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      const paginationDto: PaginationDto = {
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      };

      const result = await service.findAll(paginationDto);

      expect(result.data).toEqual([mockAuditLog]);

      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.hasMore).toBe(false);

      expect(qb.skip).toHaveBeenCalledWith(0);

      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should apply all filters', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      const fromDate = new Date('2026-01-01T00:00:00.000Z');

      const toDate = new Date('2026-01-31T23:59:59.999Z');

      await service.findAll(
        {
          limit: 10,
          offset: 0,
        },
        {
          userId: mockAuditLog.userId!,
          action: AuditAction.LOGIN,
          status: AuditStatus.SUCCESS,
          fromDate,
          toDate,
        },
      );

      expect(qb.andWhere).toHaveBeenCalledWith('audit.userId = :userId', {
        userId: mockAuditLog.userId,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.action = :action', {
        action: AuditAction.LOGIN,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.status = :status', {
        status: AuditStatus.SUCCESS,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      });
    });

    it('should apply only fromDate filter', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      const fromDate = new Date('2026-01-01T00:00:00.000Z');

      await service.findAll({}, { fromDate });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.createdAt >= :fromDate', { fromDate });
    });

    it('should apply only toDate filter', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      const toDate = new Date('2026-01-31T23:59:59.999Z');

      await service.findAll({}, { toDate });

      expect(qb.andWhere).toHaveBeenCalledWith('audit.createdAt <= :toDate', { toDate });
    });

    it('should use orderBy for the first sort and addOrderBy for additional sorts', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({
        limit: 10,
        offset: 0,
        sort: 'action:ASC,createdAt:DESC',
      });

      expect(qb.orderBy).toHaveBeenCalledWith('audit.action', 'ASC');

      expect(qb.addOrderBy).toHaveBeenCalledWith('audit.createdAt', 'DESC');
    });

    it('should use default sorting when sort is missing', async () => {
      const qb = createQueryBuilderMock();

      repository.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({});

      expect(qb.orderBy).toHaveBeenCalledWith('audit.createdAt', 'DESC');

      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return audit log by ID', async () => {
      repository.findOne.mockResolvedValue(mockAuditLog);

      const result = await service.findOne(mockAuditLog.id);

      expect(result).toEqual(mockAuditLog);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockAuditLog.id,
        },
        relations: {
          user: true,
        },
      });
    });

    it('should throw when log is not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(mockAuditLog.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    it('should delegate to findAll', async () => {
      const paginationDto = {
        limit: 10,
        offset: 0,
      } as PaginationDto;

      const spy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(new PaginatedResponseDto([], 0, 10, 0));

      await service.findByUser(mockAuditLog.userId!, paginationDto);

      expect(spy).toHaveBeenCalledWith(paginationDto, {
        userId: mockAuditLog.userId,
      });
    });
  });

  describe('findByAction', () => {
    it('should delegate to findAll', async () => {
      const paginationDto = {
        limit: 10,
        offset: 0,
      } as PaginationDto;

      const spy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(new PaginatedResponseDto([], 0, 10, 0));

      await service.findByAction(AuditAction.LOGIN, paginationDto);

      expect(spy).toHaveBeenCalledWith(paginationDto, {
        action: AuditAction.LOGIN,
      });
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      const actionQb = createQueryBuilderMock();

      const statusQb = createQueryBuilderMock();

      actionQb.getRawMany.mockResolvedValue([
        {
          action: 'login',
          count: '50',
        },
        {
          action: 'logout',
          count: '30',
        },
      ]);

      statusQb.getRawMany.mockResolvedValue([
        {
          status: 'success',
          count: '80',
        },
        {
          status: 'failed',
          count: '20',
        },
      ]);

      repository.createQueryBuilder
        .mockReturnValueOnce(actionQb as any)
        .mockReturnValueOnce(statusQb as any);

      repository.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(50);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 100,
        byAction: {
          login: 50,
          logout: 30,
        },
        byStatus: {
          success: 80,
          failed: 20,
        },
        last24h: 10,
        last7d: 50,
      });

      expect(repository.count).toHaveBeenCalledTimes(3);
    });

    it('should handle empty statistics', async () => {
      const actionQb = createQueryBuilderMock();

      const statusQb = createQueryBuilderMock();

      actionQb.getRawMany.mockResolvedValue([]);

      statusQb.getRawMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(actionQb as any)
        .mockReturnValueOnce(statusQb as any);

      repository.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 0,
        byAction: {},
        byStatus: {},
        last24h: 0,
        last7d: 0,
      });
    });
  });

  describe('cleanup', () => {
    it('should delete logs older than the cutoff date', async () => {
      repository.delete.mockResolvedValue({
        affected: 5,
        raw: [],
      });

      const before = Date.now();

      const result = await service.cleanup(90);

      const after = Date.now();

      expect(result).toBe(5);

      expect(repository.delete).toHaveBeenCalledTimes(1);

      const deleteCriteria = repository.delete.mock.calls[0][0] as unknown as {
        createdAt: {
          _value: Date;
        };
      };

      const cutoff = deleteCriteria.createdAt._value;

      const expectedMin = before - 90 * 24 * 60 * 60 * 1000;

      const expectedMax = after - 90 * 24 * 60 * 60 * 1000;

      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);

      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should return zero when no rows are deleted', async () => {
      repository.delete.mockResolvedValue({
        affected: 0,
        raw: [],
      });

      const result = await service.cleanup(30);

      expect(result).toBe(0);
    });

    it('should use 90 days by default', async () => {
      repository.delete.mockResolvedValue({
        affected: 3,
        raw: [],
      });

      const before = Date.now();

      const result = await service.cleanup();

      expect(result).toBe(3);

      const deleteCriteria = repository.delete.mock.calls[0][0] as unknown as {
        createdAt: {
          _value: Date;
        };
      };

      const cutoff = deleteCriteria.createdAt._value;

      const expected = before - 90 * 24 * 60 * 60 * 1000;

      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1000);
    });
  });
});
