// src/modules/items/items.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, IsNull } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Item } from './entities/item.entity';
import { Container } from '../containers/entities/container.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ContainersService } from '../containers/containers.service';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly containersService: ContainersService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
  ) {}

  private async clearContainerCache(containerId: string): Promise<void> {
    await this.cacheManager.del(`container:${containerId}:false`);
    await this.cacheManager.del(`container:${containerId}:true`);
  }

  private async recalculateUsedVolume(
    manager: EntityManager,
    containerId: string,
  ): Promise<number> {
    const result = await manager
      .getRepository(Item)
      .createQueryBuilder('item')
      .select('COALESCE(SUM(item.totalVolume), 0)', 'sum')
      .where('item.containerId = :containerId', { containerId })
      .andWhere('item.deletedAt IS NULL')
      .getRawOne<{ sum: string }>();

    const usedVolume = Number(result?.sum) || 0;
    await manager.getRepository(Container).update(containerId, { usedVolume });
    return usedVolume;
  }

  // CREATE - transaction + pessimistic lock për të shmangur tejkalimin e kapacitetit
  async create(createItemDto: CreateItemDto): Promise<Item> {
    let createdItem!: Item;
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const container = await manager
        .getRepository(Container)
        .createQueryBuilder('container')
        .setLock('pessimistic_write')
        .where('container.id = :id', { id: createItemDto.containerId })
        .andWhere('container.deletedAt IS NULL')
        .getOne();

      if (!container) {
        throw new NotFoundException('Container not found');
      }

      const totalVolume = createItemDto.packageQuantity * createItemDto.volume;
      if (totalVolume <= 0) {
        throw new BadRequestException(
          'Invalid volume calculation. Please check packageQuantity and volume.',
        );
      }

      const currentUsedVolume = await manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .select('COALESCE(SUM(item.totalVolume), 0)', 'sum')
        .where('item.containerId = :containerId', { containerId: container.id })
        .andWhere('item.deletedAt IS NULL')
        .getRawOne<{ sum: string }>();

      const usedVolume = Number(currentUsedVolume?.sum) || 0;
      const availableVolume = container.totalVolume - usedVolume;
      if (availableVolume < totalVolume) {
        throw new BadRequestException(
          `Not enough volume in container. Available: ${availableVolume}, Required: ${totalVolume}`,
        );
      }

      const item = manager.getRepository(Item).create({
        uniqueNumber: createItemDto.uniqueNumber,
        name: createItemDto.name,
        photo: createItemDto.photo,
        packageQuantity: createItemDto.packageQuantity,
        productsPerPackage: createItemDto.productsPerPackage,
        packagePrice: createItemDto.packagePrice,
        volume: createItemDto.volume,
        totalVolume,
        container,
        containerId: container.id,
      });

      try {
        createdItem = await manager.getRepository(Item).save(item);
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new ConflictException(
            `Item with uniqueNumber "${createItemDto.uniqueNumber}" already exists.`,
          );
        }
        throw error;
      }

      containerId = container.id;
      await this.recalculateUsedVolume(manager, containerId);
    });

    await this.clearContainerCache(containerId);
    await this.cacheManager.del(`items:container:${containerId}`);
    return createdItem;
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

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.where('item.deletedAt IS NULL');
    }

    if (containerId) {
      queryBuilder.andWhere('item.containerId = :containerId', { containerId });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.items);

    Object.entries(sortObject).forEach(([key, direction]) => {
      if (key === 'deletedAt') {
        queryBuilder.addOrderBy(
          `item.${key}`,
          direction,
          direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST',
        );
        return;
      }

      queryBuilder.addOrderBy(`item.${key}`, direction);
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
      .andWhere('(item.name ILIKE :query OR item.uniqueNumber ILIKE :query)', {
        query: `%${query.trim()}%`,
      });

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
      .withDeleted()
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

  // UPDATE - transaction + lock mbi container-in
  async update(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    let updatedItem!: Item;
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      // Lock only the item row. PostgreSQL can fail when FOR UPDATE
      // is applied to the nullable side of a LEFT JOIN.
      const item = await manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.id = :id', { id })
        .andWhere('item.deletedAt IS NULL')
        .getOne();

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      const container = await manager
        .getRepository(Container)
        .createQueryBuilder('container')
        .setLock('pessimistic_write')
        .where('container.id = :containerId', { containerId: item.containerId })
        .withDeleted()
        .getOne();

      if (!container || container.deletedAt) {
        throw new BadRequestException('Cannot update an item in a deleted container');
      }

      if (updateItemDto.uniqueNumber !== undefined) item.uniqueNumber = updateItemDto.uniqueNumber;
      if (updateItemDto.name !== undefined) item.name = updateItemDto.name;
      if (updateItemDto.photo !== undefined) item.photo = updateItemDto.photo;
      if (updateItemDto.packageQuantity !== undefined)
        item.packageQuantity = updateItemDto.packageQuantity;
      if (updateItemDto.productsPerPackage !== undefined)
        item.productsPerPackage = updateItemDto.productsPerPackage;
      if (updateItemDto.packagePrice !== undefined) item.packagePrice = updateItemDto.packagePrice;
      if (updateItemDto.volume !== undefined) item.volume = updateItemDto.volume;

      item.totalVolume = item.packageQuantity * item.volume;
      if (item.totalVolume <= 0) {
        throw new BadRequestException('Item total volume must be greater than 0');
      }

      const otherItems = await manager
        .getRepository(Item)
        .createQueryBuilder('otherItem')
        .select('COALESCE(SUM(otherItem.totalVolume), 0)', 'sum')
        .where('otherItem.containerId = :containerId', {
          containerId: item.containerId,
        })
        .andWhere('otherItem.id != :id', { id })
        .andWhere('otherItem.deletedAt IS NULL')
        .getRawOne<{ sum: string }>();

      const otherItemsTotal = Number(otherItems?.sum) || 0;
      if (otherItemsTotal + item.totalVolume > container.totalVolume) {
        throw new BadRequestException(
          `Not enough volume in container. Available: ${container.totalVolume - otherItemsTotal}, Required: ${item.totalVolume}`,
        );
      }

      try {
        updatedItem = await manager.getRepository(Item).save(item);
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new ConflictException(
            `Item with uniqueNumber "${item.uniqueNumber}" already exists.`,
          );
        }
        throw error;
      }

      containerId = item.containerId;
      await this.recalculateUsedVolume(manager, containerId);
    });

    await this.clearContainerCache(containerId);
    await this.cacheManager.del(`items:container:${containerId}`);
    return updatedItem;
  }

  // ✅ SOFT DELETE - me transaction dhe ruajtje të containerId
  async softDelete(id: string): Promise<void> {
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const item = await manager.getRepository(Item).findOne({
        where: { id, deletedAt: IsNull() },
        relations: { container: true },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      containerId = item.containerId;

      await manager.getRepository(Item).softDelete(id);

      await this.recalculateUsedVolume(manager, containerId);
    });

    await this.clearContainerCache(containerId);
    await this.cacheManager.del(`items:container:${containerId}`);
  }

  // ✅ RESTORE - me transaction, pa cache, dhe kontroll të kapacitetit
  async restore(id: string): Promise<Item> {
    let restoredItem!: Item;
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const item = await manager.getRepository(Item).findOne({
        where: { id },
        relations: { container: true },
        withDeleted: true,
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      if (!item.deletedAt) {
        throw new BadRequestException('Item is not deleted');
      }

      containerId = item.containerId;

      const container = await this.containersService.findOneIncludingDeleted(containerId);

      if (container.deletedAt) {
        throw new BadRequestException('Cannot restore an item into a deleted container');
      }

      if (container.availableVolume < item.totalVolume) {
        throw new BadRequestException(
          `Not enough volume in container. Available: ${container.availableVolume}, Required: ${item.totalVolume}`,
        );
      }

      await manager.getRepository(Item).restore(id);

      await this.recalculateUsedVolume(manager, containerId);

      const restored = await manager.getRepository(Item).findOne({
        where: { id },
        relations: { container: true },
      });

      if (!restored) {
        throw new NotFoundException('Item not found after restore');
      }

      restoredItem = restored;
    });

    await this.clearContainerCache(containerId);
    await this.cacheManager.del(`items:container:${containerId}`);

    return restoredItem;
  }

  // ✅ PERMANENT DELETE - me transaction
  async permanentDelete(id: string): Promise<void> {
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const item = await manager.getRepository(Item).findOne({
        where: { id },
        withDeleted: true,
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      containerId = item.containerId;

      await manager.getRepository(Item).remove(item);

      await this.recalculateUsedVolume(manager, containerId);
    });

    await this.clearContainerCache(containerId);
    await this.cacheManager.del(`items:container:${containerId}`);
  }
}
