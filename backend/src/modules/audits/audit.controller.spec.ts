// src/modules/audit/audit.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditAction, AuditStatus } from './entities/audit-log.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

describe('AuditController', () => {
  let controller: AuditController;
  let service: jest.Mocked<AuditService>;

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
  };

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
    it('should return audit logs', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const expected = { data: [mockAuditLog], total: 1, limit: 10, offset: 0 } as any;
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(paginationDto);
      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: undefined,
        action: undefined,
        status: undefined,
        fromDate: undefined,
        toDate: undefined,
      });
    });

    it('should filter by userId', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await controller.findAll(paginationDto, 'user-1');
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: 'user-1',
        action: undefined,
        status: undefined,
        fromDate: undefined,
        toDate: undefined,
      });
    });

    it('should filter by action', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await controller.findAll(paginationDto, undefined, AuditAction.LOGIN);
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: undefined,
        action: AuditAction.LOGIN,
        status: undefined,
        fromDate: undefined,
        toDate: undefined,
      });
    });

    it('should filter by status', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await controller.findAll(paginationDto, undefined, undefined, AuditStatus.SUCCESS);
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: undefined,
        action: undefined,
        status: AuditStatus.SUCCESS,
        fromDate: undefined,
        toDate: undefined,
      });
    });

    it('should filter by fromDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const fromDate = '2024-01-01T00:00:00Z';
      await controller.findAll(paginationDto, undefined, undefined, undefined, fromDate);
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: undefined,
        action: undefined,
        status: undefined,
        fromDate: expect.any(Date),
        toDate: undefined,
      });
    });

    it('should throw BadRequestException for invalid fromDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await expect(controller.findAll(paginationDto, undefined, undefined, undefined, 'invalid-date')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should filter by toDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const toDate = '2024-01-01T00:00:00Z';
      await controller.findAll(paginationDto, undefined, undefined, undefined, undefined, toDate);
      expect(service.findAll).toHaveBeenCalledWith(paginationDto, {
        userId: undefined,
        action: undefined,
        status: undefined,
        fromDate: undefined,
        toDate: expect.any(Date),
      });
    });

    it('should throw BadRequestException for invalid toDate', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      await expect(controller.findAll(paginationDto, undefined, undefined, undefined, undefined, 'invalid-date')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      const expected = {
        total: 100,
        byAction: { login: 50, logout: 30, create: 20 },
        byStatus: { success: 90, failed: 10 },
        last24h: 10,
        last7d: 50,
      };
      service.getStats.mockResolvedValue(expected);

      const result = await controller.getStats();
      expect(result).toEqual(expected);
      expect(service.getStats).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return audit log by id', async () => {
      const expected = mockAuditLog;
      service.findOne.mockResolvedValue(expected as any);

      const result = await controller.findOne('audit-1');
      expect(result).toEqual(expected);
      expect(service.findOne).toHaveBeenCalledWith('audit-1');
    });
  });

  describe('findByUser', () => {
    it('should return audit logs by user', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const expected = { data: [mockAuditLog], total: 1, limit: 10, offset: 0 } as any;
      service.findByUser.mockResolvedValue(expected);

      const result = await controller.findByUser('user-1', paginationDto);
      expect(result).toEqual(expected);
      expect(service.findByUser).toHaveBeenCalledWith('user-1', paginationDto);
    });
  });

  describe('findByAction', () => {
    it('should return audit logs by action', async () => {
      const paginationDto: PaginationDto = { limit: 10, offset: 0 };
      const expected = { data: [mockAuditLog], total: 1, limit: 10, offset: 0 } as any;
      service.findByAction.mockResolvedValue(expected);

      const result = await controller.findByAction(AuditAction.LOGIN, paginationDto);
      expect(result).toEqual(expected);
      expect(service.findByAction).toHaveBeenCalledWith(AuditAction.LOGIN, paginationDto);
    });
  });

  describe('cleanup', () => {
    it('should clean up old audit logs with default days', async () => {
      service.cleanup.mockResolvedValue(5);

      const result = await controller.cleanup();
      expect(result).toEqual({
        deleted: 5,
        message: 'Deleted 5 audit logs older than 90 days',
      });
      expect(service.cleanup).toHaveBeenCalledWith(90);
    });

    it('should clean up old audit logs with custom days', async () => {
      service.cleanup.mockResolvedValue(10);

      const result = await controller.cleanup(30);
      expect(result).toEqual({
        deleted: 10,
        message: 'Deleted 10 audit logs older than 30 days',
      });
      expect(service.cleanup).toHaveBeenCalledWith(30);
    });

    it('should return 0 if no logs deleted', async () => {
      service.cleanup.mockResolvedValue(0);

      const result = await controller.cleanup(90);
      expect(result).toEqual({
        deleted: 0,
        message: 'Deleted 0 audit logs older than 90 days',
      });
    });
  });
});