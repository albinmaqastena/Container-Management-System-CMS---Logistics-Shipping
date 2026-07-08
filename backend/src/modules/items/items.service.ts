// src/modules/items/items.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Item } from './entities/item.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ContainersService } from '../containers/containers.service';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    private containersService: ContainersService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async create(createItemDto: CreateItemDto): Promise<Item> {
    const container = await this.containersService.findOne(
      createItemDto.containerId,
    );

    const totalVolume = createItemDto.packageQuantity * createItemDto.volume;

    if (container.availableVolume < totalVolume) {
      throw new BadRequestException(
        `Not enough volume in container. Available: ${container.availableVolume}, Required: ${totalVolume}`,
      );
    }

    const item = new Item({
      uniqueNumber: createItemDto.uniqueNumber,
      name: createItemDto.name,
      photo: createItemDto.photo,
      packageQuantity: createItemDto.packageQuantity,
      productsPerPackage: createItemDto.productsPerPackage,
      packagePrice: createItemDto.packagePrice,
      volume: createItemDto.volume,
      totalVolume: totalVolume,
      container: container,
    });

    try {
      const saved = await this.itemRepository.save(item);
      await this.containersService.updateUsedVolume(container.id);

      await this.cacheManager.del(`container:${container.id}`);
      await this.cacheManager.del(`items:container:${container.id}`);
      await this.cacheManager.del('containers:all');

      return saved;
    } catch (error) {
      if (error === '23505') {
        throw new ConflictException(
          `Item with uniqueNumber "${createItemDto.uniqueNumber}" already exists.`,
        );
      }
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    containerId?: string,
    includeDeleted: boolean = false,
  ): Promise<PaginatedResponseDto<Item>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.container', 'container');

    if (!includeDeleted) {
      queryBuilder.where('item.deletedAt IS NULL');
    }

    if (containerId) {
      queryBuilder.andWhere('item.containerId = :containerId', { containerId });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.items);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`item.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async searchItems(
    query: string,
    paginationDto: PaginationDto,
    containerId?: string,
  ): Promise<PaginatedResponseDto<Item>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.container', 'container')
      .where('item.deletedAt IS NULL')
      .andWhere(
        '(item.name ILIKE :query OR item.uniqueNumber ILIKE :query)',
        { query: `%${query}%` },
      );

    if (containerId) {
      queryBuilder.andWhere('item.containerId = :containerId', { containerId });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.items);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`item.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string, includeDeleted: boolean = false): Promise<Item> {
    const item = await this.itemRepository.findOne({
      where: includeDeleted ? { id } : { id, deletedAt: IsNull() },
      relations: { container: true },
      withDeleted: includeDeleted,
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async findDeleted(paginationDto: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.container', 'container')
      .where('item.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.items);
    Object.keys(sortObject).forEach((key) => {
      queryBuilder.addOrderBy(`item.${key}`, sortObject[key]);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async update(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);
    const oldVolume = item.totalVolume;
    const oldContainerId = item.container.id;

    Object.assign(item, updateItemDto);

    if (
      updateItemDto.packageQuantity !== undefined ||
      updateItemDto.volume !== undefined
    ) {
      item.calculateTotalVolume();
    }

    if (item.totalVolume !== oldVolume) {
      const container = await this.containersService.findOne(oldContainerId);
      const otherItemsTotal = container.items
        .filter((i) => i.id !== id)
        .reduce((sum, i) => sum + i.totalVolume, 0);
      const newTotalVolume = item.totalVolume;
      const newUsedVolume = otherItemsTotal + newTotalVolume;

      if (newUsedVolume > container.totalVolume) {
        throw new BadRequestException(
          `Not enough volume in container. Available: ${container.totalVolume - otherItemsTotal}, Required: ${newTotalVolume}`,
        );
      }
    }

    const updated = await this.itemRepository.save(item);
    await this.containersService.updateUsedVolume(oldContainerId);

    await this.cacheManager.del(`item:${id}`);
    await this.cacheManager.del(`items:container:${oldContainerId}`);
    await this.cacheManager.del(`container:${oldContainerId}`);
    await this.cacheManager.del('containers:all');

    return updated;
  }

  // ✅ Soft Delete - Mark as deleted
  async softDelete(id: string): Promise<void> {
    const item = await this.findOne(id);
    const containerId = item.container.id;

    await this.itemRepository.softDelete(id);
    await this.containersService.updateUsedVolume(containerId);

    await this.cacheManager.del(`item:${id}`);
    await this.cacheManager.del(`items:container:${containerId}`);
    await this.cacheManager.del(`container:${containerId}`);
    await this.cacheManager.del('containers:all');
  }

  // ✅ Restore - Recover soft deleted item
  async restore(id: string): Promise<Item> {
    const item = await this.itemRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.deletedAt) {
      throw new BadRequestException('Item is not deleted');
    }

    await this.itemRepository.restore(id);
    await this.containersService.updateUsedVolume(item.containerId);

    await this.cacheManager.del(`item:${id}`);
    await this.cacheManager.del(`items:container:${item.containerId}`);
    await this.cacheManager.del(`container:${item.containerId}`);
    await this.cacheManager.del('containers:all');

    return this.findOne(id);
  }

  // ✅ Permanent Delete - Hard delete
  async permanentDelete(id: string): Promise<void> {
    const item = await this.itemRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const containerId = item.containerId;
    await this.itemRepository.remove(item);
    await this.containersService.updateUsedVolume(containerId);

    await this.cacheManager.del(`item:${id}`);
    await this.cacheManager.del(`items:container:${containerId}`);
    await this.cacheManager.del(`container:${containerId}`);
    await this.cacheManager.del('containers:all');
  }
}