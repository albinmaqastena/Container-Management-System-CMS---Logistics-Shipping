// src/modules/cleanup/cleanup.service.spec.ts

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';

import { CleanupService } from './cleanup.service';
import { ContainersService } from '../containers/containers.service';
import { ItemsService } from '../items/items.service';

type TestableCleanupService = {
  cleanupRunning: boolean;
  getRetentionDays(key: string, defaultValue: number): number;
  tryAcquireCleanupLock(queryRunner: QueryRunner): Promise<boolean>;
  releaseCleanupLock(queryRunner: QueryRunner): Promise<void>;
};

const getTestableService = (service: CleanupService): TestableCleanupService =>
  service as unknown as TestableCleanupService;

const createMockQueryResult = (acquired: boolean) =>
  [{ acquired }] as unknown as Array<{ acquired: boolean }>;

const createMockUnlockResult = (released: boolean) =>
  [{ released }] as unknown as Array<{ released: boolean }>;

const mockQueryRunner = (): jest.Mocked<QueryRunner> =>
  ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    release: jest.fn().mockResolvedValue(undefined),
    isReleased: false,
  }) as unknown as jest.Mocked<QueryRunner>;

describe('CleanupService', () => {
  let service: CleanupService;
  let containersService: jest.Mocked<ContainersService>;
  let itemsService: jest.Mocked<ItemsService>;
  let configService: jest.Mocked<ConfigService>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    containersService = {
      cleanupExpiredContainers: jest.fn().mockResolvedValue(5),
    } as unknown as jest.Mocked<ContainersService>;

    itemsService = {
      cleanupExpiredItems: jest.fn().mockResolvedValue(10),
    } as unknown as jest.Mocked<ItemsService>;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'CONTAINER_SOFT_DELETE_RETENTION_DAYS') return 30;
        if (key === 'ITEM_SOFT_DELETE_RETENTION_DAYS') return 30;
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    queryRunner = mockQueryRunner();
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: ContainersService, useValue: containersService },
        { provide: ItemsService, useValue: itemsService },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);

    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanupSoftDeletedData', () => {
    it('should skip if cleanup is already running', async () => {
      getTestableService(service).cleanupRunning = true;

      await service.cleanupSoftDeletedData();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Soft-delete cleanup is already running in this application instance',
      );
      expect(containersService.cleanupExpiredContainers).not.toHaveBeenCalled();
      expect(itemsService.cleanupExpiredItems).not.toHaveBeenCalled();
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should validate configuration before acquiring lock and log error without rejecting', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'CONTAINER_SOFT_DELETE_RETENTION_DAYS') return 'invalid';
        if (key === 'ITEM_SOFT_DELETE_RETENTION_DAYS') return 30;
        return undefined;
      });

      await expect(service.cleanupSoftDeletedData()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid application configuration: CONTAINER_SOFT_DELETE_RETENTION_DAYS must be an integer between 1 and 3650',
        ),
        expect.any(String),
      );

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(containersService.cleanupExpiredContainers).not.toHaveBeenCalled();
      expect(itemsService.cleanupExpiredItems).not.toHaveBeenCalled();
    });

    it('should skip if lock cannot be acquired', async () => {
      queryRunner.query.mockResolvedValue(createMockQueryResult(false));

      await service.cleanupSoftDeletedData();

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_try_advisory_lock'),
        ['734928174003'],
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Soft-delete cleanup skipped because another replica is already running it',
      );
      expect(containersService.cleanupExpiredContainers).not.toHaveBeenCalled();
      expect(itemsService.cleanupExpiredItems).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should run container cleanup before individual items', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      containersService.cleanupExpiredContainers.mockResolvedValue(5);
      itemsService.cleanupExpiredItems.mockResolvedValue(10);

      await service.cleanupSoftDeletedData();

      const containerOrder = containersService.cleanupExpiredContainers.mock.invocationCallOrder[0];
      const itemOrder = itemsService.cleanupExpiredItems.mock.invocationCallOrder[0];

      if (containerOrder === undefined || itemOrder === undefined) {
        throw new Error('Expected both cleanup operations to execute');
      }

      expect(containerOrder).toBeLessThan(itemOrder);
    });

    it('should run both container and item cleanup when lock is acquired', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      await service.cleanupSoftDeletedData();

      expect(containersService.cleanupExpiredContainers).toHaveBeenCalledWith(30);
      expect(itemsService.cleanupExpiredItems).toHaveBeenCalledWith(30);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting soft-delete cleanup: containers=30 days, items=30 days'),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith('Permanently deleted 5 expired containers');
      expect(loggerLogSpy).toHaveBeenCalledWith('Permanently deleted 10 expired individual items');
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Soft-delete cleanup completed successfully in \d+ms/),
      );

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_unlock'),
        ['734928174003'],
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should continue item cleanup even if container cleanup fails', async () => {
      const containerError = new Error('Container cleanup DB error');
      containersService.cleanupExpiredContainers.mockRejectedValueOnce(containerError);
      itemsService.cleanupExpiredItems.mockResolvedValue(10);

      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      await service.cleanupSoftDeletedData();

      expect(containersService.cleanupExpiredContainers).toHaveBeenCalled();
      expect(itemsService.cleanupExpiredItems).toHaveBeenCalled();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Container cleanup failed: ${containerError.message}`,
        containerError.stack,
      );
      expect(loggerLogSpy).toHaveBeenCalledWith('Permanently deleted 10 expired individual items');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Soft-delete cleanup completed with failures in \d+ms/),
      );
    });

    it('should handle both container and item cleanup failing', async () => {
      const containerError = new Error('Container failure');
      const itemError = new Error('Item failure');

      containersService.cleanupExpiredContainers.mockRejectedValue(containerError);
      itemsService.cleanupExpiredItems.mockRejectedValue(itemError);

      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      await service.cleanupSoftDeletedData();

      expect(containersService.cleanupExpiredContainers).toHaveBeenCalled();
      expect(itemsService.cleanupExpiredItems).toHaveBeenCalled();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Container cleanup failed: ${containerError.message}`,
        containerError.stack,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Item cleanup failed: ${itemError.message}`,
        itemError.stack,
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Soft-delete cleanup completed with failures in \d+ms/),
      );
    });

    it('should still release lock and connection when cleanup fails', async () => {
      const error = new Error('Something went wrong');
      containersService.cleanupExpiredContainers.mockRejectedValueOnce(error);

      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      await service.cleanupSoftDeletedData();

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_unlock'),
        ['734928174003'],
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should skip a second run while the first run is active', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      let resolveContainerCleanup!: (value: number) => void;
      const pendingCleanup = new Promise<number>((resolve) => {
        resolveContainerCleanup = resolve;
      });

      containersService.cleanupExpiredContainers.mockReturnValue(pendingCleanup);

      const firstRun = service.cleanupSoftDeletedData();

      while (containersService.cleanupExpiredContainers.mock.calls.length === 0) {
        await Promise.resolve();
      }

      await service.cleanupSoftDeletedData();

      expect(containersService.cleanupExpiredContainers).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Soft-delete cleanup is already running in this application instance',
      );

      resolveContainerCleanup(5);
      await firstRun;
    });

    it('should allow another run after query runner creation fails', async () => {
      dataSource.createQueryRunner
        .mockImplementationOnce(() => {
          throw new Error('Cannot create query runner');
        })
        .mockReturnValueOnce(queryRunner);

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled soft-delete cleanup failed after'),
        expect.any(String),
      );

      queryRunner.query.mockResolvedValueOnce(createMockQueryResult(false));

      await service.cleanupSoftDeletedData();

      expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during query runner creation', async () => {
      const createError = new Error('Cannot create query runner');
      dataSource.createQueryRunner.mockImplementationOnce(() => {
        throw createError;
      });

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled soft-delete cleanup failed after'),
        createError.stack,
      );
      expect(getTestableService(service).cleanupRunning).toBe(false);
    });

    it('should handle errors during connection', async () => {
      const connectError = new Error('Connection failed');
      queryRunner.connect.mockRejectedValueOnce(connectError);

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled soft-delete cleanup failed after'),
        connectError.stack,
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle errors during lock acquisition', async () => {
      const lockError = new Error('Lock query failed');
      queryRunner.query.mockRejectedValueOnce(lockError);

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled soft-delete cleanup failed after'),
        lockError.stack,
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle errors during lock release', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockRejectedValueOnce(new Error('Unlock failed'));

      containersService.cleanupExpiredContainers.mockResolvedValue(5);
      itemsService.cleanupExpiredItems.mockResolvedValue(10);

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to explicitly release cleanup advisory lock'),
        expect.any(String),
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle errors during connection release', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(true));

      queryRunner.release.mockRejectedValueOnce(new Error('Release failed'));

      await service.cleanupSoftDeletedData();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to release cleanup database connection: Release failed',
        expect.any(String),
      );
      expect(getTestableService(service).cleanupRunning).toBe(false);
    });

    it('should log if unlock reports false', async () => {
      queryRunner.query
        .mockResolvedValueOnce(createMockQueryResult(true))
        .mockResolvedValueOnce(createMockUnlockResult(false));

      containersService.cleanupExpiredContainers.mockResolvedValue(5);
      itemsService.cleanupExpiredItems.mockResolvedValue(10);

      await service.cleanupSoftDeletedData();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Soft-delete cleanup advisory lock was not held during explicit release',
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should not attempt unlock when lock was not acquired', async () => {
      queryRunner.query.mockResolvedValueOnce(createMockQueryResult(false));

      await service.cleanupSoftDeletedData();

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRetentionDays', () => {
    it('should return configured value when valid', () => {
      configService.get.mockReturnValue('45');
      const result = getTestableService(service).getRetentionDays('TEST_KEY', 30);
      expect(result).toBe(45);
    });

    it('should return default when config is not present', () => {
      configService.get.mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);

      const result = getTestableService(service).getRetentionDays('TEST_KEY', 30);

      expect(result).toBe(30);
    });

    it('should accept boundary values 1 and 3650', () => {
      configService.get.mockReturnValue(1);
      const result1 = getTestableService(service).getRetentionDays('TEST_KEY', 30);
      expect(result1).toBe(1);

      configService.get.mockReturnValue(3650);
      const result2 = getTestableService(service).getRetentionDays('TEST_KEY', 30);
      expect(result2).toBe(3650);
    });

    it.each([-1, 1.5, NaN, Infinity, 3651])('should reject invalid retention value %p', (value) => {
      configService.get.mockReturnValue(value);
      expect(() => getTestableService(service).getRetentionDays('TEST_KEY', 30)).toThrow(
        'Invalid application configuration: TEST_KEY must be an integer between 1 and 3650',
      );
    });
  });

  describe('tryAcquireCleanupLock', () => {
    it('should return true when lock acquired', async () => {
      queryRunner.query.mockResolvedValue(createMockQueryResult(true));
      const result = await getTestableService(service).tryAcquireCleanupLock(queryRunner);
      expect(result).toBe(true);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_try_advisory_lock'),
        ['734928174003'],
      );
    });

    it('should return false when lock not acquired', async () => {
      queryRunner.query.mockResolvedValue(createMockQueryResult(false));
      const result = await getTestableService(service).tryAcquireCleanupLock(queryRunner);
      expect(result).toBe(false);
    });

    it('should handle empty result', async () => {
      queryRunner.query.mockResolvedValue([]);
      const result = await getTestableService(service).tryAcquireCleanupLock(queryRunner);
      expect(result).toBe(false);
    });
  });

  describe('releaseCleanupLock', () => {
    it('should not log warning when unlock succeeds', async () => {
      queryRunner.query.mockResolvedValue(createMockUnlockResult(true));
      await getTestableService(service).releaseCleanupLock(queryRunner);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warning when unlock returns false', async () => {
      queryRunner.query.mockResolvedValue(createMockUnlockResult(false));
      await getTestableService(service).releaseCleanupLock(queryRunner);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Soft-delete cleanup advisory lock was not held during explicit release',
      );
    });

    it('should log error when unlock query fails', async () => {
      const error = new Error('Unlock query failed');
      queryRunner.query.mockRejectedValueOnce(error);
      await getTestableService(service).releaseCleanupLock(queryRunner);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to explicitly release cleanup advisory lock'),
        error.stack,
      );
    });
  });
});
