// src/modules/items/items.service.spec.ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ItemsService } from "./items.service";
import { Item } from "./entities/item.entity";
import { ContainersService } from "../containers/containers.service";
import {
  Container,
  ContainerStatus,
} from "../containers/entities/container.entity";
import { User } from "../auth/entities/user.entity";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

describe("ItemsService", () => {
  let service: ItemsService;
  let itemRepository: jest.Mocked<Repository<Item>>;
  let containersService: jest.Mocked<ContainersService>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const mockUser = {
    id: "user-1",
    username: "admin",
    email: "admin@example.com",
    role: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const createMockContainer = (overrides: Partial<Container> = {}): Container =>
    ({
      id: "container-1",
      name: "Test Container",
      containerCode: "CNT-TEST1234",
      totalVolume: 100,
      usedVolume: 0,
      availableVolume: 100,
      status: ContainerStatus.ACTIVE,
      description: "Test container",
      createdBy: mockUser,
      createdById: mockUser.id,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }) as Container;

  const mockContainer = createMockContainer();

  const createMockItem = (overrides: Partial<Item> = {}): Item =>
    ({
      id: "item-1",
      uniqueNumber: "ITEM-001",
      name: "Test Item",
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
      calculateTotalVolume: jest.fn(),
      ...overrides,
    }) as unknown as Item;

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

  const createSumQueryBuilder = (sum = "0"): any => ({
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
        throw new Error("Unexpected repository");
      }),
    };

    return { manager, itemRepo, containerRepo };
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
        ItemsService,
        {
          provide: getRepositoryToken(Item),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => createListQueryBuilder()),
          },
        },
        {
          provide: ContainersService,
          useValue: {
            findOneIncludingDeleted: jest.fn(),
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
      ],
    }).compile();

    service = module.get(ItemsService);
    itemRepository = module.get(getRepositoryToken(Item));
    containersService = module.get(ContainersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const dto: CreateItemDto = {
      uniqueNumber: "ITEM-002",
      name: "New Item",
      packageQuantity: 3,
      productsPerPackage: 5,
      packagePrice: 50,
      volume: 1.5,
      containerId: "container-1",
    };

    it("should create an item inside a transaction and clear cache", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      const currentVolumeQb = createSumQueryBuilder("10");
      const recalculateQb = createSumQueryBuilder("14.5");
      const savedItem = createMockItem({ ...dto, totalVolume: 4.5 });

      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(currentVolumeQb)
        .mockReturnValueOnce(recalculateQb);
      itemRepo.create.mockReturnValue(savedItem);
      itemRepo.save.mockResolvedValue(savedItem);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      const result = await service.create(dto);

      expect(result).toEqual(savedItem);
      expect(containerQb.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uniqueNumber: dto.uniqueNumber,
          totalVolume: 4.5,
          containerId: mockContainer.id,
        }),
      );
      expect(containerRepo.update).toHaveBeenCalledWith(mockContainer.id, {
        usedVolume: 14.5,
      });
      expect(cacheManager.del).toHaveBeenCalledWith(
        "container:container-1:false",
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        "container:container-1:true",
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        "items:container:container-1",
      );
    });

    it("should throw NotFoundException when container does not exist", async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(null);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when total volume is invalid", async () => {
      const { manager, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(
        service.create({ ...dto, packageQuantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when container has insufficient capacity", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.createQueryBuilder.mockReturnValue(createSumQueryBuilder("99"));
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it("should convert database duplicate error to ConflictException", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const containerQb = createEntityQueryBuilder();
      containerQb.getOne.mockResolvedValue(mockContainer);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.createQueryBuilder.mockReturnValue(createSumQueryBuilder("0"));
      itemRepo.create.mockReturnValue(createMockItem());
      itemRepo.save.mockRejectedValue({ code: "23505" });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe("findAll and search", () => {
    it("should return paginated items", async () => {
      const paginationDto: PaginationDto = {
        limit: 10,
        offset: 0,
        sort: "createdAt:DESC",
      };

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should sort deletedAt DESC with NULLS LAST", async () => {
      const qb = createListQueryBuilder();

      itemRepository.createQueryBuilder.mockReturnValue(
        qb,
      );

      await service.findAll(
        {
          limit: 10,
          offset: 0,
          sort: "deletedAt:DESC",
        },
        undefined,
        true,
      );

      expect(
        qb.addOrderBy,
      ).toHaveBeenCalledWith(
        "item.deletedAt",
        "DESC",
        "NULLS LAST",
      );
    });

    it("should support filtering and including deleted items", async () => {
      const qb = createListQueryBuilder();
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 10, offset: 0 }, "container-1", true);

      expect(qb.withDeleted).toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith(
        "item.containerId = :containerId",
        { containerId: "container-1" },
      );
    });

    it("should search items", async () => {
      const result = await service.searchItems("test", {
        limit: 10,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
    });

    it("should return deleted items", async () => {
      const deletedItem = createMockItem({ deletedAt: new Date() });
      const qb = createListQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[deletedItem], 1]);
      itemRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findDeleted({ limit: 10, offset: 0 });

      expect(result.data).toEqual([deletedItem]);
      expect(result.hasMore).toBe(false);
      expect(qb.withDeleted).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return an item", async () => {
      itemRepository.findOne.mockResolvedValue(mockItem);
      await expect(service.findOne("item-1")).resolves.toEqual(mockItem);
    });

    it("should throw when item is not found", async () => {
      itemRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update an item with locks and recalculate volume", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      const otherItemsQb = createSumQueryBuilder("20");
      const recalculateQb = createSumQueryBuilder("35");
      const item = createMockItem();
      const updated = createMockItem({ name: "Updated Item" });

      itemQb.getOne.mockResolvedValue(item);
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(otherItemsQb)
        .mockReturnValueOnce(recalculateQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockResolvedValue(updated);
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      const result = await service.update("item-1", { name: "Updated Item" });

      expect(result).toEqual(updated);
      expect(itemQb.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(containerQb.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Item" }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        "container:container-1:false",
      );
    });

    it("should reject an item update when the container is deleted", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(
        createMockContainer({ deletedAt: new Date() }),
      );
      itemRepo.createQueryBuilder.mockReturnValue(itemQb);
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.update("item-1", { name: "X" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject an update that exceeds container capacity", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(createSumQueryBuilder("50"));
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(
        service.update("item-1", { packageQuantity: 30, volume: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should convert duplicate uniqueNumber errors to ConflictException", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const itemQb = createEntityQueryBuilder();
      const containerQb = createEntityQueryBuilder();
      itemQb.getOne.mockResolvedValue(createMockItem());
      containerQb.getOne.mockResolvedValue(mockContainer);
      itemRepo.createQueryBuilder
        .mockReturnValueOnce(itemQb)
        .mockReturnValueOnce(createSumQueryBuilder("0"));
      containerRepo.createQueryBuilder.mockReturnValue(containerQb);
      itemRepo.save.mockRejectedValue({ code: "23505" });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(
        service.update("item-1", { uniqueNumber: "ITEM-DUPLICATE" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("softDelete", () => {
    it("should soft delete an item and recalculate volume", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(mockItem);
      itemRepo.softDelete.mockResolvedValue({ affected: 1 });
      itemRepo.createQueryBuilder.mockReturnValue(createSumQueryBuilder("0"));
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await service.softDelete("item-1");

      expect(itemRepo.softDelete).toHaveBeenCalledWith("item-1");
      expect(containerRepo.update).toHaveBeenCalledWith("container-1", {
        usedVolume: 0,
      });
      expect(cacheManager.del).toHaveBeenCalledWith(
        "items:container:container-1",
      );
    });

    it("should throw when item does not exist", async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.softDelete("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("restore", () => {
    it("should restore an item and return it", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      const deletedItem = createMockItem({ deletedAt: new Date() });
      const restoredItem = createMockItem();
      itemRepo.findOne
        .mockResolvedValueOnce(deletedItem)
        .mockResolvedValueOnce(restoredItem);
      itemRepo.restore.mockResolvedValue({ affected: 1 });
      itemRepo.createQueryBuilder.mockReturnValue(
        createSumQueryBuilder("12.5"),
      );
      containerRepo.update.mockResolvedValue({ affected: 1 });
      containersService.findOneIncludingDeleted.mockResolvedValue(
        mockContainer,
      );
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      const result = await service.restore("item-1");

      expect(result).toEqual(restoredItem);
      expect(itemRepo.restore).toHaveBeenCalledWith("item-1");
      expect(containersService.findOneIncludingDeleted).toHaveBeenCalledWith(
        "container-1",
      );
    });

    it("should reject restoring an active item", async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(mockItem);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.restore("item-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject restore when the container is deleted", async () => {
      const { manager, itemRepo } = createManagerMocks();

      itemRepo.findOne.mockResolvedValue(
        createMockItem({
          deletedAt: new Date(),
        }),
      );

      containersService.findOneIncludingDeleted.mockResolvedValue(
        createMockContainer({
          deletedAt: new Date(),
        }),
      );

      dataSource.transaction.mockImplementation(
        async (callback) => callback(manager),
      );

      await expect(
        service.restore("item-1"),
      ).rejects.toThrow(
        BadRequestException,
      );

      expect(
        itemRepo.restore,
      ).not.toHaveBeenCalled();
    });

    it("should reject restore when capacity is insufficient", async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(
        createMockItem({ deletedAt: new Date(), totalVolume: 50 }),
      );
      containersService.findOneIncludingDeleted.mockResolvedValue(
        createMockContainer({ availableVolume: 10 }),
      );
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.restore("item-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("permanentDelete", () => {
    it("should permanently delete an item and recalculate volume", async () => {
      const { manager, itemRepo, containerRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(mockItem);
      itemRepo.remove.mockResolvedValue(mockItem);
      itemRepo.createQueryBuilder.mockReturnValue(createSumQueryBuilder("0"));
      containerRepo.update.mockResolvedValue({ affected: 1 });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await service.permanentDelete("item-1");

      expect(itemRepo.remove).toHaveBeenCalledWith(mockItem);
      expect(containerRepo.update).toHaveBeenCalledWith("container-1", {
        usedVolume: 0,
      });
    });

    it("should throw when item does not exist", async () => {
      const { manager, itemRepo } = createManagerMocks();
      itemRepo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(service.permanentDelete("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});