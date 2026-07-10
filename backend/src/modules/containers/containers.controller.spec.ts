// src/modules/containers/containers.controller.spec.ts

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';
import { SearchContainerQueryDto } from './dto/search-container-query.dto';
import {
  Container,
  ContainerStatus,
} from './entities/container.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import {
  PaginatedResponseDto,
  PaginationDto,
} from '../../common/dto/pagination.dto';

describe('ContainersController', () => {
  let controller: ContainersController;
  let service: jest.Mocked<ContainersService>;

  const mockUser = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockRequest = {
    user: mockUser,
  };

  const mockContainer = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Container',
    containerCode: 'CNT-ABCD123456',
    totalVolume: 100,
    usedVolume: 20,
    availableVolume: 80,
    status: ContainerStatus.ACTIVE,
    description: 'Test description',
    createdBy: mockUser,
    createdById: mockUser.id,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Container;

  const createPaginatedResponse = (
    data: Container[] = [],
    total = data.length,
    limit = 10,
    offset = 0,
  ): PaginatedResponseDto<Container> =>
    ({
      data,
      total,
      limit,
      offset,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    }) as PaginatedResponseDto<Container>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContainersController],
      providers: [
        {
          provide: ContainersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findActiveContainers: jest.fn(),
            findArchivedContainers: jest.fn(),
            searchContainers: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            permanentDelete: jest.fn(),
            findDeleted: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ContainersController>(
      ContainersController,
    );
    service = module.get(ContainersService);

    service.findAll.mockResolvedValue(createPaginatedResponse());
    service.findActiveContainers.mockResolvedValue(
      createPaginatedResponse(),
    );
    service.findArchivedContainers.mockResolvedValue(
      createPaginatedResponse(),
    );
    service.searchContainers.mockResolvedValue(
      createPaginatedResponse(),
    );
    service.findDeleted.mockResolvedValue(
      createPaginatedResponse(),
    );
    service.softDelete.mockResolvedValue(undefined);
    service.permanentDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a container', async () => {
      const dto: CreateContainerDto = {
        customName: 'Test Container',
        totalVolume: 100,
        description: 'Test description',
      };

      service.create.mockResolvedValue(mockContainer);

      const result = await controller.create(
        dto,
        mockRequest,
      );

      expect(result).toEqual(mockContainer);
      expect(service.create).toHaveBeenCalledWith(
        dto,
        mockUser,
      );
    });
  });

  describe('findAll', () => {
    it('should return containers with pagination defaults', async () => {
      const query = {} as ContainerQueryDto;
      const expected = createPaginatedResponse(
        [mockContainer],
        1,
      );
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
        undefined,
        false,
      );
    });

    it('should pass status and includeDeleted to the service', async () => {
      const query = {
        limit: 20,
        offset: 40,
        sort: 'createdAt:DESC',
        status: ContainerStatus.ACTIVE,
        includeDeleted: 'true',
      } as ContainerQueryDto;

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 40,
          sort: 'createdAt:DESC',
        }),
        ContainerStatus.ACTIVE,
        true,
      );
    });

    it('should normalize invalid pagination values to defaults', async () => {
      const query = {
        limit: 0,
        offset: -1,
      } as ContainerQueryDto;

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
        undefined,
        false,
      );
    });
  });

  describe('findDeleted', () => {
    it('should return deleted containers', async () => {
      const deletedContainer = {
        ...mockContainer,
        deletedAt: new Date(),
      } as Container;

      const expected = createPaginatedResponse(
        [deletedContainer],
        1,
      );
      service.findDeleted.mockResolvedValue(expected);

      const query = {
        limit: 10,
        offset: 0,
        sort: 'deletedAt:DESC',
      } as PaginationDto;

      const result = await controller.findDeleted(query);

      expect(result).toEqual(expected);
      expect(service.findDeleted).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: 'deletedAt:DESC',
        }),
      );
    });
  });

  describe('getActiveContainers', () => {
    it('should return active containers', async () => {
      const query = {
        limit: 10,
        offset: 0,
      } as PaginationDto;

      await controller.getActiveContainers(query);

      expect(
        service.findActiveContainers,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
      );
    });
  });

  describe('getArchivedContainers', () => {
    it('should return archived containers', async () => {
      const query = {
        limit: 10,
        offset: 0,
      } as PaginationDto;

      await controller.getArchivedContainers(query);

      expect(
        service.findArchivedContainers,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        }),
      );
    });
  });

  describe('searchContainers', () => {
    it('should search containers using the new search DTO', async () => {
      const query = {
        query: 'Test Container',
        limit: 10,
        offset: 0,
        sort: 'createdAt:DESC',
      } as SearchContainerQueryDto;

      const expected = createPaginatedResponse(
        [mockContainer],
        1,
      );
      service.searchContainers.mockResolvedValue(expected);

      const result = await controller.searchContainers(query);

      expect(result).toEqual(expected);
      expect(service.searchContainers).toHaveBeenCalledWith(
        'Test Container',
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: 'createdAt:DESC',
        }),
      );
    });

    it('should use pagination defaults for a search', async () => {
      const query = {
        query: 'test',
      } as SearchContainerQueryDto;

      await controller.searchContainers(query);

      expect(service.searchContainers).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 10,
          offset: 0,
          sort: undefined,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a container with includeDeleted defaulting to false', async () => {
      service.findOne.mockResolvedValue(mockContainer);

      const result = await controller.findOne(
        mockContainer.id,
      );

      expect(result).toEqual(mockContainer);
      expect(service.findOne).toHaveBeenCalledWith(
        mockContainer.id,
        false,
      );
    });

    it('should pass includeDeleted when provided', async () => {
      service.findOne.mockResolvedValue(mockContainer);

      await controller.findOne(mockContainer.id, true);

      expect(service.findOne).toHaveBeenCalledWith(
        mockContainer.id,
        true,
      );
    });
  });

  describe('update', () => {
    it('should update a container', async () => {
      const dto: UpdateContainerDto = {
        name: 'Updated Container',
        description: 'Updated description',
      };

      const expected = {
        ...mockContainer,
        name: dto.name,
        description: dto.description,
      } as Container;

      service.update.mockResolvedValue(expected);

      const result = await controller.update(
        mockContainer.id,
        dto,
      );

      expect(result).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith(
        mockContainer.id,
        dto,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update container status', async () => {
      const expected = {
        ...mockContainer,
        status: ContainerStatus.ARCHIVED,
      } as Container;

      service.updateStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus(
        mockContainer.id,
        ContainerStatus.ARCHIVED,
      );

      expect(result).toEqual(expected);
      expect(service.updateStatus).toHaveBeenCalledWith(
        mockContainer.id,
        ContainerStatus.ARCHIVED,
      );
    });

    it('should throw for an invalid status', async () => {
      await expect(
        controller.updateStatus(
          mockContainer.id,
          'invalid' as ContainerStatus,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw when status is missing', async () => {
      await expect(
        controller.updateStatus(
          mockContainer.id,
          undefined as unknown as ContainerStatus,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a container', async () => {
      await controller.remove(mockContainer.id);

      expect(service.softDelete).toHaveBeenCalledWith(
        mockContainer.id,
      );
    });
  });

  describe('restore', () => {
    it('should restore a container', async () => {
      service.restore.mockResolvedValue(mockContainer);

      const result = await controller.restore(
        mockContainer.id,
      );

      expect(result).toEqual(mockContainer);
      expect(service.restore).toHaveBeenCalledWith(
        mockContainer.id,
      );
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete a container', async () => {
      await controller.permanentDelete(mockContainer.id);

      expect(
        service.permanentDelete,
      ).toHaveBeenCalledWith(mockContainer.id);
    });
  });
});