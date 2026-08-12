// src/modules/items/items.controller.spec.ts

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { ItemsController } from './items.controller';

import {
  ItemsService,
  ItemWithPhotoUrl,
} from './items.service';

import { Item } from './entities/item.entity';

import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { SearchItemQueryDto } from './dto/search-item-query.dto';

import {
  Container,
  ContainerStatus,
} from '../containers/entities/container.entity';

import { User } from '../auth/entities/user.entity';

import {
  PaginatedResponseDto,
  PaginationDto,
} from '../../common/dto/pagination.dto';

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

  /**
   * Creates an Item entity instance and then attaches the transient
   * photoUrl returned by ItemsService.
   *
   * Using new Item() is important because ItemWithPhotoUrl extends Item,
   * and Item contains prototype methods such as calculateTotalVolume().
   */
  const createMockItem = (
    overrides: Partial<ItemWithPhotoUrl> = {},
  ): ItemWithPhotoUrl => {
    const item = Object.assign(
      new Item(),
      {
        id: 'item-1',
        uniqueNumber: 'ITEM-001',
        name: 'Test Item',
        photo: 'items/test-item.png',
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
      },
      overrides,
    );

    return Object.assign(item, {
      photoUrl:
        overrides.photoUrl !== undefined
          ? overrides.photoUrl
          : item.photo
            ? 'https://container-managment-files-prod.s3.eu-north-1.amazonaws.com/items/test-item.png?X-Amz-Signature=test'
            : null,
    });
  };

  const mockItem = createMockItem();

  const paginatedItems = (
    data:
      ItemWithPhotoUrl[] = [
        mockItem,
      ],
  ): PaginatedResponseDto<ItemWithPhotoUrl> =>
    new PaginatedResponseDto(
      data,
      data.length,
      10,
      0,
    );

  beforeEach(async () => {
    const module:
      TestingModule =
      await Test
        .createTestingModule({
          controllers: [
            ItemsController,
          ],

          providers: [
            {
              provide:
                ItemsService,

              useValue: {
                create:
                  jest.fn(),

                findAll:
                  jest.fn(),

                findDeleted:
                  jest.fn(),

                searchItems:
                  jest.fn(),

                findOne:
                  jest.fn(),

                update:
                  jest.fn(),

                softDelete:
                  jest.fn(),

                restore:
                  jest.fn(),

                permanentDelete:
                  jest.fn(),

                countActiveItems:
                  jest.fn(),
              },
            },
          ],
        })
        .compile();

    controller =
      module.get<ItemsController>(
        ItemsController,
      );

    service =
      module.get<ItemsService>(
        ItemsService,
      ) as jest.Mocked<ItemsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it(
      'should create an item',
      async () => {
        const dto:
          CreateItemDto = {
          uniqueNumber:
            'ITEM-002',

          name:
            'New Item',

          /**
           * Permanent S3 object key.
           */
          photo:
            'items/new-item.png',

          packageQuantity:
            3,

          productsPerPackage:
            5,

          packagePrice:
            50,

          volume:
            1.5,

          containerId:
            'container-1',
        };

        const expected =
          createMockItem({
            id:
              'item-2',

            uniqueNumber:
              dto.uniqueNumber,

            name:
              dto.name,

            photo:
              dto.photo ?? null,

            packageQuantity:
              dto.packageQuantity,

            productsPerPackage:
              dto.productsPerPackage,

            packagePrice:
              dto.packagePrice,

            volume:
              dto.volume,

            totalVolume:
              4.5,

            photoUrl:
              'https://container-managment-files-prod.s3.eu-north-1.amazonaws.com/items/new-item.png?X-Amz-Signature=test',
          });

        service.create
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.create(
            dto,
          );

        expect(result)
          .toEqual(
            expected,
          );

        expect(
          service.create,
        ).toHaveBeenCalledWith(
          dto,
        );
      },
    );
  });

  describe('findAll', () => {
    it(
      'should return items from query',
      async () => {
        const query = {
          limit:
            '10',

          offset:
            '0',
        } as unknown as ItemQueryDto;

        const expected =
          paginatedItems();

        service.findAll
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.findAll(
            query,
          );

        expect(result)
          .toEqual(
            expected,
          );

        expect(
          service.findAll,
        ).toHaveBeenCalledWith(
          query,
          undefined,
          false,
        );
      },
    );

    it(
      'should use default pagination values when input is invalid',
      async () => {
        const query = {
          limit:
            'invalid',

          offset:
            '-1',
        } as unknown as ItemQueryDto;

        service.findAll
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.findAll(
          query,
        );

        expect(
          service.findAll,
        ).toHaveBeenCalledWith(
          query,
          undefined,
          false,
        );
      },
    );

    it(
      'should filter by containerId',
      async () => {
        const query = {
          containerId:
            'container-1',

          limit:
            '10',

          offset:
            '0',
        } as unknown as ItemQueryDto;

        service.findAll
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.findAll(
          query,
        );

        expect(
          service.findAll,
        ).toHaveBeenCalledWith(
          query,
          'container-1',
          false,
        );
      },
    );

    it(
      'should include deleted when includeDeleted is true',
      async () => {
        const query = {
          includeDeleted:
            'true',

          limit:
            '10',

          offset:
            '0',
        } as unknown as ItemQueryDto;

        service.findAll
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.findAll(
          query,
        );

        expect(
          service.findAll,
        ).toHaveBeenCalledWith(
          query,
          undefined,
          true,
        );
      },
    );

    it(
      'should pass sort to the service',
      async () => {
        const query = {
          limit:
            '10',

          offset:
            '0',

          sort:
            'createdAt:DESC',
        } as unknown as ItemQueryDto;

        service.findAll
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.findAll(
          query,
        );

        expect(
          service.findAll,
        ).toHaveBeenCalledWith(
          query,
          undefined,
          false,
        );
      },
    );
  });

  describe('findDeleted', () => {
    it(
      'should return deleted items',
      async () => {
        const query = {
          limit:
            10,

          offset:
            0,
        } as PaginationDto;

        const expected =
          paginatedItems(
            [],
          );

        service.findDeleted
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.findDeleted(
            query,
          );

        expect(result)
          .toEqual(
            expected,
          );

        expect(
          service.findDeleted,
        ).toHaveBeenCalledWith(
          query,
        );
      },
    );
  });

  describe('searchItems', () => {
    it(
      'should search items',
      async () => {
        const queryParams = {
          query:
            ' test ',

          limit:
            '10',

          offset:
            '0',
        } as unknown as SearchItemQueryDto;

        const expected =
          paginatedItems();

        service.searchItems
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.searchItems(
            queryParams,
          );

        expect(result)
          .toEqual(
            expected,
          );

        expect(
          service.searchItems,
        ).toHaveBeenCalledWith(
          queryParams.query,
          queryParams,
          undefined,
        );
      },
    );

    it(
      'should search with containerId',
      async () => {
        const queryParams = {
          query:
            'test',

          containerId:
            'container-1',

          limit:
            '10',

          offset:
            '0',
        } as unknown as SearchItemQueryDto;

        service.searchItems
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.searchItems(
          queryParams,
        );

        expect(
          service.searchItems,
        ).toHaveBeenCalledWith(
          queryParams.query,
          queryParams,
          'container-1',
        );
      },
    );

    it(
      'should pass sort to search service',
      async () => {
        const queryParams = {
          query:
            'test',

          limit:
            '10',

          offset:
            '0',

          sort:
            'name:ASC',
        } as unknown as SearchItemQueryDto;

        service.searchItems
          .mockResolvedValue(
            paginatedItems(),
          );

        await controller.searchItems(
          queryParams,
        );

        expect(
          service.searchItems,
        ).toHaveBeenCalledWith(
          queryParams.query,
          queryParams,
          undefined,
        );
      },
    );
  });

  describe('countActiveItems', () => {
    it(
      'should return the total number of active items',
      async () => {
        service.countActiveItems
          .mockResolvedValue(
            7,
          );

        const result =
          await controller.countActiveItems();

        expect(result)
          .toEqual({
            total: 7,
          });

        expect(
          service.countActiveItems,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  });

  describe('findOne', () => {
    it(
      'should return an item by id with photoUrl',
      async () => {
        service.findOne
          .mockResolvedValue(
            mockItem,
          );

        const result =
          await controller.findOne(
            'item-1',
          );

        expect(result)
          .toEqual(
            mockItem,
          );

        expect(
          result.photo,
        ).toBe(
          'items/test-item.png',
        );

        expect(
          result.photoUrl,
        ).toContain(
          'X-Amz-Signature',
        );

        expect(
          service.findOne,
        ).toHaveBeenCalledWith(
          'item-1',
          false,
        );
      },
    );

    it(
      'should include deleted when includeDeleted is true',
      async () => {
        service.findOne
          .mockResolvedValue(
            mockItem,
          );

        await controller.findOne(
          'item-1',
          true,
        );

        expect(
          service.findOne,
        ).toHaveBeenCalledWith(
          'item-1',
          true,
        );
      },
    );
  });

  describe('update', () => {
    it(
      'should update an item',
      async () => {
        const dto:
          UpdateItemDto = {
          name:
            'Updated Item',
        };

        const expected =
          createMockItem({
            name:
              'Updated Item',
          });

        service.update
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.update(
            'item-1',
            dto,
          );

        expect(result)
          .toEqual(
            expected,
          );

        expect(
          service.update,
        ).toHaveBeenCalledWith(
          'item-1',
          dto,
        );
      },
    );

    it(
      'should update the item photo using an S3 object key',
      async () => {
        const dto:
          UpdateItemDto = {
          photo:
            'items/replacement-photo.png',
        };

        const expected =
          createMockItem({
            photo:
              'items/replacement-photo.png',

            photoUrl:
              'https://container-managment-files-prod.s3.eu-north-1.amazonaws.com/items/replacement-photo.png?X-Amz-Signature=test',
          });

        service.update
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.update(
            'item-1',
            dto,
          );

        expect(result.photo)
          .toBe(
            'items/replacement-photo.png',
          );

        expect(result.photoUrl)
          .toContain(
            'X-Amz-Signature',
          );

        expect(
          service.update,
        ).toHaveBeenCalledWith(
          'item-1',
          dto,
        );
      },
    );

    it(
      'should allow clearing the item photo',
      async () => {
        const dto:
          UpdateItemDto = {
          photo:
            null,
        };

        const expected =
          createMockItem({
            photo:
              null,

            photoUrl:
              null,
          });

        service.update
          .mockResolvedValue(
            expected,
          );

        const result =
          await controller.update(
            'item-1',
            dto,
          );

        expect(result.photo)
          .toBeNull();

        expect(result.photoUrl)
          .toBeNull();

        expect(
          service.update,
        ).toHaveBeenCalledWith(
          'item-1',
          dto,
        );
      },
    );
  });

  describe('remove', () => {
    it(
      'should soft delete an item',
      async () => {
        service.softDelete
          .mockResolvedValue(
            undefined,
          );

        await controller.remove(
          'item-1',
        );

        expect(
          service.softDelete,
        ).toHaveBeenCalledWith(
          'item-1',
        );
      },
    );
  });

  describe('restore', () => {
    it(
      'should restore an item',
      async () => {
        service.restore
          .mockResolvedValue(
            mockItem,
          );

        const result =
          await controller.restore(
            'item-1',
          );

        expect(result)
          .toEqual(
            mockItem,
          );

        expect(
          service.restore,
        ).toHaveBeenCalledWith(
          'item-1',
        );
      },
    );
  });

  describe(
    'permanentDelete',
    () => {
      it(
        'should permanently delete an item',
        async () => {
          service
            .permanentDelete
            .mockResolvedValue(
              undefined,
            );

          await controller
            .permanentDelete(
              'item-1',
            );

          expect(
            service.permanentDelete,
          ).toHaveBeenCalledWith(
            'item-1',
          );
        },
      );
    },
  );
});