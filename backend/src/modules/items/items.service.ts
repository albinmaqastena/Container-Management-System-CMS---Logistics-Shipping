// src/modules/items/items.service.ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThan,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { FilesService } from '../files/files.service';

import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './entities/item.entity';
import { Container, ContainerStatus } from '../containers/entities/container.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { ALLOWED_SORT_FIELDS, buildSortObject } from '../../common/utils/sort.utils';

// Constants for cleanup, pagination, and validation
const CLEANUP_BATCH_SIZE = 50;
const MAX_RETENTION_DAYS = 3650;
const DEFAULT_PAGINATION_LIMIT = 10;
const MIN_RETENTION_DAYS = 1;
const MAX_SEARCH_QUERY_LENGTH = 200;
const DEFAULT_DECIMAL_SCALE = 2;

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    private readonly filesService: FilesService,
  ) {}

  private roundDecimal(value: number, scale = DEFAULT_DECIMAL_SCALE): number {
    const factor = 10 ** scale;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private parseFiniteNumber(value: unknown, fieldName: string): number {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(`${fieldName} is invalid`);
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }

    return parsed;
  }

  private async clearItemCaches(containerId: string): Promise<void> {
    try {
      await Promise.all([
        this.cacheManager.del(`container:${containerId}:false`),
        this.cacheManager.del(`container:${containerId}:true`),
        this.cacheManager.del(`items:container:${containerId}`),
      ]);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to clear caches for container ${containerId}: ${
          error instanceof Error ? error.message : 'Unknown cache error'
        }`,
      );
    }
  }

  private applySort(queryBuilder: SelectQueryBuilder<Item>, sort?: string): void {
    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.items);
    const sortEntries = Object.entries(sortObject);

    sortEntries.forEach(([field, direction]) => {
      if (field === 'deletedAt') {
        queryBuilder.addOrderBy(
          `item.${field}`,
          direction,
          direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST',
        );
        return;
      }

      queryBuilder.addOrderBy(`item.${field}`, direction);
    });

    // Tie-breaker: ensure deterministic order by adding ID with the same direction as the primary sort
    if (!sortEntries.some(([field]) => field === 'id')) {
      const primaryDirection = sortEntries[0]?.[1] ?? 'DESC';
      queryBuilder.addOrderBy('item.id', primaryDirection);
    }
  }

  private async getActiveVolume(
    manager: EntityManager,
    containerId: string,
    excludeItemId?: string,
  ): Promise<number> {
    const itemRepo = manager.getRepository(Item);
    const queryBuilder = itemRepo
      .createQueryBuilder('item')
      .select('COALESCE(SUM(item.totalVolume), 0)', 'sum')
      .where('item.containerId = :containerId', { containerId })
      .andWhere('item.deletedAt IS NULL');

    if (excludeItemId) {
      queryBuilder.andWhere('item.id != :excludeItemId', {
        excludeItemId,
      });
    }

    const result = await queryBuilder.getRawOne<{
      sum: string | number;
    }>();

    return this.roundDecimal(this.parseFiniteNumber(result?.sum ?? 0, 'Active item volume'));
  }

  private async recalculateUsedVolume(
    manager: EntityManager,
    containerId: string,
  ): Promise<number> {
    const usedVolume = await this.getActiveVolume(manager, containerId);

    await manager.getRepository(Container).update(containerId, {
      usedVolume,
    });

    return usedVolume;
  }

  private async findItemReference(
    manager: EntityManager,
    id: string,
    includeDeleted: boolean,
  ): Promise<Item> {
    const itemRepo = manager.getRepository(Item);
    const item = await itemRepo.findOne({
      where: includeDeleted
        ? { id }
        : {
            id,
            deletedAt: IsNull(),
          },
      withDeleted: includeDeleted,
      select: {
        id: true,
        containerId: true,
        deletedAt: true,
        deletedByContainer: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  private async lockContainer(
    manager: EntityManager,
    containerId: string,
    includeDeleted = false,
  ): Promise<Container> {
    const containerRepo = manager.getRepository(Container);
    const queryBuilder = containerRepo
      .createQueryBuilder('container')
      .setLock('pessimistic_write')
      .where('container.id = :containerId', { containerId });

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.andWhere('container.deletedAt IS NULL');
    }

    const container = await queryBuilder.getOne();

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    return container;
  }

  private async lockItem(
    manager: EntityManager,
    id: string,
    includeDeleted = false,
  ): Promise<Item> {
    const itemRepo = manager.getRepository(Item);
    const queryBuilder = itemRepo
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id = :id', { id });

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.andWhere('item.deletedAt IS NULL');
    }

    const item = await queryBuilder.getOne();

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async create(createItemDto: CreateItemDto): Promise<Item> {
    let createdItemId!: string;
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const container = await this.lockContainer(manager, createItemDto.containerId);

      if (container.status !== ContainerStatus.ACTIVE) {
        throw new BadRequestException('Items can only be created in active containers');
      }

      const totalVolume = this.roundDecimal(createItemDto.packageQuantity * createItemDto.volume);

      if (!Number.isFinite(totalVolume) || totalVolume <= 0) {
        throw new BadRequestException(
          'Invalid volume calculation. Please check packageQuantity and volume.',
        );
      }

      // Use container.usedVolume directly instead of SUM() for better performance.
      // Convert to number because PostgreSQL decimal may be returned as string.
      const usedVolume = this.parseFiniteNumber(container.usedVolume, 'Container used volume');
      const totalContainerVolume = this.parseFiniteNumber(
        container.totalVolume,
        'Container total volume',
      );

      const availableVolume = this.roundDecimal(totalContainerVolume - usedVolume);

      if (totalVolume > availableVolume) {
        throw new BadRequestException(
          `Not enough volume in container. Available: ${availableVolume}, Required: ${totalVolume}`,
        );
      }

      const itemRepo = manager.getRepository(Item);
      const item = itemRepo.create({
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
        deletedByContainer: false,
      });

      try {
        const savedItem = await itemRepo.save(item);
        createdItemId = savedItem.id;
      } catch (error: unknown) {
        if (this.isDatabaseError(error, '23505')) {
          throw new ConflictException(
            `Item with uniqueNumber "${createItemDto.uniqueNumber}" already exists.`,
          );
        }

        this.rethrowUnknown(error);
      }

      containerId = container.id;

      // Update used volume manually to avoid an extra SUM query.
      // Ensure we round the result to avoid floating point drift.
      const newUsedVolume = this.roundDecimal(usedVolume + totalVolume);
      await manager.getRepository(Container).update(containerId, {
        usedVolume: newUsedVolume,
      });
    });

    await this.clearItemCaches(containerId);
    return this.findOne(createdItemId);
  }

  async findAll(
    paginationDto: PaginationDto,
    containerId?: string,
    includeDeleted = false,
  ): Promise<PaginatedResponseDto<Item>> {
    const limit = paginationDto.limit ?? DEFAULT_PAGINATION_LIMIT;
    const offset = paginationDto.offset ?? 0;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.container', 'container');

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.where('item.deletedAt IS NULL');
    }

    if (containerId) {
      queryBuilder.andWhere('item.containerId = :containerId', {
        containerId,
      });
    }

    this.applySort(queryBuilder, paginationDto.sort);
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async searchItems(
    query: string,
    paginationDto: PaginationDto,
    containerId?: string,
  ): Promise<PaginatedResponseDto<Item>> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Search query cannot be empty');
    }

    if (normalizedQuery.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new BadRequestException(
        `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
      );
    }

    const limit = paginationDto.limit ?? DEFAULT_PAGINATION_LIMIT;
    const offset = paginationDto.offset ?? 0;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.container', 'container')
      .where('item.deletedAt IS NULL')
      .andWhere('(item.name ILIKE :query OR item.uniqueNumber ILIKE :query)', {
        query: `%${normalizedQuery}%`,
      });

    if (containerId) {
      queryBuilder.andWhere('item.containerId = :containerId', {
        containerId,
      });
    }

    this.applySort(queryBuilder, paginationDto.sort);
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string, includeDeleted = false): Promise<Item> {
    const item = await this.itemRepository.findOne({
      where: includeDeleted ? { id } : { id, deletedAt: IsNull() },
      relations: {
        container: true,
      },
      withDeleted: includeDeleted,
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async findDeleted(paginationDto: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    const limit = paginationDto.limit ?? DEFAULT_PAGINATION_LIMIT;
    const offset = paginationDto.offset ?? 0;

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .withDeleted()
      .leftJoinAndSelect('item.container', 'container')
      .where('item.deletedAt IS NOT NULL');

    this.applySort(queryBuilder, paginationDto.sort);
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async update(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    let updatedItemId!: string;
    let containerId!: string;
    let oldPhotoPath: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(Item);

      const itemReference = await this.findItemReference(manager, id, false);

      containerId = itemReference.containerId;

      const container = await this.lockContainer(manager, containerId, true);

      if (container.deletedAt) {
        throw new BadRequestException('Cannot update an item in a deleted container');
      }

      if (container.status !== ContainerStatus.ACTIVE) {
        throw new BadRequestException('Items can only be updated in active containers');
      }

      const item = await this.lockItem(manager, id);

      if (item.containerId !== containerId) {
        throw new BadRequestException('Item container changed during update. Please retry.');
      }

      if (updateItemDto.uniqueNumber !== undefined) {
        item.uniqueNumber = updateItemDto.uniqueNumber;
      }

      if (updateItemDto.name !== undefined) {
        item.name = updateItemDto.name;
      }

      if (updateItemDto.photo !== undefined && updateItemDto.photo !== item.photo) {
        oldPhotoPath = item.photo;
        item.photo = updateItemDto.photo;
      }

      if (updateItemDto.packageQuantity !== undefined) {
        item.packageQuantity = updateItemDto.packageQuantity;
      }

      if (updateItemDto.productsPerPackage !== undefined) {
        item.productsPerPackage = updateItemDto.productsPerPackage;
      }

      if (updateItemDto.packagePrice !== undefined) {
        item.packagePrice = updateItemDto.packagePrice;
      }

      if (updateItemDto.volume !== undefined) {
        item.volume = updateItemDto.volume;
      }

      item.totalVolume = this.roundDecimal(Number(item.packageQuantity) * Number(item.volume));

      if (!Number.isFinite(item.totalVolume) || item.totalVolume <= 0) {
        throw new BadRequestException('Item total volume must be a valid number greater than 0');
      }

      const otherItemsTotal = await this.getActiveVolume(manager, containerId, id);

      const totalContainerVolume = this.parseFiniteNumber(
        container.totalVolume,
        'Container total volume',
      );

      const resultingUsedVolume = this.roundDecimal(otherItemsTotal + item.totalVolume);

      if (resultingUsedVolume > totalContainerVolume) {
        const availableVolume = this.roundDecimal(totalContainerVolume - otherItemsTotal);

        throw new BadRequestException(
          `Not enough volume in container. Available: ${availableVolume}, Required: ${item.totalVolume}`,
        );
      }

      try {
        const savedItem = await itemRepo.save(item);
        updatedItemId = savedItem.id;
      } catch (error: unknown) {
        if (this.isDatabaseError(error, '23505')) {
          throw new ConflictException(
            `Item with uniqueNumber "${item.uniqueNumber}" already exists.`,
          );
        }

        this.rethrowUnknown(error);
      }

      await this.recalculateUsedVolume(manager, containerId);
    });

    // Delete old photo only after the database transaction has committed successfully
    // Note: The new photo (updateItemDto.photo) is NOT cleaned up by this service.
    // If the transaction fails, the new photo file becomes orphan and should be
    // cleaned up by the caller (controller / orchestration layer) that uploaded it.
    if (oldPhotoPath) {
      await this.deleteFileSafely(oldPhotoPath);
    }

    await this.clearItemCaches(containerId);

    return this.findOne(updatedItemId);
  }

  async softDelete(id: string): Promise<void> {
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const itemReference = await this.findItemReference(manager, id, false);

      containerId = itemReference.containerId;

      await this.lockContainer(manager, containerId, true);
      await this.lockItem(manager, id);

      const itemRepo = manager.getRepository(Item);

      // Mark as individually deleted (not deleted with container)
      await itemRepo.update(id, { deletedByContainer: false });
      await itemRepo.softDelete(id);
      await this.recalculateUsedVolume(manager, containerId);
    });

    await this.clearItemCaches(containerId);
  }

  async restore(id: string): Promise<Item> {
    let restoredItemId!: string;
    let containerId!: string;

    await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(Item);

      const itemReference = await this.findItemReference(manager, id, true);

      if (!itemReference.deletedAt) {
        throw new BadRequestException('Item is not deleted');
      }

      if (itemReference.deletedByContainer) {
        throw new BadRequestException(
          'Item was deleted with its container and must be restored through the container',
        );
      }

      containerId = itemReference.containerId;

      const container = await this.lockContainer(manager, containerId, true);

      if (container.deletedAt) {
        throw new BadRequestException('Cannot restore an item into a deleted container');
      }

      const item = await this.lockItem(manager, id, true);

      if (!item.deletedAt) {
        throw new BadRequestException('Item is not deleted');
      }

      // Double-check the flag after locking to prevent race conditions
      if (item.deletedByContainer) {
        throw new BadRequestException(
          'Item was deleted with its container and must be restored through the container',
        );
      }

      if (item.containerId !== containerId) {
        throw new BadRequestException('Item container changed during restore. Please retry.');
      }

      const usedVolume = await this.getActiveVolume(manager, containerId);
      const requiredVolume = this.parseFiniteNumber(item.totalVolume, 'Item total volume');
      if (requiredVolume <= 0) {
        throw new BadRequestException('Item total volume must be greater than 0');
      }
      const totalContainerVolume = this.parseFiniteNumber(
        container.totalVolume,
        'Container total volume',
      );

      const resultingUsedVolume = this.roundDecimal(usedVolume + requiredVolume);

      if (resultingUsedVolume > totalContainerVolume) {
        const availableVolume = this.roundDecimal(totalContainerVolume - usedVolume);

        throw new BadRequestException(
          `Not enough volume in container. Available: ${availableVolume}, Required: ${requiredVolume}`,
        );
      }

      const restoreResult = await itemRepo.restore(id);

      if (!restoreResult.affected) {
        throw new NotFoundException('Item could not be restored');
      }

      // Ensure the flag is false for individually restored items
      await itemRepo.update(id, { deletedByContainer: false });

      await this.recalculateUsedVolume(manager, containerId);

      restoredItemId = id;
    });

    await this.clearItemCaches(containerId);
    return this.findOne(restoredItemId);
  }

  async permanentDelete(id: string): Promise<void> {
    let containerId!: string;
    let photoPath: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(Item);

      const itemReference = await this.findItemReference(manager, id, true);

      if (!itemReference.deletedAt) {
        throw new BadRequestException('Item must be soft-deleted before permanent deletion');
      }

      if (itemReference.deletedByContainer) {
        throw new BadRequestException(
          'Item was deleted with its container and must be permanently deleted through the container',
        );
      }

      containerId = itemReference.containerId;

      await this.lockContainer(manager, containerId, true);

      const item = await this.lockItem(manager, id, true);

      if (!item.deletedAt) {
        throw new BadRequestException('Item must be soft-deleted before permanent deletion');
      }

      if (item.deletedByContainer) {
        throw new BadRequestException(
          'Item was deleted with its container and must be permanently deleted through the container',
        );
      }

      photoPath = item.photo;

      await itemRepo.remove(item);

      await this.recalculateUsedVolume(manager, containerId);
    });

    if (photoPath) {
      await this.deleteFileSafely(photoPath);
    }

    await this.clearItemCaches(containerId);
  }

  async cleanupExpiredItems(retentionDays: number): Promise<number> {
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < MIN_RETENTION_DAYS ||
      retentionDays > MAX_RETENTION_DAYS
    ) {
      throw new BadRequestException(
        `Retention days must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`,
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    let failedCount = 0;

    this.logger.log(`Starting expired item cleanup with retention period of ${retentionDays} days`);

    try {
      while (true) {
        const expiredItems = await this.itemRepository.find({
          where: {
            deletedAt: LessThan(cutoffDate),
            deletedByContainer: false,
          },
          withDeleted: true,
          select: {
            id: true,
            containerId: true,
          },
          order: {
            deletedAt: 'ASC',
            id: 'ASC',
          },
          take: CLEANUP_BATCH_SIZE,
        });

        if (expiredItems.length === 0) {
          break;
        }

        let deletedInBatch = 0;

        for (const item of expiredItems) {
          try {
            await this.permanentDelete(item.id);
            deletedCount++;
            deletedInBatch++;
          } catch (error: unknown) {
            failedCount++;
            this.logger.error(
              `Failed to permanently delete expired item ${item.id}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          }
        }

        if (deletedInBatch === 0) {
          this.logger.error(
            'Cleanup stopped because no item in the current batch could be deleted',
          );
          break;
        }
      }

      this.logger.log(
        `Expired item cleanup completed: ${deletedCount} deleted, ${failedCount} failed`,
      );

      return deletedCount;
    } catch (error: unknown) {
      this.logger.error(
        `Cleanup of expired items failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  private async deleteFileSafely(filePath: string): Promise<void> {
    try {
      await this.filesService.deleteFile(filePath);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`Item file was already missing: ${filePath}`);
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to delete item file ${filePath}: ${message}`, stack);
    }
  }

  private isDatabaseError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code
    );
  }

  private rethrowUnknown(error: unknown): never {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unknown database error');
  }
}
