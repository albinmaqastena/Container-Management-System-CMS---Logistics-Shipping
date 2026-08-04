// src/modules/audits/audit.service.spec.ts

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator, Repository } from 'typeorm';

import { AuditService } from './audit.service';
import { AuditAction, AuditLog, AuditStatus } from './entities/audit-log.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';

// Helper to extract value from TypeORM FindOperator (internal _value property)
const extractFindOperatorValue = <T>(operator: unknown): T => {
  return (operator as { _value: T })._value;
};

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
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(mockAuditLog),
    getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  });

  const mockRepositoryPersistence = (): void => {
    (repository.create as jest.Mock).mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    (repository.save as jest.Mock).mockImplementation(async (value: AuditLog) => value);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
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

      (repository.create as jest.Mock).mockReturnValue(createdLog);
      (repository.save as jest.Mock).mockResolvedValue(createdLog);

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
      (repository.create as jest.Mock).mockReturnValue(mockAuditLog);
      (repository.save as jest.Mock).mockResolvedValue(mockAuditLog);

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
      (repository.create as jest.Mock).mockReturnValue(mockAuditLog);
      (repository.save as jest.Mock).mockResolvedValue(mockAuditLog);

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
      expect(createArgument.errorMessage).toBe(errorMessage.slice(0, 5000));
    });

    it('should trim targetType and errorMessage', async () => {
      mockRepositoryPersistence();

      await service.log(
        AuditAction.LOGIN,
        undefined,
        undefined,
        '  User  ',
        undefined,
        undefined,
        AuditStatus.FAILED,
        '  Something failed  ',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'User',
          errorMessage: 'Something failed',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should normalize empty targetType and errorMessage to null', async () => {
      mockRepositoryPersistence();

      await service.log(
        AuditAction.LOGIN,
        undefined,
        undefined,
        '   ',
        undefined,
        undefined,
        AuditStatus.FAILED,
        '   ',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: null,
          errorMessage: null,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should redact sensitive audit data recursively', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, {
        password: 'secret',
        nested: {
          refresh_token: 'token-value',
          safe: 'visible',
        },
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            password: '[REDACTED]',
            nested: {
              refresh_token: '[REDACTED]',
              safe: 'visible',
            },
          },
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should redact sensitive keys case-insensitively', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, {
        Authorization: 'Bearer token',
        API_KEY: 'secret-key',
        'Refresh-Token': 'refresh',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            Authorization: '[REDACTED]',
            API_KEY: '[REDACTED]',
            'Refresh-Token': '[REDACTED]',
          },
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should replace oversized audit payload with truncation metadata', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, {
        large: 'x'.repeat(40_000),
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            _truncated: true,
            _originalSizeBytes: expect.any(Number),
            _maxSizeBytes: 32_000,
          }),
        }),
      );

      const changes = repository.create.mock.calls[0][0].changes as Record<string, unknown>;
      expect(changes._originalSizeBytes).toBeGreaterThan(32_000);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should sanitize and validate metadata', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        ip: ' 127.0.0.1 ',
        method: 'post',
        userAgent: 'a'.repeat(600),
        statusCode: 999,
        duration: -1,
      });

      const createArgument = repository.create.mock.calls[0][0];
      const metadata = createArgument.metadata;

      expect(metadata).toMatchObject({
        ip: '127.0.0.1',
        method: 'POST',
        userAgent: 'a'.repeat(500),
      });
      expect(metadata).not.toHaveProperty('statusCode');
      expect(metadata).not.toHaveProperty('duration');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should preserve valid numeric metadata', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        statusCode: 201,
        duration: 125,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            statusCode: 201,
            duration: 125,
          }),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should accept valid status code boundaries (100 and 599)', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        statusCode: 100,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            statusCode: 100,
          }),
        }),
      );

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        statusCode: 599,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            statusCode: 599,
          }),
        }),
      );
    });

    it('should reject invalid status codes (99 and 600)', async () => {
      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        statusCode: 99,
      });

      const createArgument1 = repository.create.mock.calls[0][0];

      expect(createArgument1.metadata).toBeNull();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, undefined, {
        statusCode: 600,
      });

      const createArgument2 = repository.create.mock.calls[1][0];

      expect(createArgument2.metadata).toBeNull();
    });

    it('should safely handle circular references', async () => {
      const circular: Record<string, unknown> = {
        visible: 'value',
      };
      circular.self = circular;

      mockRepositoryPersistence();

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, circular);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            visible: 'value',
            self: '[CIRCULAR]',
          },
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should redact sensitive keys inside Map values', async () => {
      mockRepositoryPersistence();

      const changes = {
        data: new Map<string, unknown>([
          ['password', 'secret'],
          ['visible', 'value'],
        ]),
      };

      await service.log(AuditAction.LOGIN, undefined, undefined, undefined, changes);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            data: {
              password: '[REDACTED]',
              visible: 'value',
            },
          },
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs with public user fields', async () => {
      const qb = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb as any);

      const paginationDto: PaginationDto = {
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      };

      const result = await service.findAll(paginationDto);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('audit');
      expect(qb.leftJoin).toHaveBeenCalledWith('audit.user', 'user');
      expect(qb.addSelect).toHaveBeenCalledWith([
        'user.id',
        'user.username',
        'user.email',
        'user.role',
        'user.isActive',
      ]);
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
      expect(qb.addOrderBy).toHaveBeenNthCalledWith(1, 'audit.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenNthCalledWith(2, 'audit.id', 'ASC');
    });

    it('should not add a duplicate id tie-breaker', async () => {
      const qb = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({
        sort: 'createdAt:DESC,id:ASC',
      });

      expect(qb.orderBy).toHaveBeenCalledWith('audit.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledTimes(1);
      expect(qb.addOrderBy).toHaveBeenCalledWith('audit.id', 'ASC');
    });

    it('should use default sorting when sort is missing with tie-breaker', async () => {
      const qb = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(qb as any);

      await service.findAll({});

      expect(qb.orderBy).toHaveBeenCalledWith('audit.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
    });

    it('should reject invalid fromDate', async () => {
      await expect(service.findAll({}, { fromDate: new Date('invalid') })).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should reject invalid toDate', async () => {
      await expect(service.findAll({}, { toDate: new Date('invalid') })).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should reject reversed date range', async () => {
      await expect(
        service.findAll(
          {},
          {
            fromDate: new Date('2026-02-01T00:00:00Z'),
            toDate: new Date('2026-01-01T00:00:00Z'),
          },
        ),
      ).rejects.toThrow('fromDate must be earlier than or equal to toDate');

      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return audit log by ID with public user fields', async () => {
      const qb = createQueryBuilderMock();
      qb.getOne.mockResolvedValue(mockAuditLog);
      repository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findOne(mockAuditLog.id);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('audit');
      expect(qb.leftJoin).toHaveBeenCalledWith('audit.user', 'user');
      expect(qb.addSelect).toHaveBeenCalledWith([
        'user.id',
        'user.username',
        'user.email',
        'user.role',
        'user.isActive',
      ]);
      expect(qb.where).toHaveBeenCalledWith('audit.id = :id', { id: mockAuditLog.id });
      expect(result).toEqual(mockAuditLog);
    });

    it('should throw when log is not found', async () => {
      const qb = createQueryBuilderMock();
      qb.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(qb as any);

      await expect(service.findOne(mockAuditLog.id)).rejects.toThrow(NotFoundException);

      expect(qb.where).toHaveBeenCalledWith('audit.id = :id', { id: mockAuditLog.id });
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
        { action: 'login', count: '50' },
        { action: 'logout', count: '30' },
      ]);

      statusQb.getRawMany.mockResolvedValue([
        { status: 'success', count: '80' },
        { status: 'failed', count: '20' },
      ]);

      repository.createQueryBuilder
        .mockReturnValueOnce(actionQb as any)
        .mockReturnValueOnce(statusQb as any);

      repository.count
        .mockResolvedValueOnce(130)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(90);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 130,
        byAction: {
          login: 50,
          logout: 30,
        },
        byStatus: {
          success: 80,
          failed: 20,
        },
        last24h: 20,
        last7d: 90,
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

    it('should filter out unknown actions and statuses', async () => {
      const actionQb = createQueryBuilderMock();
      const statusQb = createQueryBuilderMock();

      actionQb.getRawMany.mockResolvedValue([
        { action: 'login', count: '50' },
        { action: 'invalid_action', count: '999' },
      ]);

      statusQb.getRawMany.mockResolvedValue([
        { status: 'success', count: '80' },
        { status: 'invalid_status', count: '999' },
      ]);

      repository.createQueryBuilder
        .mockReturnValueOnce(actionQb as any)
        .mockReturnValueOnce(statusQb as any);

      repository.count
        .mockResolvedValueOnce(130)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(90);

      const result = await service.getStats();

      expect(result.byAction).toEqual({ login: 50 });
      expect(result.byStatus).toEqual({ success: 80 });
      expect(result.total).toBe(130);
      expect(result.last24h).toBe(20);
      expect(result.last7d).toBe(90);
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
        createdAt: FindOperator<Date>;
      };

      const cutoff = extractFindOperatorValue<Date>(deleteCriteria.createdAt);

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

    it('should return zero when affected is undefined', async () => {
      repository.delete.mockResolvedValue({
        affected: undefined,
        raw: [],
      });

      await expect(service.cleanup(30)).resolves.toBe(0);
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
        createdAt: FindOperator<Date>;
      };

      const cutoff = extractFindOperatorValue<Date>(deleteCriteria.createdAt);
      const expected = before - 90 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1000);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'should reject invalid retention period: %p',
      async (days) => {
        await expect(service.cleanup(days)).rejects.toThrow(BadRequestException);
        expect(repository.delete).not.toHaveBeenCalled();
      },
    );
  });
});
