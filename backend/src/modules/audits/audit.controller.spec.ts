// src/modules/audits/audit.controller.spec.ts

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditController } from './audit.controller';
import { AuditService, AuditStats } from './audit.service';
import { AuditAction, AuditLog, AuditStatus } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditCleanupQueryDto } from './dto/audit-cleanup-query.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';

describe('AuditController', () => {
  let controller: AuditController;
  let service: jest.Mocked<AuditService>;

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

  const createPaginatedResponse = (
    data: AuditLog[] = [],
    total = data.length,
    limit = 10,
    offset = 0,
  ): PaginatedResponseDto<AuditLog> => new PaginatedResponseDto(data, total, limit, offset);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: {
            findAll: jest.fn(),
            getStats: jest.fn(),
            findOne: jest.fn(),
            findByUser: jest.fn(),
            findByAction: jest.fn(),
            cleanup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);

    service = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return audit logs with pagination defaults', async () => {
      const query = {} as AuditQueryDto;

      const expected = createPaginatedResponse([mockAuditLog], 1);

      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(result).toEqual(expected);

      expect(result.hasMore).toBe(false);

      expect(service.findAll).toHaveBeenCalledWith(
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

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
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

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          offset: 50,
        }),
        expect.any(Object),
      );
    });

    it('should throw when fromDate is after toDate', async () => {
      const query = {
        fromDate: new Date('2026-02-01T00:00:00.000Z'),
        toDate: new Date('2026-01-01T00:00:00.000Z'),
      } as AuditQueryDto;

      await expect(controller.findAll(query)).rejects.toThrow(BadRequestException);

      expect(service.findAll).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      const expected: AuditStats = {
        total: 100,
        byAction: {
          login: 50,
          logout: 30,
        },
        byStatus: {
          success: 90,
          failed: 10,
        },
        last24h: 10,
        last7d: 50,
      };

      service.getStats.mockResolvedValue(expected);

      const result = await controller.getStats();

      expect(result).toEqual(expected);

      expect(service.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return an audit log by ID', async () => {
      service.findOne.mockResolvedValue(mockAuditLog);

      const result = await controller.findOne(mockAuditLog.id);

      expect(result).toEqual(mockAuditLog);

      expect(service.findOne).toHaveBeenCalledWith(mockAuditLog.id);
    });
  });

  describe('findByUser', () => {
    it('should return audit logs by user', async () => {
      const query = {
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      } as PaginationDto;

      const expected = createPaginatedResponse([mockAuditLog], 1);

      service.findByUser.mockResolvedValue(expected);

      const result = await controller.findByUser(mockAuditLog.userId!, query);

      expect(result).toEqual(expected);

      expect(service.findByUser).toHaveBeenCalledWith(
        mockAuditLog.userId,
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: 'createdAt:DESC',
        }),
      );
    });
  });

  describe('findByAction', () => {
    it('should return audit logs by action', async () => {
      const query = {
        limit: 10,
        offset: 0,
      } as PaginationDto;

      const expected = createPaginatedResponse([mockAuditLog], 1);

      service.findByAction.mockResolvedValue(expected);

      const result = await controller.findByAction(AuditAction.LOGIN, query);

      expect(result).toEqual(expected);

      expect(service.findByAction).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
      );
    });

    it('should throw for an invalid action', async () => {
      await expect(controller.findByAction('invalid' as AuditAction, {})).rejects.toThrow(
        BadRequestException,
      );

      expect(service.findByAction).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up old audit logs using the default retention', async () => {
      service.cleanup.mockResolvedValue(5);

      const result = await controller.cleanup({});

      expect(result).toEqual({
        deleted: 5,
        message: 'Deleted 5 audit logs older than 90 days',
      });

      expect(service.cleanup).toHaveBeenCalledWith(90);
    });

    it('should clean up old audit logs using custom retention', async () => {
      service.cleanup.mockResolvedValue(10);

      const result = await controller.cleanup({
        days: 30,
      });

      expect(result).toEqual({
        deleted: 10,
        message: 'Deleted 10 audit logs older than 30 days',
      });

      expect(service.cleanup).toHaveBeenCalledWith(30);
    });

    it('should return zero when no logs are deleted', async () => {
      service.cleanup.mockResolvedValue(0);

      const result = await controller.cleanup({
        days: 90,
      });

      expect(result).toEqual({
        deleted: 0,
        message: 'Deleted 0 audit logs older than 90 days',
      });

      expect(service.cleanup).toHaveBeenCalledWith(90);
    });
  });
});
