// src/modules/items/items.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { SearchItemQueryDto } from './dto/search-item-query.dto';
import { Item } from './entities/item.entity';
import {
  Container,
  ContainerStatus,
} from '../containers/entities/container.entity';
import { User } from '../auth/entities/user.entity';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

describe('ItemsController', () => {
  let controller: ItemsController;
  let service: jest.Mocked<ItemsService>;

  const mockUser: User = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockContainer: Container = {
    id: 'container-1',
    name: 'Test Container',
    containerCode: '123-TEST',
    totalVolume: 100,
    usedVolume: 0,
    availableVolume: 100,
    status: ContainerStatus.ACTIVE,
    description: 'Test',
    createdBy: mockUser,
    createdById: mockUser.id,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    generateContainerCode: jest.fn(),
    updateUsedVolume: jest.fn(),
  } as unknown as Container;

  const mockItem: Item = {
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
    calculateTotalVolume: jest.fn(),
  } as unknown as Item;

  const paginatedItems = (
    data: Item[] = [mockItem],
  ): PaginatedResponseDto<Item> =>
    ({
      data,
      total: data.length,
      limit: 10,
      offset: 0,
      totalPages: data.length > 0 ? 1 : 0,
      currentPage: 1,
    }) as PaginatedResponseDto<Item>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [
        {
          provide: ItemsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findDeleted: jest.fn(),
            searchItems: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            permanentDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
    service = module.get(ItemsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an item', async () => {
      const dto: CreateItemDto = {
        uniqueNumber: 'ITEM-002',
        name: 'New Item',
        packageQuantity: 3,
        productsPerPackage: 5,
        packagePrice: 50,
        volume: 1.5,
        containerId: 'container-1',
      };

      const expected = {
        ...mockItem,
        ...dto,
        totalVolume: 4.5,
      } as Item;

      service.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return items from query', async () => {
      const query = {
        limit: '10',
        offset: '0',
      } as unknown as ItemQueryDto;
      const expected = paginatedItems();

      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
        undefined,
        false,
      );
    });

    it('should use default pagination values when input is invalid', async () => {
      const query = {
        limit: 'invalid',
        offset: '-1',
      } as unknown as ItemQueryDto;

      service.findAll.mockResolvedValue(paginatedItems());

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
        undefined,
        false,
      );
    });

    it('should filter by containerId', async () => {
      const query = {
        containerId: 'container-1',
        limit: '10',
        offset: '0',
      } as unknown as ItemQueryDto;

      service.findAll.mockResolvedValue(paginatedItems());

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
        'container-1',
        false,
      );
    });

    it('should include deleted when includeDeleted is true', async () => {
      const query = {
        includeDeleted: 'true',
        limit: '10',
        offset: '0',
      } as unknown as ItemQueryDto;

      service.findAll.mockResolvedValue(paginatedItems());

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
        undefined,
        true,
      );
    });

    it('should pass sort to the service', async () => {
      const query = {
        limit: '10',
        offset: '0',
        sort: 'createdAt:DESC',
      } as unknown as ItemQueryDto;

      service.findAll.mockResolvedValue(paginatedItems());

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: 'createdAt:DESC',
        }),
        undefined,
        false,
      );
    });
  });

  describe('findDeleted', () => {
    it('should return deleted items', async () => {
      const query = {
        limit: '10',
        offset: '0',
      } as any;
      const expected = paginatedItems([]);

      service.findDeleted.mockResolvedValue(expected);

      const result = await controller.findDeleted(query);

      expect(result).toEqual(expected);
      expect(service.findDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
      );
    });
  });

  describe('searchItems', () => {
    it('should search items', async () => {
      const queryParams = {
        query: ' test ',
        limit: '10',
        offset: '0',
      } as unknown as SearchItemQueryDto;
      const expected = paginatedItems();

      service.searchItems.mockResolvedValue(expected);

      const result = await controller.searchItems(queryParams);

      expect(result).toEqual(expected);
      expect(service.searchItems).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ limit: 10, offset: 0 }),
        undefined,
      );
    });

    it('should search with containerId', async () => {
      const queryParams = {
        query: 'test',
        containerId: 'container-1',
        limit: '10',
        offset: '0',
      } as unknown as SearchItemQueryDto;

      service.searchItems.mockResolvedValue(paginatedItems());

      await controller.searchItems(queryParams);

      expect(service.searchItems).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ limit: 10, offset: 0 }),
        'container-1',
      );
    });

    it('should pass sort to search service', async () => {
      const queryParams = {
        query: 'test',
        limit: '10',
        offset: '0',
        sort: 'name:ASC',
      } as unknown as SearchItemQueryDto;

      service.searchItems.mockResolvedValue(paginatedItems());

      await controller.searchItems(queryParams);

      expect(service.searchItems).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: 'name:ASC',
        }),
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('should return an item by id', async () => {
      service.findOne.mockResolvedValue(mockItem);

      const result = await controller.findOne('item-1');

      expect(result).toEqual(mockItem);
      expect(service.findOne).toHaveBeenCalledWith('item-1', false);
    });

    it('should include deleted when includeDeleted is true', async () => {
      service.findOne.mockResolvedValue(mockItem);

      await controller.findOne('item-1', true);

      expect(service.findOne).toHaveBeenCalledWith('item-1', true);
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const dto: UpdateItemDto = { name: 'Updated Item' };
      const expected = {
        ...mockItem,
        name: 'Updated Item',
      } as Item;

      service.update.mockResolvedValue(expected);

      const result = await controller.update('item-1', dto);

      expect(result).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith('item-1', dto);
    });
  });

  describe('remove', () => {
    it('should soft delete an item', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await controller.remove('item-1');

      expect(service.softDelete).toHaveBeenCalledWith('item-1');
    });
  });

  describe('restore', () => {
    it('should restore an item', async () => {
      service.restore.mockResolvedValue(mockItem);

      const result = await controller.restore('item-1');

      expect(result).toEqual(mockItem);
      expect(service.restore).toHaveBeenCalledWith('item-1');
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete an item', async () => {
      service.permanentDelete.mockResolvedValue(undefined);

      await controller.permanentDelete('item-1');

      expect(service.permanentDelete).toHaveBeenCalledWith('item-1');
    });
  });
});