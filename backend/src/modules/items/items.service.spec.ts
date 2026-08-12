// src/modules/items/items.service.spec.ts
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { Container, ContainerStatus } from '../containers/entities/container.entity';
import { User } from '../auth/entities/user.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FilesService } from '../files/files.service';

describe('ItemsService', () => {
  let service: ItemsService;
  let itemRepository: jest.Mocked<Repository<Item>>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let dataSource: {
    transaction: jest.Mock;
  };
  let filesService: jest.Mocked<
    Pick<FilesService, 'deleteFile' | 'getSignedFileUrl'>
  >;

  const mockUser = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const createMockContainer = (overrides: Partial<Container> = {}): Container => ({
    id: 'container-1',
    name: 'Test Container',
    containerCode: 'CNT-TEST1234',
    totalVolume: 100,
    usedVolume: 0,
    availableVolume: 100,
    status: ContainerStatus.ACTIVE,
    description: 'Test container',
    createdBy: mockUser,
    createdById: mockUser.id,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  const mockContainer = createMockContainer();

  const createMockItem = (overrides: Partial<Item> = {}): Item => ({
    id: 'item-1',
    uniqueNumber: 'ITEM-001',
    name: 'Test Item',
    photo: null,
    packageQuantity: 5,
    productsPerPackage: 10,
    packagePrice: 100.5,
    volume: 2.5,
    totalVolume: 12.5,
    container: mockContainer,
    containerId: mockContainer.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedByContainer: false,
    calculateTotalVolume: jest.fn(),
    ...overrides,
  });

  const mockItem = createMockItem();

  const createListQueryBuilder = (): any => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockItem], 1]),
  });

  const createEntityQueryBuilder = (): any => ({
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  });

  const createSumQueryBuilder = (sum = '0'): any => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ sum }),
  });

  const createManagerMocks = () => {
    const itemRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const containerRepo = {
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Item) return itemRepo;
        if (entity === Container) return containerRepo;
        throw new Error('Unexpected repository');
      }),
    };

    return { manager, itemRepo, containerRepo };
  };

  // Helper to setup permanentDelete scenario
  const setupPermanentDeleteScenario = (itemOverrides: Partial<Item> = {}) => {
    const { manager, itemRepo, containerRepo } = createManagerMocks();
    const deletedItem = createMockItem({
      deletedAt: new Date(),
      deletedByContainer: false,
      photo: 'items/photo.jpg',
      ...itemOverrides,
    });
    const itemLockQb = createEntityQueryBuilder();
    const containerLockQb = createEntityQueryBuilder();
    const recalculateQb = createSumQueryBuilder('0');

    itemRepo.findOne.mockResolvedValue(deletedItem);
    itemLockQb.getOne.mockResolvedValue(deletedItem);
    containerLockQb.getOne.mockResolvedValue(mockContainer);

    itemRepo.createQueryBuilder.mockReturnValueOnce(itemLockQb).mockReturnValueOnce(recalculateQb);

    containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);
    itemRepo.remove.mockResolvedValue(deletedItem);
    containerRepo.update.mockResolvedValue({ affected: 1 });

    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    return {
      manager,
      itemRepo,
      containerRepo,
      deletedItem,
      itemLockQb,
      containerLockQb,
      recalculateQb,
    };
  };

  let loggerErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
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

    dataSource = {
      transaction: jest.fn(),
    };

    filesService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),

      getSignedFileUrl: jest.fn().mockImplementation(
        async (filePathOrUrl: string) =>
          `https://signed.example.com/${filePathOrUrl}`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          provide: getRepositoryToken(Item),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => createListQueryBuilder()),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: FilesService,
          useValue: filesService,
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    itemRepository = module.get(getRepositoryToken(Item));

    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateItemDto = {
      uniqueNumber: 'ITEM-002',
      name: 'New Item',
      packageQuantity: 3,
      productsPerPackage: 5,
      packagePrice: 50,
      volume: 1.5,
      containerId: 'container-1',
    };

    it('should create an item inside a transaction and clear cache', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      const savedItem = createMockItem({ ...dto, totalVolume: 4.5 });
      const containerWithUsedVolume = createMockContainer({ usedVolume: 10 });

      containerQb.getOne.mockResolvedValue(containerWithUsedVolume);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);

      itemRepo.create.mockReturnValue(savedItem);
      itemRepo.save.mockResolvedValue(savedItem);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      itemRepository.findOne.mockResolvedValue(savedItem);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      const result = await service.create(dto);

      expect(result).toEqual(savedItem);
      expect(containerQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uniqueNumber: dto.uniqueNumber,
          totalVolume: 4.5,
          containerId: containerWithUsedVolume.id,
          deletedByContainer: false,
        }),
      );
      expect(containerRepo.update).toHaveBeenCalledWith(containerWithUsedVolume.id, {
        usedVolume: 14.5,
      });
      expect(cacheManager.del).toHaveBeenCalledWith('container:container-1:false');
      expect(cacheManager.del).toHaveBeenCalledWith('container:container-1:true');
      expect(cacheManager.del).toHaveBeenCalledWith('items:container:container-1');
      expect(itemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when container does not exist', async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(null);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when total volume is invalid', async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create({ ...dto, packageQuantity: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when container has insufficient capacity', async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      const fullContainer = createMockContainer({
        totalVolume: 100,
        usedVolume: 99,
      });
      containerQb.getOne.mockResolvedValue(fullContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should convert database duplicate error to ConflictException with constraint', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.create.mockReturnValue(createMockItem());
      itemRepo.save.mockRejectedValue({ code: '23505', constraint: 'items_uniqueNumber_key' });
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should reject creation when container is not ACTIVE', async () => {
      const { manager, containerRepo } = createManagerMocks();
      const archivedContainer = createMockContainer({
        status: ContainerStatus.ARCHIVED,
      });
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(archivedContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow(
        'Items can only be created in active containers',
      );
    });

    it('should rethrow unknown database errors during create', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.create.mockReturnValue(createMockItem());
      itemRepo.save.mockRejectedValue(new Error('Database unavailable'));
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow('Database unavailable');
    });

    it.each(['abc', -1, Infinity, NaN, '', null, undefined])(
      'should reject invalid container usedVolume: %p',
      async (usedVolume) => {
        const { manager, containerRepo } = createManagerMocks();
        const containerQb = createEntityQueryBuilder();

        containerQb.getOne.mockResolvedValue(
          createMockContainer({
            usedVolume: usedVolume as unknown as number,
          }),
        );

        containerRepo.createQueryBuilder.mockReturnValue(containerQb);

        dataSource.transaction.mockImplementation(async (callback) => callback(manager));

        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      },
    );

    it('should reject create when container totalVolume is invalid', async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      const invalidContainer = createMockContainer({
        totalVolume: null as unknown as number,
      });
      containerQb.getOne.mockResolvedValue(invalidContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll and search', () => {
    it('should return paginated items', async () => {
      const paginationDto: PaginationDto = {
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      };

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should attach presigned photoUrl values to list items', async () => {
      const itemWithPhoto = createMockItem({
        photo: 'items/list-photo.jpg',
      });

      const qb = createListQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[itemWithPhoto], 1]);
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        limit: 10,
        offset: 0,
      });

      expect(result.data[0]?.photo).toBe('items/list-photo.jpg');
      expect(result.data[0]?.photoUrl).toBe(
        'https://signed.example.com/items/list-photo.jpg',
      );

      expect(filesService.getSignedFileUrl).toHaveBeenCalledWith(
        'items/list-photo.jpg',
      );
    });

    it('should sort deletedAt DESC with NULLS LAST', async () => {
      const qb = createListQueryBuilder();

      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(
        {
          limit: 10,
          offset: 0,
          sort: 'deletedAt:DESC',
        },
        undefined,
        true,
      );

      expect(qb.addOrderBy).toHaveBeenCalledWith('item.deletedAt', 'DESC', 'NULLS LAST');
    });

    it('should use default sort when sort is undefined', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 10, offset: 0 });

      expect(qb.addOrderBy).toHaveBeenCalledWith('item.id', 'DESC');
    });

    it('should support multi-sort with createdAt and name', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC,name:ASC',
      });

      expect(qb.addOrderBy).toHaveBeenNthCalledWith(1, 'item.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenNthCalledWith(2, 'item.name', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('item.id', 'DESC');
    });

    it('should support filtering and including deleted items', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 10, offset: 0 }, 'container-1', true);

      expect(qb.withDeleted).toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith('item.containerId = :containerId', {
        containerId: 'container-1',
      });
    });

    it('should search items and include the container relation', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchItems('test', {
        limit: 10,
        offset: 0,
      });

      expect(result.data).toHaveLength(1);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('item.container', 'container');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(item.name ILIKE :query OR item.uniqueNumber ILIKE :query)',
        {
          query: '%test%',
        },
      );
    });

    it('should return deleted items', async () => {
      const deletedItem = createMockItem({ deletedAt: new Date() });
      const qb = createListQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[deletedItem], 1]);
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findDeleted({ limit: 10, offset: 0 });

      expect(result.data).toEqual([deletedItem]);
      expect(result.hasMore).toBe(false);
      expect(qb.withDeleted).toHaveBeenCalled();
    });

    it('should add id as a deterministic sort tie-breaker', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      });

      expect(qb.addOrderBy).toHaveBeenCalledWith('item.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('item.id', 'DESC');
    });

    it('should not add id tie-breaker when id is already sorted', async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({
        limit: 10,
        offset: 0,
        sort: 'id:ASC',
      });

      expect(qb.addOrderBy).toHaveBeenCalledWith('item.id', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledTimes(1);
    });

    it('should reject empty search query', async () => {
      await expect(service.searchItems('   ', { limit: 10, offset: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject search query longer than 200 characters', async () => {
      await expect(service.searchItems('a'.repeat(201), { limit: 10, offset: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return an active item from database', async () => {
      itemRepository.findOne.mockResolvedValue(mockItem);

      const result = await service.findOne('item-1');

      expect(result).toBe(mockItem);
      const options = itemRepository.findOne.mock.calls[0][0];
      expect(options).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'item-1' }),
          withDeleted: false,
        }),
      );
    });

    it('should generate a presigned photoUrl when the item has a photo', async () => {
      const itemWithPhoto = createMockItem({
        photo: 'items/photo.jpg',
      });

      itemRepository.findOne.mockResolvedValue(itemWithPhoto);

      const result = await service.findOne('item-1');

      expect(result.photo).toBe('items/photo.jpg');
      expect(result.photoUrl).toBe(
        'https://signed.example.com/items/photo.jpg',
      );

      expect(filesService.getSignedFileUrl).toHaveBeenCalledWith(
        'items/photo.jpg',
      );
    });

    it('should return photoUrl null without signing when the item has no photo', async () => {
      const itemWithoutPhoto = createMockItem({
        photo: null,
      });

      itemRepository.findOne.mockResolvedValue(itemWithoutPhoto);

      const result = await service.findOne('item-1');

      expect(result.photoUrl).toBeNull();
      expect(filesService.getSignedFileUrl).not.toHaveBeenCalled();
    });

    it('should include deleted items when requested', async () => {
      const deletedItem = createMockItem({ deletedAt: new Date() });
      itemRepository.findOne.mockResolvedValue(deletedItem);

      const result = await service.findOne('item-1', true);

      expect(result).toBe(deletedItem);
      const options = itemRepository.findOne.mock.calls[0][0];
      expect(options).toEqual(
        expect.objectContaining({
          where: { id: 'item-1' },
          withDeleted: true,
        }),
      );
    });

    it('should throw when item is not found', async () => {
      itemRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an item with locks and recalculate volume', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');
      const item = createMockItem();
      const updated = createMockItem({ name: 'Updated Item' });

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      itemRepository.findOne.mockResolvedValue(updated);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      const result = await service.update('item-1', { name: 'Updated Item' });

      expect(result).toEqual(updated);
      expect(itemQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(itemRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Item' }));
      expect(cacheManager.del).toHaveBeenCalledWith('container:container-1:false');
    });

    it('should reject an item update when the container is deleted', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemRepo.findOne.mockResolvedValue(createMockItem());
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(createMockContainer({ deletedAt: new Date() }));
      itemRepo.createQueryBuilder.mockReturnValue(itemQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.update('item-1', { name: 'X' })).rejects.toThrow(BadRequestException);
    });

    it.each([ContainerStatus.ARCHIVED, ContainerStatus.SHIPPED])(
      'should reject update when container status is %s',
      async (status) => {
        const { manager, itemRepo, containerRepo } = createManagerMocks();

        const containerQb = createEntityQueryBuilder();
        itemRepo.findOne.mockResolvedValue(createMockItem());
        containerQb.getOne.mockResolvedValue(createMockContainer({ status }));
        containerRepo.createQueryBuilder.mockReturnValue(containerQb);

        dataSource.transaction.mockImplementation(async (callback) => callback(manager));

        await expect(service.update('item-1', { name: 'Updated' })).rejects.toThrow(
          'Items can only be updated in active containers',
        );
      },
    );

    it('should reject an update that exceeds container capacity', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemRepo.findOne.mockResolvedValue(createMockItem());
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(createSumQueryBuilder('50'));
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.update('item-1', { packageQuantity: 30, volume: 2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should convert duplicate uniqueNumber errors to ConflictException', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemRepo.findOne.mockResolvedValue(createMockItem());
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(createSumQueryBuilder('0'));
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockRejectedValue({ code: '23505', constraint: 'items_uniqueNumber_key' });
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.update('item-1', { uniqueNumber: 'ITEM-DUPLICATE' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject update with NaN packageQuantity', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();

      const item = createMockItem();

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder.mockReturnValue(itemQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(
        service.update('item-1', {
          packageQuantity: Number.NaN,
        }),
      ).rejects.toThrow('Item total volume must be a valid number greater than 0');
    });

    it('should delete the old photo when updating photo to a new value', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const item = createMockItem({
        photo: 'items/old.jpg',
      });
      const updated = createMockItem({
        photo: 'items/new.jpg',
      });

      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      itemRepository.findOne.mockResolvedValue(updated);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.update('item-1', {
        photo: 'items/new.jpg',
      });

      expect(filesService.deleteFile).toHaveBeenCalledWith('items/old.jpg');
    });

    it('should delete the old photo when updating photo from a value to null', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const item = createMockItem({
        photo: 'items/old.jpg',
      });
      const updated = createMockItem({
        photo: null,
      });

      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      itemRepository.findOne.mockResolvedValue(updated);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.update('item-1', {
        photo: null,
      });

      expect(filesService.deleteFile).toHaveBeenCalledWith('items/old.jpg');
    });

    it('should not delete any photo when updating photo from null to a new value', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const item = createMockItem({
        photo: null,
      });
      const updated = createMockItem({
        photo: 'items/new.jpg',
      });

      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      itemRepository.findOne.mockResolvedValue(updated);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.update('item-1', {
        photo: 'items/new.jpg',
      });

      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('should not delete the photo when photo path is unchanged', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const item = createMockItem({
        photo: 'items/photo.jpg',
      });
      const updated = createMockItem({
        photo: 'items/photo.jpg',
      });

      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      itemRepository.findOne.mockResolvedValue(updated);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.update('item-1', {
        photo: 'items/photo.jpg',
      });

      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('should not delete old photo when update transaction fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const item = createMockItem({
        photo: 'items/old.jpg',
      });

      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder.mockReturnValueOnce(itemQb).mockReturnValueOnce(otherItemsQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockRejectedValue(new Error('Database error'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(
        service.update('item-1', {
          photo: 'items/new.jpg',
        }),
      ).rejects.toThrow('Database error');

      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete an item and recalculate volume', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const recalculateQb = createSumQueryBuilder('0');

      itemRepo.findOne.mockResolvedValue(mockItem);
      itemLockQb.getOne.mockResolvedValue(mockItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemLockQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      itemRepo.softDelete.mockResolvedValue({ affected: 1 });
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await service.softDelete('item-1');

      expect(itemRepo.update).toHaveBeenCalledWith('item-1', {
        deletedByContainer: false,
      });
      expect(itemRepo.softDelete).toHaveBeenCalledWith('item-1');
      expect(itemLockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerLockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerRepo.update).toHaveBeenCalledWith('container-1', {
        usedVolume: 0,
      });
      expect(cacheManager.del).toHaveBeenCalledWith('items:container:container-1');
    });

    it('should throw when item does not exist', async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('should restore an item and return it', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({ deletedAt: new Date(), deletedByContainer: false });
      const restoredItem = createMockItem();

      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const usedVolumeQb = createSumQueryBuilder('0');
      const recalculateQb = createSumQueryBuilder('12.5');

      itemRepo.findOne.mockResolvedValue(deletedItem);
      itemRepository.findOne.mockResolvedValue(restoredItem);

      itemLockQb.getOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemLockQb)
        .mockReturnValueOnce(usedVolumeQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);
      itemRepo.restore.mockResolvedValue({ affected: 1 });
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      const result = await service.restore('item-1');

      expect(result).toEqual(restoredItem);
      expect(itemRepo.restore).toHaveBeenCalledWith('item-1');
      expect(itemRepo.update).toHaveBeenCalledWith('item-1', {
        deletedByContainer: false,
      });
      expect(itemLockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(itemLockQb.withDeleted).toHaveBeenCalled();
      expect(containerLockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(containerLockQb.withDeleted).toHaveBeenCalled();
      expect(containerRepo.update).toHaveBeenCalledWith('container-1', {
        usedVolume: 12.5,
      });
    });

    it('should reject restoring an active item', async () => {
      const { manager, itemRepo } = createManagerMocks();

      itemRepo.findOne.mockResolvedValue(mockItem);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject restore when the container is deleted', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({ deletedAt: new Date(), deletedByContainer: false });
      const containerLockQb = createEntityQueryBuilder();

      itemRepo.findOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(
        createMockContainer({
          deletedAt: new Date(),
        }),
      );

      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow(BadRequestException);

      expect(itemRepo.restore).not.toHaveBeenCalled();
    });

    it('should reject restore when capacity is insufficient', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({
        deletedAt: new Date(),
        totalVolume: 50,
        deletedByContainer: false,
      });

      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const usedVolumeQb = createSumQueryBuilder('60');

      itemRepo.findOne.mockResolvedValue(deletedItem);
      itemLockQb.getOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder.mockReturnValueOnce(itemLockQb).mockReturnValueOnce(usedVolumeQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject individual restore when item was deleted with its container', async () => {
      const { manager, itemRepo } = createManagerMocks();

      const deletedByContainerItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: true,
      });

      itemRepo.findOne.mockResolvedValue(deletedByContainerItem);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow(
        'Item was deleted with its container and must be restored through the container',
      );

      expect(itemRepo.restore).not.toHaveBeenCalled();
    });

    it('should reject restore when locked item was deleted with its container', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();

      const referenceItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: false,
      });

      const lockedItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: true,
      });

      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();

      itemRepo.findOne.mockResolvedValue(referenceItem);
      itemLockQb.getOne.mockResolvedValue(lockedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder.mockReturnValue(itemLockQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow(
        'Item was deleted with its container and must be restored through the container',
      );

      expect(itemRepo.restore).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when restore affects no rows', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: false,
      });

      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const usedVolumeQb = createSumQueryBuilder('0');

      itemRepo.findOne.mockResolvedValue(deletedItem);
      itemLockQb.getOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder.mockReturnValueOnce(itemLockQb).mockReturnValueOnce(usedVolumeQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      itemRepo.restore.mockResolvedValue({ affected: 0 });

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).rejects.toThrow('Item could not be restored');

      expect(itemRepo.update).not.toHaveBeenCalled();
      expect(containerRepo.update).not.toHaveBeenCalled();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it.each([ContainerStatus.ARCHIVED, ContainerStatus.SHIPPED])(
      'should allow restore into container with status %s (current behavior)',
      async (status) => {
        const { manager, itemRepo, containerRepo } = createManagerMocks();
        const deletedItem = createMockItem({ deletedAt: new Date(), deletedByContainer: false });
        const restoredItem = createMockItem();

        const itemLockQb = createEntityQueryBuilder();
        const containerLockQb = createEntityQueryBuilder();
        const usedVolumeQb = createSumQueryBuilder('0');
        const recalculateQb = createSumQueryBuilder('12.5');

        itemRepo.findOne.mockResolvedValue(deletedItem);
        itemRepository.findOne.mockResolvedValue(restoredItem);
        itemLockQb.getOne.mockResolvedValue(deletedItem);
        containerLockQb.getOne.mockResolvedValue(createMockContainer({ status }));

        itemRepo.createQueryBuilder
          .mockReturnValueOnce(itemLockQb)
          .mockReturnValueOnce(usedVolumeQb)
          .mockReturnValueOnce(recalculateQb);

        containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);
        itemRepo.restore.mockResolvedValue({ affected: 1 });
        containerRepo.update.mockResolvedValue({ affected: 1 });

        dataSource.transaction.mockImplementation(async (callback) => callback(manager));

        const result = await service.restore('item-1');

        expect(result).toEqual(restoredItem);
        expect(containerLockQb.getOne).toHaveBeenCalled();
      },
    );
  });

  describe('permanentDelete', () => {
    it('should permanently delete a soft-deleted item and its photo', async () => {
      const { itemRepo, containerRepo } = setupPermanentDeleteScenario();

      await service.permanentDelete('item-1');

      expect(itemRepo.remove).toHaveBeenCalled();
      expect(containerRepo.update).toHaveBeenCalled();
      expect(filesService.deleteFile).toHaveBeenCalledWith('items/photo.jpg');
    });

    it('should not delete a file when item has no photo', async () => {
      const { itemRepo, containerRepo } = setupPermanentDeleteScenario({
        photo: null,
      });

      await service.permanentDelete('item-1');

      expect(itemRepo.remove).toHaveBeenCalled();
      expect(containerRepo.update).toHaveBeenCalled();
      expect(filesService.deleteFile).not.toHaveBeenCalled();
    });

    it('should complete permanent delete when file is already missing', async () => {
      filesService.deleteFile.mockRejectedValueOnce(new NotFoundException('File not found'));

      const { itemRepo, containerRepo } = setupPermanentDeleteScenario();

      await expect(service.permanentDelete('item-1')).resolves.toBeUndefined();

      expect(itemRepo.remove).toHaveBeenCalled();
      expect(containerRepo.update).toHaveBeenCalled();
      expect(filesService.deleteFile).toHaveBeenCalledWith('items/photo.jpg');
    });

    it('should log and continue when photo deletion fails with other error', async () => {
      const storageError = new Error('Storage unavailable');
      filesService.deleteFile.mockRejectedValueOnce(storageError);

      const { itemRepo, containerRepo } = setupPermanentDeleteScenario();

      await expect(service.permanentDelete('item-1')).resolves.toBeUndefined();

      expect(itemRepo.remove).toHaveBeenCalled();
      expect(containerRepo.update).toHaveBeenCalled();
      expect(filesService.deleteFile).toHaveBeenCalledWith('items/photo.jpg');
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to delete item file items/photo.jpg: Storage unavailable',
        expect.any(String),
      );
    });

    it('should reject permanent delete when locked item became active', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();

      const referenceItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: false,
      });

      const lockedItem = createMockItem({
        deletedAt: null,
        deletedByContainer: false,
      });

      const containerQb = createEntityQueryBuilder();
      const itemQb = createEntityQueryBuilder();

      itemRepo.findOne.mockResolvedValue(referenceItem);
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemQb.getOne.mockResolvedValue(lockedItem);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.createQueryBuilder.mockReturnValue(itemQb);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete('item-1')).rejects.toThrow(
        'Item must be soft-deleted before permanent deletion',
      );

      expect(itemRepo.remove).not.toHaveBeenCalled();
    });

    it('should reject permanent delete when locked item was deleted by container', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();

      const referenceItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: false,
      });

      const lockedItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: true,
      });

      const containerQb = createEntityQueryBuilder();
      const itemQb = createEntityQueryBuilder();

      itemRepo.findOne.mockResolvedValue(referenceItem);
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemQb.getOne.mockResolvedValue(lockedItem);

      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.createQueryBuilder.mockReturnValue(itemQb);

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete('item-1')).rejects.toThrow(
        'Item was deleted with its container and must be permanently deleted through the container',
      );

      expect(itemRepo.remove).not.toHaveBeenCalled();
    });

    it('should throw when item does not exist', async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cache failure', () => {
    it('should not fail create when cache clearing fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      const savedItem = createMockItem({
        uniqueNumber: 'ITEM-002',
        totalVolume: 4.5,
      });
      const containerWithUsedVolume = createMockContainer({ usedVolume: 10 });

      containerQb.getOne.mockResolvedValue(containerWithUsedVolume);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.create.mockReturnValue(savedItem);
      itemRepo.save.mockResolvedValue(savedItem);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      itemRepository.findOne.mockResolvedValue(savedItem);

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(
        service.create({
          uniqueNumber: 'ITEM-002',
          name: 'New Item',
          packageQuantity: 3,
          productsPerPackage: 5,
          packagePrice: 50,
          volume: 1.5,
          containerId: 'container-1',
        }),
      ).resolves.toEqual(savedItem);

      expect(containerRepo.update).toHaveBeenCalledWith(containerWithUsedVolume.id, {
        usedVolume: 14.5,
      });
      expect(itemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should not fail update when cache clearing fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder('20');
      const recalculateQb = createSumQueryBuilder('35');
      const item = createMockItem();
      const updated = createMockItem({ name: 'Updated Item' });

      itemRepo.findOne.mockResolvedValue(item);
      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      itemRepository.findOne.mockResolvedValue(updated);

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.update('item-1', { name: 'Updated Item' })).resolves.toEqual(updated);
    });

    it('should not fail softDelete when cache clearing fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const recalculateQb = createSumQueryBuilder('0');

      itemRepo.findOne.mockResolvedValue(mockItem);
      itemLockQb.getOne.mockResolvedValue(mockItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemLockQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      itemRepo.softDelete.mockResolvedValue({ affected: 1 });
      containerRepo.update.mockResolvedValue({ affected: 1 });

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.softDelete('item-1')).resolves.not.toThrow();
    });

    it('should not fail restore when cache clearing fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({ deletedAt: new Date(), deletedByContainer: false });
      const restoredItem = createMockItem();

      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const usedVolumeQb = createSumQueryBuilder('0');
      const recalculateQb = createSumQueryBuilder('12.5');

      itemRepo.findOne.mockResolvedValue(deletedItem);
      itemRepository.findOne.mockResolvedValue(restoredItem);

      itemLockQb.getOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemLockQb)
        .mockReturnValueOnce(usedVolumeQb)
        .mockReturnValueOnce(recalculateQb);

      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);
      itemRepo.restore.mockResolvedValue({ affected: 1 });
      containerRepo.update.mockResolvedValue({ affected: 1 });

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.restore('item-1')).resolves.toEqual(restoredItem);
    });

    it('should not fail permanentDelete when cache clearing fails', async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({
        deletedAt: new Date(),
        deletedByContainer: false,
      });
      const itemLockQb = createEntityQueryBuilder();
      const containerLockQb = createEntityQueryBuilder();
      const recalculateQb = createSumQueryBuilder('0');

      itemRepo.findOne.mockResolvedValue(deletedItem);
      itemLockQb.getOne.mockResolvedValue(deletedItem);
      containerLockQb.getOne.mockResolvedValue(mockContainer);

      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemLockQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerLockQb);

      itemRepo.remove.mockResolvedValue(deletedItem);
      containerRepo.update.mockResolvedValue({ affected: 1 });

      cacheManager.del.mockRejectedValue(new Error('Redis unavailable'));

      dataSource.transaction.mockImplementation(async (callback) => callback(manager));

      await expect(service.permanentDelete('item-1')).resolves.not.toThrow();
    });
  });

  describe('cleanupExpiredItems', () => {
    it.each([0, -1, 1.5, 3651, NaN])(
      'should reject invalid retention value %p',
      async (retentionDays) => {
        await expect(service.cleanupExpiredItems(retentionDays)).rejects.toThrow(
          BadRequestException,
        );
        expect(itemRepository.find).not.toHaveBeenCalled();
      },
    );

    it('should return zero when no expired items exist', async () => {
      itemRepository.find.mockResolvedValue([]);

      const result = await service.cleanupExpiredItems(30);

      expect(result).toBe(0);
      expect(itemRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          withDeleted: true,
          where: expect.objectContaining({
            deletedByContainer: false,
          }),
          take: 50,
        }),
      );
    });

    it('should permanently delete expired items in batches', async () => {
      const expiredItems = [
        createMockItem({
          id: 'item-1',
          deletedAt: new Date('2026-01-01T00:00:00Z'),
        }),
        createMockItem({
          id: 'item-2',
          deletedAt: new Date('2026-01-02T00:00:00Z'),
        }),
      ];

      itemRepository.find.mockResolvedValueOnce(expiredItems).mockResolvedValueOnce([]);

      const permanentDeleteSpy = jest
        .spyOn(service, 'permanentDelete')
        .mockResolvedValue(undefined);

      const result = await service.cleanupExpiredItems(30);

      expect(result).toBe(2);
      expect(permanentDeleteSpy).toHaveBeenCalledTimes(2);
      expect(permanentDeleteSpy).toHaveBeenNthCalledWith(1, 'item-1');
      expect(permanentDeleteSpy).toHaveBeenNthCalledWith(2, 'item-2');
      expect(itemRepository.find).toHaveBeenCalledTimes(2);
    });

    it('should query only individually deleted items', async () => {
      itemRepository.find.mockResolvedValue([]);

      await service.cleanupExpiredItems(30);

      expect(itemRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedByContainer: false,
          }),
          withDeleted: true,
        }),
      );
    });

    it('should continue when one expired item fails and delete the other', async () => {
      const expiredItems = [
        createMockItem({
          id: 'item-fail',
          deletedAt: new Date(),
        }),
        createMockItem({
          id: 'item-success',
          deletedAt: new Date(),
        }),
      ];

      itemRepository.find.mockResolvedValueOnce(expiredItems).mockResolvedValueOnce([]);

      const permanentDeleteSpy = jest
        .spyOn(service, 'permanentDelete')
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      const result = await service.cleanupExpiredItems(30);

      expect(result).toBe(1);
      expect(permanentDeleteSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop when no item in a batch can be deleted', async () => {
      const expiredItems = [
        createMockItem({
          id: 'item-1',
          deletedAt: new Date(),
        }),
      ];

      itemRepository.find.mockResolvedValue(expiredItems);

      jest.spyOn(service, 'permanentDelete').mockRejectedValue(new Error('Delete failed'));

      const result = await service.cleanupExpiredItems(30);

      expect(result).toBe(0);
      expect(itemRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should process multiple batches when more than 50 items exist', async () => {
      const batch1 = Array.from({ length: 50 }, (_, i) =>
        createMockItem({
          id: `item-${i + 1}`,
          deletedAt: new Date(),
        }),
      );
      const batch2 = [
        createMockItem({
          id: 'item-51',
          deletedAt: new Date(),
        }),
      ];

      itemRepository.find
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      const permanentDeleteSpy = jest
        .spyOn(service, 'permanentDelete')
        .mockResolvedValue(undefined);

      const result = await service.cleanupExpiredItems(30);

      expect(result).toBe(51);
      expect(permanentDeleteSpy).toHaveBeenCalledTimes(51);
      expect(itemRepository.find).toHaveBeenCalledTimes(3);
    });

    it('should verify the query uses take: 50 and proper ordering', async () => {
      itemRepository.find.mockResolvedValue([]);

      await service.cleanupExpiredItems(30);

      expect(itemRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          order: {
            deletedAt: 'ASC',
            id: 'ASC',
          },
        }),
      );
    });

    it('should rethrow repository errors during cleanup', async () => {
      itemRepository.find.mockRejectedValue(new Error('Database unavailable'));

      await expect(service.cleanupExpiredItems(30)).rejects.toThrow('Database unavailable');
    });

    it('should query items older than the retention cutoff', async () => {
      itemRepository.find.mockResolvedValue([]);

      await service.cleanupExpiredItems(30);

      expect(itemRepository.find).toHaveBeenCalledTimes(1);

      const options = itemRepository.find.mock.calls[0]?.[0];

      if (!options) {
        throw new Error('Expected itemRepository.find to be called with options');
      }

      expect(options.where).toEqual(
        expect.objectContaining({
          deletedByContainer: false,
        }),
      );

      expect(
        (
          options.where as {
            deletedAt?: unknown;
          }
        ).deletedAt,
      ).toBeDefined();
    });
  });
});