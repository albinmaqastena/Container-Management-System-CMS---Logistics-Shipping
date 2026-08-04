// src/modules/containers/containers.service.spec.ts
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ContainersService } from './containers.service';
import { Container, ContainerStatus } from './entities/container.entity';
import { Item } from '../items/entities/item.entity';
import { User } from '../auth/entities/user.entity';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { FilesService } from '../files/files.service';

describe('ContainersService', () => {
  let service: ContainersService;
  let repository: jest.Mocked<Repository<Container>>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let dataSource: {
    transaction: jest.Mock;
  };
  let filesService: {
    deleteFile: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const createContainer = (overrides: Partial<Container> = {}): Container =>
    ({
      id: 'container-1',
      name: 'Test Container',
      containerCode: 'CNT-ABCD123456',
      totalVolume: 100,
      usedVolume: 0,
      status: ContainerStatus.ACTIVE,
      description: 'Test description',
      createdBy: mockUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }) as Container;

  const createQueryBuilderMock = () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getRawOne: jest.fn().mockResolvedValue({ sum: '50' }),
      getManyAndCount: jest.fn().mockResolvedValue([[createContainer()], 1]),
    };
    return qb;
  };

  type ContainerQueryBuilderMock = ReturnType<typeof createQueryBuilderMock>;

  const asContainerQueryBuilder = (
    queryBuilder: ContainerQueryBuilderMock,
  ): SelectQueryBuilder<Container> => queryBuilder as unknown as SelectQueryBuilder<Container>;

  const expectContainerCacheCleared = (id: string): void => {
    expect(cacheManager.del).toHaveBeenCalledWith(`container:${id}:false`);
    expect(cacheManager.del).toHaveBeenCalledWith(`container:${id}:true`);
    expect(cacheManager.del).toHaveBeenCalledTimes(2);
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(undefined),
    };

    filesService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainersService,
        {
          provide: getRepositoryToken(Container),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
            restore: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: DataSource, useValue: dataSource },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    service = module.get(ContainersService);
    repository = module.get(getRepositoryToken(Container));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const dto: CreateContainerDto = {
      customName: ' Test Container ',
      totalVolume: 100,
      description: ' Test description ',
    };

    it('creates a container after checking name uniqueness', async () => {
      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(uniqueNameQuery));

      const saved = createContainer();
      repository.save.mockResolvedValue(saved);

      const result = await service.create(dto, mockUser);

      expect(uniqueNameQuery.withDeleted).toHaveBeenCalled();
      expect(uniqueNameQuery.where).toHaveBeenCalledWith('LOWER(container.name) = LOWER(:name)', {
        name: 'Test Container',
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Container',
          totalVolume: 100,
          description: 'Test description',
          usedVolume: 0,
          status: ContainerStatus.ACTIVE,
          createdBy: mockUser,
        }),
      );
      expect(result).toBe(saved);
      expectContainerCacheCleared(saved.id);
    });

    it('treats names as case insensitive', async () => {
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getOne.mockResolvedValue(createContainer({ name: 'Test Container' }));
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(queryBuilder));

      await expect(
        service.create(
          {
            ...dto,
            customName: 'test container',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name', async () => {
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getOne.mockResolvedValue(createContainer());
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(queryBuilder));

      await expect(service.create(dto, mockUser)).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid total volume', async () => {
      await expect(service.create({ ...dto, totalVolume: 0 }, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('handles container name unique constraint violation (23505, uq_container_name)', async () => {
      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(uniqueNameQuery));

      const dbError = new Error('duplicate key') as Error & {
        code?: string;
        constraint?: string;
      };
      dbError.code = '23505';
      dbError.constraint = 'uq_container_name';
      repository.save.mockRejectedValue(dbError);

      await expect(service.create(dto, mockUser)).rejects.toThrow(
        'A container with this name already exists',
      );
    });

    it('handles container code unique constraint violation (23505, uq_container_code)', async () => {
      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(uniqueNameQuery));

      const dbError = new Error('duplicate key') as Error & {
        code?: string;
        constraint?: string;
      };
      dbError.code = '23505';
      dbError.constraint = 'uq_container_code';
      repository.save.mockRejectedValue(dbError);

      await expect(service.create(dto, mockUser)).rejects.toThrow(
        'A container with this code already exists',
      );
    });

    it('rethrows unknown database errors', async () => {
      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(uniqueNameQuery));

      repository.save.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.create(dto, mockUser)).rejects.toThrow('Database unavailable');
    });
  });

  describe('findAll and search', () => {
    it('returns paginated containers', async () => {
      const result = await service.findAll({
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('delegates active and archived queries to findAll', async () => {
      const pagination: PaginationDto = { limit: 10, offset: 0 };
      const spy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(new PaginatedResponseDto<Container>([], 0, 10, 0));

      await service.findActiveContainers(pagination);
      await service.findArchivedContainers(pagination);

      expect(spy).toHaveBeenCalledWith(pagination, ContainerStatus.ACTIVE);
      expect(spy).toHaveBeenCalledWith(pagination, ContainerStatus.ARCHIVED);
    });

    it('searches using a trimmed query with ESCAPE', async () => {
      const queryBuilder = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(queryBuilder));

      await service.searchContainers(' test ', { limit: 10, offset: 0 });

      const searchCall = queryBuilder.andWhere.mock.calls.find(
        ([condition]) =>
          typeof condition === 'string' && condition.includes('container.name ILIKE'),
      );

      expect(searchCall).toBeDefined();
      expect(searchCall?.[0]).toContain("container.name ILIKE :query ESCAPE '\\'");
      expect(searchCall?.[0]).toContain("container.containerCode ILIKE :query ESCAPE '\\'");
      expect(searchCall?.[0]).toContain("container.description ILIKE :query ESCAPE '\\'");
      expect(searchCall?.[1]).toEqual({
        query: '%test%',
      });
    });

    it('escapes SQL LIKE wildcard characters', async () => {
      const queryBuilder = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(queryBuilder));

      await service.searchContainers('100%_test', { limit: 10, offset: 0 });

      const searchCall = queryBuilder.andWhere.mock.calls.find(
        ([condition]) => typeof condition === 'string' && condition.includes('ILIKE'),
      );

      expect(searchCall?.[1]).toEqual({
        query: '%100\\%\\_test%',
      });
    });

    it('rejects an empty search query', async () => {
      await expect(service.searchContainers('   ', { limit: 10, offset: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects search query longer than 200 characters', async () => {
      await expect(
        service.searchContainers('a'.repeat(201), { limit: 10, offset: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns a cached container', async () => {
      const container = createContainer();
      cacheManager.get.mockResolvedValue(container);

      await expect(service.findOne(container.id)).resolves.toBe(container);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('loads and caches a container when cache is empty', async () => {
      const container = createContainer();
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(container);

      const result = await service.findOne(container.id);

      expect(result).toBe(container);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `container:${container.id}:false`,
        container,
        5 * 60 * 1000,
      );
    });

    it('throws when the container does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('continues when cache read fails', async () => {
      const container = createContainer();
      cacheManager.get.mockRejectedValue(new Error('Redis unavailable'));
      repository.findOne.mockResolvedValue(container);

      await expect(service.findOne(container.id)).resolves.toBe(container);
    });

    it('continues when cache write fails', async () => {
      const container = createContainer();
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockRejectedValue(new Error('Redis unavailable'));
      repository.findOne.mockResolvedValue(container);

      await expect(service.findOne(container.id)).resolves.toBe(container);
    });

    it('does not mask repository exception when cache read throws', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache error'));
      repository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.findOne('container-1')).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('checks uniqueness, updates, and clears cache', async () => {
      const container = createContainer();

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);

      const transactionRepository = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(lockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(uniqueNameQuery)),
        save: jest.fn().mockImplementation(async (value: Container) => value),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) {
            return transactionRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(
        createContainer({
          name: 'Updated Name',
          description: 'Updated description',
        }),
      );

      const dto: UpdateContainerDto = {
        name: ' Updated Name ',
        description: ' Updated description ',
        totalVolume: 150,
      };

      const result = await service.update(container.id, dto);

      expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(uniqueNameQuery.andWhere).toHaveBeenCalledWith('container.id != :excludeId', {
        excludeId: container.id,
      });
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          totalVolume: 150,
        }),
      );
      expect(result.name).toBe('Updated Name');
      expectContainerCacheCleared(container.id);
    });

    it('does not check uniqueness when name is unchanged', async () => {
      const container = createContainer({ name: 'Old Name' });

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn().mockImplementation(async (value: Container) => value),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(container);

      const dto: UpdateContainerDto = {
        name: ' Old Name ', // same name with whitespace
      };

      const result = await service.update(container.id, dto);

      expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      // No uniqueness check should be performed
      expect(lockQuery.andWhere).not.toHaveBeenCalledWith(
        'container.id != :excludeId',
        expect.anything(),
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Old Name',
        }),
      );
      expect(result.name).toBe('Old Name');
      expectContainerCacheCleared(container.id);
    });

    it('allows update when totalVolume equals usedVolume', async () => {
      const container = createContainer({
        totalVolume: 100,
        usedVolume: 100,
      });

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn().mockImplementation(async (value: Container) => value),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(container);

      const result = await service.update(container.id, {
        totalVolume: 100,
      });

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalVolume: 100,
        }),
      );
      expect(result.totalVolume).toBe(100);
      expectContainerCacheCleared(container.id);
    });

    it('rejects total volume below used volume', async () => {
      const container = createContainer({
        totalVolume: 100,
        usedVolume: 60,
      });

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(
        service.update(container.id, {
          totalVolume: 50,
        }),
      ).rejects.toThrow('Total volume cannot be less than used volume');

      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an empty name', async () => {
      const container = createContainer();

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(
        service.update(container.id, {
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not fail when cache invalidation fails', async () => {
      const container = createContainer();

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);

      const transactionRepository = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(lockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(uniqueNameQuery)),
        save: jest.fn().mockImplementation(async (value: Container) => value),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer({ name: 'Updated Name' }));

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.update(container.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('updateStatus', () => {
    it('updates status under a pessimistic lock with createdBy', async () => {
      const container = createContainer();

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn().mockImplementation(async (value: Container) => value),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) {
            return transactionRepository;
          }
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(
        createContainer({
          status: ContainerStatus.ARCHIVED,
        }),
      );

      const result = await service.updateStatus(container.id, ContainerStatus.ARCHIVED);

      expect(lockQuery.leftJoinAndSelect).toHaveBeenCalledWith('container.createdBy', 'createdBy');
      expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ContainerStatus.ARCHIVED,
        }),
      );
      expect(result.status).toBe(ContainerStatus.ARCHIVED);
      expectContainerCacheCleared(container.id);
    });

    it('returns existing container without saving or clearing cache when status is unchanged', async () => {
      const container = createContainer({
        status: ContainerStatus.ACTIVE,
      });

      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);

      const transactionRepository = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        save: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn(() => transactionRepository),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      const result = await service.updateStatus(container.id, ContainerStatus.ACTIVE);

      expect(result).toBe(container);
      expect(transactionRepository.save).not.toHaveBeenCalled();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('transactional delete and restore operations', () => {
    it('soft deletes items and container under a pessimistic lock', async () => {
      const container = createContainer();
      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);
      lockQuery.getMany.mockResolvedValue([]);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(lockQuery)),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const itemLockQuery = createQueryBuilderMock();
      itemLockQuery.getMany.mockResolvedValue([]);

      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(itemLockQuery)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.softDelete(container.id);

      expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(itemLockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');

      const updateCriteria = itemRepo.update.mock.calls[0][0];
      expect(updateCriteria).toEqual(
        expect.objectContaining({
          containerId: container.id,
        }),
      );
      expect(updateCriteria).not.toHaveProperty('deletedByContainer');
      expect(itemRepo.update.mock.calls[0][1]).toEqual({
        deletedByContainer: true,
      });

      expect(itemRepo.update).toHaveBeenCalledTimes(1);

      const softDeleteCriteria = itemRepo.softDelete.mock.calls[0][0];
      expect(softDeleteCriteria).toEqual(
        expect.objectContaining({
          containerId: container.id,
        }),
      );
      expect(softDeleteCriteria.deletedAt).toBeDefined();

      expect(containerRepo.softDelete).toHaveBeenCalledWith(container.id);
      expectContainerCacheCleared(container.id);
    });

    it('throws when soft delete affects no container', async () => {
      const container = createContainer();
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(container);
      const itemLockQuery = createQueryBuilderMock();

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        softDelete: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(itemLockQuery)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.softDelete(container.id)).rejects.toThrow(
        'Container could not be soft-deleted',
      );
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws when container is missing during soft delete', async () => {
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(null);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        softDelete: jest.fn(),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
      expect(containerRepo.softDelete).not.toHaveBeenCalled();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('restores container and items, recalculates used volume, then reloads container', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
      });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);

      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(0);

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '40' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(activeItemsQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(volumeQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer({ usedVolume: 40 }));

      const result = await service.restore(deletedContainer.id);

      expect(containerLockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerLockQuery.withDeleted).toHaveBeenCalled();

      expect(activeItemsQuery.getCount).toHaveBeenCalled();

      expect(volumeQuery.where).toHaveBeenCalledWith('item.containerId = :containerId', {
        containerId: deletedContainer.id,
      });
      expect(volumeQuery.andWhere).toHaveBeenCalledWith('item.deletedAt IS NOT NULL');
      expect(volumeQuery.andWhere).toHaveBeenNthCalledWith(2, 'item.deletedByContainer = true');
      expect(volumeQuery.withDeleted).toHaveBeenCalled();

      expect(containerRepo.restore).toHaveBeenCalledWith(deletedContainer.id);

      expect(itemRepo.restore).toHaveBeenCalledWith({
        containerId: deletedContainer.id,
        deletedByContainer: true,
      });

      expect(itemRepo.update).toHaveBeenCalledWith(
        {
          containerId: deletedContainer.id,
          deletedByContainer: true,
          deletedAt: expect.anything(),
        },
        {
          deletedByContainer: false,
        },
      );

      expect(containerRepo.update).toHaveBeenCalledWith(deletedContainer.id, {
        usedVolume: 40,
      });
      expect(result.usedVolume).toBe(40);
      expectContainerCacheCleared(deletedContainer.id);
    });

    it('throws when container restore affects no rows', async () => {
      const deletedContainer = createContainer({ deletedAt: new Date() });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);
      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(0);
      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '40' });
      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 0 }),
        update: jest.fn(),
      };
      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(activeItemsQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(volumeQuery)),
        restore: jest.fn(),
        update: jest.fn(),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore(deletedContainer.id)).rejects.toThrow(
        'Container could not be restored',
      );
      expect(itemRepo.restore).not.toHaveBeenCalled();
      expect(containerRepo.update).not.toHaveBeenCalled();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws when container is missing during restore', async () => {
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(null);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('missing')).rejects.toThrow(NotFoundException);
    });

    it('rejects restoring an active container', async () => {
      const activeContainer = createContainer({ deletedAt: null });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(activeContainer);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore(activeContainer.id)).rejects.toThrow('Container is not deleted');
    });

    it('does not fail restore when cache invalidation fails', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
      });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);

      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(0);

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '40' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(activeItemsQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(volumeQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer({ usedVolume: 40 }));

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      await expect(service.restore(deletedContainer.id)).resolves.toBeDefined();
    });

    it('rejects restore when the container has active items', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
      });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);

      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(1);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(activeItemsQuery)),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore(deletedContainer.id)).rejects.toThrow(BadRequestException);
    });

    it('rejects restore when restored items exceed capacity', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
        totalVolume: 100,
      });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);

      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(0);

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '150' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        restore: jest.fn(),
        update: jest.fn(),
      };

      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(activeItemsQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(volumeQuery)),
        restore: jest.fn(),
        update: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore(deletedContainer.id)).rejects.toThrow(BadRequestException);

      expect(containerRepo.restore).not.toHaveBeenCalled();
      expect(itemRepo.restore).not.toHaveBeenCalled();
    });

    it('allows restore when usedVolume equals totalVolume', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
        totalVolume: 100,
      });

      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);

      const activeItemsQuery = createQueryBuilderMock();
      activeItemsQuery.getCount.mockResolvedValue(0);

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '100' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(activeItemsQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(volumeQuery)),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer({ usedVolume: 100 }));

      const result = await service.restore(deletedContainer.id);
      expect(result.usedVolume).toBe(100);
    });

    it('permanently deletes child items before the container (with query builder lock)', async () => {
      const container = createContainer({ deletedAt: new Date() });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(container);

      const itemPhotoQuery = createQueryBuilderMock();
      itemPhotoQuery.getMany.mockResolvedValue([
        {
          id: 'item-1',
          photo: '/uploads/item-1.jpg',
        },
      ]);

      const itemDeleteQuery = createQueryBuilderMock();
      itemDeleteQuery.execute.mockResolvedValue({ affected: 3 });

      const containerDeleteQuery = createQueryBuilderMock();
      containerDeleteQuery.execute.mockResolvedValue({ affected: 1 });

      const containerRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(containerLockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(containerDeleteQuery)),
      };
      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(itemPhotoQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(itemDeleteQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.permanentDelete(container.id);

      expect(containerLockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerLockQuery.withDeleted).toHaveBeenCalled();

      expect(itemPhotoQuery.select).toHaveBeenCalledWith(['item.id', 'item.photo']);
      expect(itemPhotoQuery.where).toHaveBeenCalledWith('item.containerId = :id', {
        id: container.id,
      });

      expect(filesService.deleteFile).toHaveBeenCalledWith('/uploads/item-1.jpg');

      expect(itemDeleteQuery.where).toHaveBeenCalledWith('containerId = :id', { id: container.id });
      expect(itemDeleteQuery.execute).toHaveBeenCalledTimes(1);

      expect(containerDeleteQuery.where).toHaveBeenCalledWith('id = :id', { id: container.id });
      expect(containerDeleteQuery.execute).toHaveBeenCalledTimes(1);

      const itemExecutionOrder = itemDeleteQuery.execute.mock.invocationCallOrder[0];
      const containerExecutionOrder = containerDeleteQuery.execute.mock.invocationCallOrder[0];

      if (itemExecutionOrder === undefined || containerExecutionOrder === undefined) {
        throw new Error('Expected both delete queries to execute');
      }

      expect(itemExecutionOrder).toBeLessThan(containerExecutionOrder);

      expectContainerCacheCleared(container.id);
    });

    it('does not fail permanent deletion when a file is already missing', async () => {
      const container = createContainer({ deletedAt: new Date() });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(container);

      const itemPhotoQuery = createQueryBuilderMock();
      itemPhotoQuery.getMany.mockResolvedValue([
        {
          id: 'item-1',
          photo: '/uploads/item-1.jpg',
        },
      ]);

      const itemDeleteQuery = createQueryBuilderMock();
      itemDeleteQuery.execute.mockResolvedValue({ affected: 1 });

      const containerDeleteQuery = createQueryBuilderMock();
      containerDeleteQuery.execute.mockResolvedValue({ affected: 1 });

      const containerRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(containerLockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(containerDeleteQuery)),
      };
      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(itemPhotoQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(itemDeleteQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      filesService.deleteFile.mockRejectedValue(new NotFoundException('File not found'));

      await expect(service.permanentDelete(container.id)).resolves.toBeUndefined();
    });

    it('continues file deletion when a generic error occurs', async () => {
      const container = createContainer({ deletedAt: new Date() });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(container);

      const itemPhotoQuery = createQueryBuilderMock();
      itemPhotoQuery.getMany.mockResolvedValue([
        {
          id: 'item-1',
          photo: '/uploads/item-1.jpg',
        },
      ]);

      const itemDeleteQuery = createQueryBuilderMock();
      itemDeleteQuery.execute.mockResolvedValue({ affected: 1 });

      const containerDeleteQuery = createQueryBuilderMock();
      containerDeleteQuery.execute.mockResolvedValue({ affected: 1 });

      const containerRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(containerLockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(containerDeleteQuery)),
      };
      const itemRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(itemPhotoQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(itemDeleteQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      filesService.deleteFile.mockRejectedValue(new Error('Storage unavailable'));

      await expect(service.permanentDelete(container.id)).resolves.toBeUndefined();
    });

    it('rejects permanent deletion of an active container', async () => {
      const activeContainer = createContainer({ deletedAt: null });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(activeContainer);
      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete(activeContainer.id)).rejects.toThrow(
        'Container must be soft-deleted before permanent deletion',
      );
    });

    it('throws when permanent deletion affects no container', async () => {
      const deletedContainer = createContainer({ deletedAt: new Date() });
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(deletedContainer);
      const itemDeleteQuery = createQueryBuilderMock();
      const containerDeleteQuery = createQueryBuilderMock();
      containerDeleteQuery.execute.mockResolvedValue({ affected: 0 });
      const containerRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(asContainerQueryBuilder(containerLockQuery))
          .mockReturnValueOnce(asContainerQueryBuilder(containerDeleteQuery)),
      };
      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(itemDeleteQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete(deletedContainer.id)).rejects.toThrow(
        'Container could not be permanently deleted',
      );
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws when container is missing during permanent delete', async () => {
      const containerLockQuery = createQueryBuilderMock();
      containerLockQuery.getOne.mockResolvedValue(null);
      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerLockQuery)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDeleted', () => {
    it('returns deleted containers and uses withDeleted', async () => {
      const deleted = createContainer({ deletedAt: new Date() });
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getManyAndCount.mockResolvedValue([[deleted], 1]);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(queryBuilder));

      const result = await service.findDeleted({ limit: 10, offset: 0 });

      expect(queryBuilder.withDeleted).toHaveBeenCalled();
      expect(result.data).toEqual([deleted]);
      expect(result.total).toBe(1);
    });
  });

  describe('updateUsedVolume', () => {
    it('recalculates used volume inside a transaction', async () => {
      const containerQuery = createQueryBuilderMock();
      containerQuery.getOne.mockResolvedValue(
        createContainer({
          totalVolume: 100,
        }),
      );

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '50' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerQuery)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(volumeQuery)),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.updateUsedVolume('container-1');

      expect(containerQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerRepo.update).toHaveBeenCalledWith('container-1', {
        usedVolume: 50,
      });
      expectContainerCacheCleared('container-1');
    });

    it('rejects used volume above capacity', async () => {
      const containerQuery = createQueryBuilderMock();
      containerQuery.getOne.mockResolvedValue(
        createContainer({
          totalVolume: 100,
        }),
      );

      const volumeQuery = createQueryBuilderMock();
      volumeQuery.getRawOne.mockResolvedValue({ sum: '150' });

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerQuery)),
        update: jest.fn(),
      };

      const itemRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(volumeQuery)),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          if (entity === Item) return itemRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.updateUsedVolume('container-1')).rejects.toThrow(BadRequestException);
      expect(containerRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when container is missing', async () => {
      const containerQuery = createQueryBuilderMock();
      containerQuery.getOne.mockResolvedValue(null);

      const containerRepo = {
        createQueryBuilder: jest.fn(() => asContainerQueryBuilder(containerQuery)),
      };

      const manager = {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Container) return containerRepo;
          throw new Error(`Unexpected repository: ${String(entity)}`);
        }),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.updateUsedVolume('container-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cache failure', () => {
    it('does not fail create when cache invalidation fails', async () => {
      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(uniqueNameQuery));

      const saved = createContainer();
      repository.save.mockResolvedValue(saved);

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.create(
        {
          customName: 'Test Container',
          totalVolume: 100,
        },
        mockUser,
      );

      expect(result).toBe(saved);
    });
  });

  describe('cleanupExpiredContainers', () => {
    it.each([0, -1, 1.5, 3651, NaN])('rejects invalid retention %p', async (retentionDays) => {
      await expect(service.cleanupExpiredContainers(retentionDays)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns zero when no expired containers exist', async () => {
      const cleanupQuery = createQueryBuilderMock();
      cleanupQuery.getMany.mockResolvedValue([]);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(cleanupQuery));

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(0);
      expect(cleanupQuery.withDeleted).toHaveBeenCalled();
      expect(cleanupQuery.select).toHaveBeenCalledWith(['container.id', 'container.deletedAt']);
      expect(cleanupQuery.andWhere).toHaveBeenCalledWith('container.deletedAt < :cutoffDate', {
        cutoffDate: expect.any(Date),
      });
      expect(cleanupQuery.take).toHaveBeenCalledWith(25);
    });

    it('permanently deletes expired containers with cursor', async () => {
      const deletedAt = new Date();
      const firstBatch = [
        createContainer({ id: 'container-1', deletedAt }),
        createContainer({ id: 'container-2', deletedAt }),
      ];
      const firstQuery = createQueryBuilderMock();
      firstQuery.getMany.mockResolvedValue(firstBatch);

      const secondQuery = createQueryBuilderMock();
      secondQuery.getMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(asContainerQueryBuilder(firstQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(secondQuery));

      const permanentDeleteSpy = jest
        .spyOn(service, 'permanentDelete')
        .mockResolvedValue(undefined);

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(2);
      expect(permanentDeleteSpy).toHaveBeenCalledTimes(2);
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
    });

    it('continues when one expired container fails', async () => {
      const deletedAt = new Date();
      const firstBatch = [
        createContainer({ id: 'container-fail', deletedAt }),
        createContainer({ id: 'container-ok', deletedAt }),
      ];
      const firstQuery = createQueryBuilderMock();
      firstQuery.getMany.mockResolvedValue(firstBatch);

      const secondQuery = createQueryBuilderMock();
      secondQuery.getMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(asContainerQueryBuilder(firstQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(secondQuery));

      jest
        .spyOn(service, 'permanentDelete')
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(1);
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
    });

    it('advances the cursor even when all deletions in a batch fail', async () => {
      const deletedAt = new Date();
      const firstBatch = [createContainer({ id: 'container-fail', deletedAt })];
      const firstQuery = createQueryBuilderMock();
      firstQuery.getMany.mockResolvedValue(firstBatch);

      const secondQuery = createQueryBuilderMock();
      secondQuery.getMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(asContainerQueryBuilder(firstQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(secondQuery));

      jest.spyOn(service, 'permanentDelete').mockRejectedValue(new Error('Delete failed'));

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(0);
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(secondQuery.andWhere).toHaveBeenCalled();
    });

    it('advances the cursor when the 25th container in a batch fails', async () => {
      const deletedAt = new Date();
      const firstBatch = Array.from({ length: 25 }, (_, index) =>
        createContainer({
          id: `container-${index + 1}`,
          deletedAt,
        }),
      );
      // Make the last one fail
      const firstQuery = createQueryBuilderMock();
      firstQuery.getMany.mockResolvedValue(firstBatch);

      const secondBatch = [createContainer({ id: 'container-26', deletedAt })];
      const secondQuery = createQueryBuilderMock();
      secondQuery.getMany.mockResolvedValue(secondBatch);

      const thirdQuery = createQueryBuilderMock();
      thirdQuery.getMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(asContainerQueryBuilder(firstQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(secondQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(thirdQuery));

      jest.spyOn(service, 'permanentDelete').mockImplementation(async (id) => {
        if (id === 'container-25') {
          throw new Error('Delete failed');
        }
      });

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(25);
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(3);
      // Cursor should have advanced to container-25, then to container-26
      expect(secondQuery.andWhere).toHaveBeenCalledWith(expect.anything());
    });

    it('processes multiple cleanup batches', async () => {
      const deletedAt = new Date();
      const firstBatch = Array.from({ length: 25 }, (_, index) =>
        createContainer({
          id: `container-${index + 1}`,
          deletedAt,
        }),
      );
      const secondBatch = [
        createContainer({
          id: 'container-26',
          deletedAt,
        }),
      ];

      const firstQuery = createQueryBuilderMock();
      firstQuery.getMany.mockResolvedValue(firstBatch);

      const secondQuery = createQueryBuilderMock();
      secondQuery.getMany.mockResolvedValue(secondBatch);

      const thirdQuery = createQueryBuilderMock();
      thirdQuery.getMany.mockResolvedValue([]);

      repository.createQueryBuilder
        .mockReturnValueOnce(asContainerQueryBuilder(firstQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(secondQuery))
        .mockReturnValueOnce(asContainerQueryBuilder(thirdQuery));

      const deleteSpy = jest.spyOn(service, 'permanentDelete').mockResolvedValue(undefined);

      const result = await service.cleanupExpiredContainers(30);

      expect(result).toBe(26);
      expect(deleteSpy).toHaveBeenCalledTimes(26);
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(3);
    });

    it('queries containers older than the retention cutoff', async () => {
      const cleanupQuery = createQueryBuilderMock();
      cleanupQuery.getMany.mockResolvedValue([]);
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(cleanupQuery));

      await service.cleanupExpiredContainers(30);

      expect(cleanupQuery.andWhere).toHaveBeenCalledWith('container.deletedAt < :cutoffDate', {
        cutoffDate: expect.any(Date),
      });
    });

    it('rethrows repository errors', async () => {
      const cleanupQuery = createQueryBuilderMock();
      cleanupQuery.getMany.mockRejectedValue(new Error('Database unavailable'));
      repository.createQueryBuilder.mockReturnValue(asContainerQueryBuilder(cleanupQuery));

      await expect(service.cleanupExpiredContainers(30)).rejects.toThrow('Database unavailable');
    });
  });
});
