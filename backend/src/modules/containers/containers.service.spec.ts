// src/modules/containers/containers.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ContainersService } from './containers.service';
import { Container, ContainerStatus } from './entities/container.entity';
import { Item } from '../items/entities/item.entity';
import { User } from '../auth/entities/user.entity';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';

describe('ContainersService', () => {
  let service: ContainersService;
  let repository: jest.Mocked<Repository<Container>>;
  let itemRepository: jest.Mocked<Repository<Item>>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let dataSource: { transaction: jest.Mock };

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
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }) as Container;

  const createQueryBuilderMock = (): any => ({
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
    getRawOne: jest.fn().mockResolvedValue({ sum: '50' }),
    getManyAndCount: jest.fn().mockResolvedValue([[createContainer()], 1]),
  });

  const expectContainerCacheCleared = (id: string): void => {
    expect(cacheManager.del).toHaveBeenCalledWith('containers:all');
    expect(cacheManager.del).toHaveBeenCalledWith('containers:active');
    expect(cacheManager.del).toHaveBeenCalledWith('containers:archived');
    expect(cacheManager.del).toHaveBeenCalledWith('containers:deleted');
    expect(cacheManager.del).toHaveBeenCalledWith(`container:${id}:false`);
    expect(cacheManager.del).toHaveBeenCalledWith(`container:${id}:true`);
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(undefined),
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
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
          },
        },
        {
          provide: getRepositoryToken(Item),
          useValue: {
            createQueryBuilder: jest.fn(() => createQueryBuilderMock()),
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ContainersService);
    repository = module.get(getRepositoryToken(Container));
    itemRepository = module.get(getRepositoryToken(Item));
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
      repository.createQueryBuilder.mockReturnValue(uniqueNameQuery);

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

    it('rejects a duplicate name', async () => {
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getOne.mockResolvedValue(createContainer());
      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.create(dto, mockUser)).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid total volume', async () => {
      await expect(service.create({ ...dto, totalVolume: 0 }, mockUser)).rejects.toThrow(
        BadRequestException,
      );
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

    it('searches using a trimmed query', async () => {
      const queryBuilder = createQueryBuilderMock();
      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.searchContainers(' test ', { limit: 10, offset: 0 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(container.name ILIKE :query OR container.containerCode ILIKE :query OR container.description ILIKE :query)',
        { query: '%test%' },
      );
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
        300,
      );
    });

    it('throws when the container does not exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('checks uniqueness, updates, and clears both cache variants', async () => {
      const container = createContainer();
      jest.spyOn(service, 'findOne').mockResolvedValue(container);

      const uniqueNameQuery = createQueryBuilderMock();
      uniqueNameQuery.getOne.mockResolvedValue(null);
      repository.createQueryBuilder.mockReturnValue(uniqueNameQuery);

      const updated = createContainer({ name: 'Updated Name' });
      repository.save.mockResolvedValue(updated);

      const dto: UpdateContainerDto = {
        name: ' Updated Name ',
        description: ' Updated description ',
      };
      const result = await service.update(container.id, dto);

      expect(uniqueNameQuery.andWhere).toHaveBeenCalledWith('container.id != :excludeId', {
        excludeId: container.id,
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
        }),
      );
      expect(result).toBe(updated);
      expectContainerCacheCleared(container.id);
    });

    it('rejects an empty name', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer());

      await expect(service.update('container-1', { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatus', () => {
    it('loads without cache, saves the new status, and clears cache', async () => {
      const container = createContainer();
      jest.spyOn(service, 'findOneWithoutCache').mockResolvedValue(container);
      repository.save.mockResolvedValue(createContainer({ status: ContainerStatus.ARCHIVED }));

      const result = await service.updateStatus(container.id, ContainerStatus.ARCHIVED);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContainerStatus.ARCHIVED }),
      );
      expect(result.status).toBe(ContainerStatus.ARCHIVED);
      expectContainerCacheCleared(container.id);
    });
  });

  describe('transactional delete and restore operations', () => {
    it('soft deletes items and container under a pessimistic lock', async () => {
      const container = createContainer();
      const lockQuery = createQueryBuilderMock();
      lockQuery.getOne.mockResolvedValue(container);
      const containerRepo = {
        createQueryBuilder: jest.fn(() => lockQuery),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const itemRepo = {
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const manager = {
        getRepository: jest.fn((entity) => (entity === Container ? containerRepo : itemRepo)),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.softDelete(container.id);

      expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(itemRepo.softDelete).toHaveBeenCalledWith({
        containerId: container.id,
      });
      expect(containerRepo.softDelete).toHaveBeenCalledWith(container.id);
      expectContainerCacheCleared(container.id);
    });

    it('restores container and items, recalculates used volume, then reloads container', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
        items: [{ id: 'item-1', deletedAt: new Date() } as Item],
      });
      const itemVolumeQuery = createQueryBuilderMock();
      itemVolumeQuery.getRawOne.mockResolvedValue({ sum: '40' });
      const containerRepo = {
        findOne: jest.fn().mockResolvedValue(deletedContainer),
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const itemRepo = {
        restore: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(() => itemVolumeQuery),
      };
      const manager = {
        getRepository: jest.fn((entity) => (entity === Container ? containerRepo : itemRepo)),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));
      jest.spyOn(service, 'findOne').mockResolvedValue(createContainer({ usedVolume: 40 }));

      const result = await service.restore(deletedContainer.id);

      expect(containerRepo.restore).toHaveBeenCalledWith(deletedContainer.id);
      expect(itemRepo.restore).toHaveBeenCalledWith({
        containerId: deletedContainer.id,
      });
      expect(containerRepo.update).toHaveBeenCalledWith(deletedContainer.id, {
        usedVolume: 40,
      });
      expect(result.usedVolume).toBe(40);
      expectContainerCacheCleared(deletedContainer.id);
    });

    it('rejects restore when the container has active items', async () => {
      const deletedContainer = createContainer({
        deletedAt: new Date(),
        items: [{ id: 'item-1', deletedAt: null } as Item],
      });
      const containerRepo = {
        findOne: jest.fn().mockResolvedValue(deletedContainer),
      };
      const manager = {
        getRepository: jest.fn(() => containerRepo),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore(deletedContainer.id)).rejects.toThrow(BadRequestException);
    });

    it('permanently deletes child items before the container', async () => {
      const container = createContainer({ deletedAt: new Date() });
      const itemDeleteQuery = createQueryBuilderMock();
      const containerDeleteQuery = createQueryBuilderMock();
      const containerRepo = {
        findOne: jest.fn().mockResolvedValue(container),
        createQueryBuilder: jest.fn(() => containerDeleteQuery),
      };
      const itemRepo = {
        createQueryBuilder: jest.fn(() => itemDeleteQuery),
      };
      const manager = {
        getRepository: jest.fn((entity) => (entity === Container ? containerRepo : itemRepo)),
      };
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.permanentDelete(container.id);

      expect(itemDeleteQuery.where).toHaveBeenCalledWith('containerId = :id', {
        id: container.id,
      });
      expect(itemDeleteQuery.execute).toHaveBeenCalled();
      expect(containerDeleteQuery.where).toHaveBeenCalledWith('id = :id', {
        id: container.id,
      });
      expect(containerDeleteQuery.execute).toHaveBeenCalled();
      expectContainerCacheCleared(container.id);
    });
  });

  describe('findDeleted', () => {
    it('returns deleted containers', async () => {
      const deleted = createContainer({ deletedAt: new Date() });
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getManyAndCount.mockResolvedValue([[deleted], 1]);
      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findDeleted({ limit: 10, offset: 0 });

      expect(result.data).toEqual([deleted]);
      expect(result.total).toBe(1);
    });
  });

  describe('updateUsedVolume', () => {
    it('recalculates used volume and clears cache', async () => {
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getRawOne.mockResolvedValue({ sum: '50' });
      itemRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      jest
        .spyOn(service, 'findOneWithoutCache')
        .mockResolvedValue(createContainer({ totalVolume: 100 }));
      repository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateUsedVolume('container-1');

      expect(repository.update).toHaveBeenCalledWith('container-1', {
        usedVolume: 50,
      });
      expectContainerCacheCleared('container-1');
    });

    it('rejects a used volume above capacity', async () => {
      const queryBuilder = createQueryBuilderMock();
      queryBuilder.getRawOne.mockResolvedValue({ sum: '150' });
      itemRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      jest
        .spyOn(service, 'findOneWithoutCache')
        .mockResolvedValue(createContainer({ totalVolume: 100 }));

      await expect(service.updateUsedVolume('container-1')).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
