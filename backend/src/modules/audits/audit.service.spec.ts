// src/modules/audit/audit.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotFoundException } from '@nestjs/common';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<Repository<AuditLog>>;

  const mockAuditLog = {
    id: 'audit-1',
    action: AuditAction.LOGIN,
    status: AuditStatus.SUCCESS,
    userId: 'user-1',
    targetId: 'target-1',
    targetType: 'User',
    changes: null,
    metadata: { ip: '127.0.0.1' },
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', username: 'admin' },
  };

  const createQueryBuilderMock = (): any => ({
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
    getRawMany: jest.fn().mockResolvedValue([
      { action: 'login', count: '50' },
      { action: 'logout', count: '30' },
    ]),
    getCount: jest.fn().mockResolvedValue(10),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 5 }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
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
      const logData = {
        action: AuditAction.LOGIN,
        userId: 'user-1',
        targetId: 'target-1',
        targetType: 'User',
        changes: { field: 'value' },
        metadata: { ip: '127.0.0.1' },
        status: AuditStatus.SUCCESS,
        errorMessage: undefined,
      };

      const savedLog = { ...mockAuditLog, ...logData };
      repository.save.mockResolvedValue(savedLog as any);

      const result = await service.log(
        logData.action,
        logData.userId,
        logData.targetId,
        logData.targetType,
        logData.changes,
        logData.metadata,
        logData.status,
      );

      expect(result).toEqual(savedLog);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should create audit log with error message when status is failed', async () => {
      const errorMessage = 'Invalid credentials';
      repository.save.mockResolvedValue({ ...mockAuditLog, status: AuditStatus.FAILED, errorMessage } as any);

      const result = await service.log(
        AuditAction.LOGIN,
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        AuditStatus.FAILED,
        errorMessage,
      );

      expect(result.status).toBe(AuditStatus.FAILED);
      expect(result.errorMessage).toBe(errorMessage);
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0, sort: 'createdAt:DESC' };
      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should filter by userId', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await service.findAll(paginationDto, { userId: 'user-1' });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter by action', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await service.findAll(paginationDto, { action: AuditAction.LOGIN });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await service.findAll(paginationDto, { status: AuditStatus.SUCCESS });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter by fromDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const fromDate = new Date('2024-01-01');
      await service.findAll(paginationDto, { fromDate });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter by toDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const toDate = new Date('2024-01-31');
      await service.findAll(paginationDto, { toDate });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should sort by multiple fields', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0, sort: 'createdAt:DESC,action:ASC' };
      await service.findAll(paginationDto);
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return audit log by id', async () => {
      repository.findOne.mockResolvedValue(mockAuditLog as any);

      const result = await service.findOne('audit-1');
      expect(result).toEqual(mockAuditLog);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'audit-1' },
        relations: { user: true },
      });
    });

    it('should throw NotFoundException if log not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    it('should return audit logs by user', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const spy = jest.spyOn(service, 'findAll');

      await service.findByUser('user-1', paginationDto);
      expect(spy).toHaveBeenCalledWith(paginationDto, { userId: 'user-1' });
    });
  });

  describe('findByAction', () => {
    it('should return audit logs by action', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const spy = jest.spyOn(service, 'findAll');

      await service.findByAction(AuditAction.LOGIN, paginationDto);
      expect(spy).toHaveBeenCalledWith(paginationDto, { action: AuditAction.LOGIN });
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      const queryBuilderMock = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      repository.count.mockResolvedValue(100);
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce([
          { action: 'login', count: '50' },
          { action: 'logout', count: '30' },
        ])
        .mockResolvedValueOnce([
          { status: 'success', count: '80' },
          { status: 'failed', count: '20' },
        ]);
      queryBuilderMock.getCount.mockResolvedValue(10);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 100,
        byAction: { login: 50, logout: 30 },
        byStatus: { success: 80, failed: 20 },
        last24h: 10,
        last7d: 10,
      });
    });

    it('should handle empty statistics gracefully', async () => {
      const queryBuilderMock = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilderMock);

      repository.count.mockResolvedValue(0);
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryBuilderMock.getCount.mockResolvedValue(0);

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
    it('should delete audit logs older than specified days', async () => {
      const queryBuilderMock = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilderMock);
      queryBuilderMock.execute.mockResolvedValue({ affected: 5 });

      const result = await service.cleanup(90);
      expect(result).toBe(5);
      expect(queryBuilderMock.delete).toHaveBeenCalled();
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'createdAt < NOW() - INTERVAL :days DAY',
        { days: 90 },
      );
    });

    it('should return 0 if no logs deleted', async () => {
      const queryBuilderMock = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilderMock);
      queryBuilderMock.execute.mockResolvedValue({ affected: 0 });

      const result = await service.cleanup(30);
      expect(result).toBe(0);
    });

    it('should use default 90 days if not specified', async () => {
      const queryBuilderMock = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilderMock);
      queryBuilderMock.execute.mockResolvedValue({ affected: 3 });

      const result = await service.cleanup();
      expect(result).toBe(3);
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'createdAt < NOW() - INTERVAL :days DAY',
        { days: 90 },
      );
    });
  });
});