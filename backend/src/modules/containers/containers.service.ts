// src/modules/containers/containers.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Container, ContainerStatus } from './entities/container.entity';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { User } from '../auth/entities/user.entity';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';

@Injectable()
export class ContainersService {
  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async create(createContainerDto: CreateContainerDto, user: User): Promise<Container> {
    const container = new Container({
      name: createContainerDto.customName,
      totalVolume: createContainerDto.totalVolume,
      description: createContainerDto.description,
      createdBy: user,
      status: ContainerStatus.ACTIVE,
    });

    const saved = await this.containerRepository.save(container);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del(`containers:user:${user.id}`);
    return saved;
  }

  async findAll(
    paginationDto: PaginationDto,
    status?: ContainerStatus,
    includeDeleted: boolean = false,
  ): Promise<PaginatedResponseDto<Container>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.createdBy', 'createdBy')
      .leftJoinAndSelect('container.items', 'items');

    // ✅ Soft Delete filter
    if (!includeDeleted) {
      queryBuilder.where('container.deletedAt IS NULL');
    }

    if (status) {
      queryBuilder.andWhere('container.status = :status', { status });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`container.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findActiveContainers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.findAll(paginationDto, ContainerStatus.ACTIVE);
  }

  async findArchivedContainers(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    return this.findAll(paginationDto, ContainerStatus.ARCHIVED);
  }

  async searchContainers(
    query: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.createdBy', 'createdBy')
      .leftJoinAndSelect('container.items', 'items')
      .where('container.deletedAt IS NULL')
      .andWhere(
        '(container.name ILIKE :query OR container.containerCode ILIKE :query)',
        { query: `%${query}%` },
      );

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`container.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string, includeDeleted: boolean = false): Promise<Container> {
    const cacheKey = `container:${id}`;
    const cached = await this.cacheManager.get<Container>(cacheKey);
    if (cached) {
      return cached;
    }

    const container = await this.containerRepository.findOne({
      where: includeDeleted ? { id } : { id, deletedAt: IsNull() },
      relations: {
        createdBy: true,
        items: true,
      },
      withDeleted: includeDeleted,
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    await this.cacheManager.set(cacheKey, container, 300);
    return container;
  }

  async update(id: string, updateContainerDto: UpdateContainerDto): Promise<Container> {
    const container = await this.findOne(id);
    Object.assign(container, updateContainerDto);
    const updated = await this.containerRepository.save(container);

    await this.cacheManager.del(`container:${id}`);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del(`containers:status:${container.status}`);

    return updated;
  }

  async updateStatus(id: string, status: ContainerStatus): Promise<Container> {
    const container = await this.findOne(id);
    container.status = status;
    const updated = await this.containerRepository.save(container);

    await this.cacheManager.del(`container:${id}`);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del('containers:status:active');
    await this.cacheManager.del('containers:status:archived');
    await this.cacheManager.del('containers:status:shipped');

    return updated;
  }

  // ✅ Soft Delete - Mark as deleted
  async softDelete(id: string): Promise<void> {
    const container = await this.findOne(id);
    if (container.items && container.items.length > 0) {
      throw new BadRequestException('Cannot delete container with items');
    }
    await this.containerRepository.softDelete(id);

    await this.cacheManager.del(`container:${id}`);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del(`containers:status:${container.status}`);
  }

  // ✅ Restore - Recover soft deleted
  async restore(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    if (!container.deletedAt) {
      throw new BadRequestException('Container is not deleted');
    }

    await this.containerRepository.restore(id);

    await this.cacheManager.del(`container:${id}`);
    await this.cacheManager.del('containers:all');

    return this.findOne(id);
  }

  // ✅ Permanent Delete - Hard delete
  async permanentDelete(id: string): Promise<void> {
    const container = await this.containerRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    if (container.items && container.items.length > 0) {
      throw new BadRequestException('Cannot delete container with items');
    }

    await this.containerRepository.remove(container);

    await this.cacheManager.del(`container:${id}`);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del(`containers:status:${container.status}`);
  }

  // ✅ Get deleted containers
  async findDeleted(paginationDto: PaginationDto): Promise<PaginatedResponseDto<Container>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.createdBy', 'createdBy')
      .leftJoinAndSelect('container.items', 'items')
      .where('container.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`container.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async updateUsedVolume(containerId: string): Promise<void> {
    const result = await this.containerRepository
      .createQueryBuilder()
      .select('SUM(item.totalVolume)', 'sum')
      .from('items', 'item')
      .where('item.containerId = :containerId', { containerId })
      .getRawOne();

    const usedVolume = parseFloat(result?.sum) || 0;
    await this.containerRepository.update(containerId, { usedVolume });

    await this.cacheManager.del(`container:${containerId}`);
    await this.cacheManager.del('containers:all');
    await this.cacheManager.del('containers:status:active');
    await this.cacheManager.del('containers:status:archived');
    await this.cacheManager.del('containers:status:shipped');
  }
}