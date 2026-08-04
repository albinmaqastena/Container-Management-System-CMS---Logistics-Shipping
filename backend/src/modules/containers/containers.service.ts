// src/modules/containers/containers.service.ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';

import { Container, ContainerStatus } from './entities/container.entity';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { User } from '../auth/entities/user.entity';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { buildSortObject, ALLOWED_SORT_FIELDS } from '../../common/utils/sort.utils';
import { Item } from '../items/entities/item.entity';

import { FilesService } from '../files/files.service';

@Injectable()
export class ContainersService {
  private readonly logger = new Logger(ContainersService.name);

  // Cache TTL: 5 minutes in milliseconds
  private readonly CONTAINER_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Container)
    private readonly containerRepository: Repository<Container>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    private readonly filesService: FilesService,
  ) {}

  private async clearContainerCache(id?: string): Promise<void> {
    if (!id) {
      return;
    }

    const keys = [`container:${id}:false`, `container:${id}:true`];

    try {
      await Promise.all(keys.map((k) => this.cacheManager.del(k)));
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to clear container cache for container ${id}: ${
          error instanceof Error ? error.message : 'Unknown cache error'
        }`,
      );
    }
  }

  private async ensureUniqueName(
    name: string,
    excludeId?: string,
    repository: Repository<Container> = this.containerRepository,
  ): Promise<void> {
    const queryBuilder = repository
      .createQueryBuilder('container')
      .withDeleted()
      .where('LOWER(container.name) = LOWER(:name)', { name });

    if (excludeId) {
      queryBuilder.andWhere('container.id != :excludeId', { excludeId });
    }

    const existing = await queryBuilder.getOne();
    if (existing) {
      throw new ConflictException('A container with this name already exists');
    }
  }

  private getConstraintName(error: unknown): string | null {
    if (
      typeof error === 'object' &&
      error !== null &&
      'constraint' in error &&
      typeof (error as { constraint?: unknown }).constraint === 'string'
    ) {
      return (error as { constraint: string }).constraint;
    }
    return null;
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (!this.isDatabaseError(error, '23505')) {
      return;
    }

    const constraint = this.getConstraintName(error);
    if (constraint === 'uq_container_name') {
      throw new ConflictException('A container with this name already exists');
    }
    if (constraint === 'uq_container_code') {
      throw new ConflictException('A container with this code already exists');
    }
    throw new ConflictException('A container with the same unique data already exists');
  }

  private roundDecimal(value: number, scale = 2): number {
    if (!Number.isFinite(value)) {
      throw new Error('Value must be a finite number');
    }
    if (scale < 0 || scale > 10) {
      throw new Error('Scale must be between 0 and 10');
    }
    const factor = 10 ** scale;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private escapeLike(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  }

  async findOneWithoutCache(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        createdBy: true,
      },
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    return container;
  }

  async findOneIncludingDeleted(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id },
      relations: {
        createdBy: true,
      },
      withDeleted: true,
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    return container;
  }

  async create(createContainerDto: CreateContainerDto, user: User): Promise<Container> {
    const name = createContainerDto.customName.trim();
    if (!name) {
      throw new BadRequestException('Container name is required');
    }

    const rawTotalVolume = Number(createContainerDto.totalVolume);
    if (!Number.isFinite(rawTotalVolume) || rawTotalVolume <= 0) {
      throw new BadRequestException('Total volume must be greater than 0');
    }
    const totalVolume = this.roundDecimal(rawTotalVolume);

    const description = createContainerDto.description?.trim() ?? '';

    await this.ensureUniqueName(name);

    const containerCode = `CNT-${uuidv4().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    const container = new Container({
      name,
      containerCode,
      totalVolume,
      description,
      createdBy: user,
      status: ContainerStatus.ACTIVE,
      usedVolume: 0,
    });

    try {
      const saved = await this.containerRepository.save(container);
      await this.clearContainerCache(saved.id);
      return saved;
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
      this.rethrowUnknown(error);
    }
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
      .leftJoinAndSelect('container.createdBy', 'createdBy');

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.where('container.deletedAt IS NULL');
    }

    if (status) {
      queryBuilder.andWhere('container.status = :status', { status });
    }

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    const sortEntries = Object.entries(sortObject);

    sortEntries.forEach(([field, direction]) => {
      if (field === 'deletedAt') {
        queryBuilder.addOrderBy(
          `container.${field}`,
          direction,
          direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST',
        );
        return;
      }
      queryBuilder.addOrderBy(`container.${field}`, direction);
    });

    // Tie-breaker: ensure deterministic order by adding ID with the same direction as the primary sort
    if (!sortEntries.some(([field]) => field === 'id')) {
      const primaryDirection = sortEntries[0]?.[1] ?? 'DESC';
      queryBuilder.addOrderBy('container.id', primaryDirection);
    }

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
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Search query cannot be empty');
    }

    if (normalizedQuery.length > 200) {
      throw new BadRequestException('Search query must not exceed 200 characters');
    }

    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const escaped = this.escapeLike(normalizedQuery);
    const searchPattern = `%${escaped}%`;

    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.createdBy', 'createdBy')
      .where('container.deletedAt IS NULL')
      .andWhere(
        `
          (
            container.name ILIKE :query ESCAPE '\\'
            OR container.containerCode ILIKE :query ESCAPE '\\'
            OR container.description ILIKE :query ESCAPE '\\'
          )
        `,
        { query: searchPattern },
      );

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    const sortEntries = Object.entries(sortObject);

    sortEntries.forEach(([field, direction]) => {
      queryBuilder.addOrderBy(`container.${field}`, direction);
    });

    if (!sortEntries.some(([field]) => field === 'id')) {
      const primaryDirection = sortEntries[0]?.[1] ?? 'DESC';
      queryBuilder.addOrderBy('container.id', primaryDirection);
    }

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(id: string, includeDeleted: boolean = false): Promise<Container> {
    const cacheKey = `container:${id}:${includeDeleted}`;

    try {
      const cached = await this.cacheManager.get<Container>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to read container cache: ${
          error instanceof Error ? error.message : 'Unknown cache error'
        }`,
      );
    }

    const container = await this.containerRepository.findOne({
      where: includeDeleted ? { id } : { id, deletedAt: IsNull() },
      relations: {
        createdBy: true,
      },
      withDeleted: includeDeleted,
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    try {
      await this.cacheManager.set(cacheKey, container, this.CONTAINER_CACHE_TTL_MS);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to set container cache: ${
          error instanceof Error ? error.message : 'Unknown cache error'
        }`,
      );
    }

    return container;
  }

  async update(id: string, updateContainerDto: UpdateContainerDto): Promise<Container> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Container);

        const container = await repository
          .createQueryBuilder('container')
          .setLock('pessimistic_write')
          .where('container.id = :id', { id })
          .andWhere('container.deletedAt IS NULL')
          .getOne();

        if (!container) {
          throw new NotFoundException('Container not found');
        }

        if (updateContainerDto.name !== undefined) {
          const newName = updateContainerDto.name.trim();
          if (!newName) {
            throw new BadRequestException('Container name cannot be empty');
          }

          if (newName.toLowerCase() !== container.name.toLowerCase()) {
            await this.ensureUniqueName(newName, id, repository);
            container.name = newName;
          }
        }

        if (updateContainerDto.description !== undefined) {
          container.description = updateContainerDto.description.trim();
        }

        // Status is updated exclusively via updateStatus() to keep logic centralized

        if (updateContainerDto.totalVolume !== undefined) {
          const rawTotal = Number(updateContainerDto.totalVolume);
          if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
            throw new BadRequestException('Total volume must be greater than 0');
          }
          const totalVolume = this.roundDecimal(rawTotal);

          const rawUsedVolume = Number(container.usedVolume);
          if (!Number.isFinite(rawUsedVolume) || rawUsedVolume < 0) {
            throw new BadRequestException('Container used volume is invalid');
          }
          const usedVolume = this.roundDecimal(rawUsedVolume);

          if (totalVolume < usedVolume) {
            throw new BadRequestException(
              `Total volume cannot be less than used volume (${usedVolume})`,
            );
          }

          container.totalVolume = totalVolume;
        }

        await repository.save(container);
      });
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
      this.rethrowUnknown(error);
    }

    await this.clearContainerCache(id);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: ContainerStatus): Promise<Container> {
    let container: Container | null = null;
    let statusChanged = false;

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Container);

      const found = await repository
        .createQueryBuilder('container')
        .leftJoinAndSelect('container.createdBy', 'createdBy')
        .where('container.id = :id', { id })
        .andWhere('container.deletedAt IS NULL')
        .setLock('pessimistic_write', undefined, ['container'])
        .getOne();

      if (!found) {
        throw new NotFoundException('Container not found');
      }

      container = found;

      if (found.status === status) {
        return;
      }

      found.status = status;
      await repository.save(found);
      statusChanged = true;
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    if (!statusChanged) {
      return container;
    }

    await this.clearContainerCache(id);
    return this.findOne(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const container = await manager
        .getRepository(Container)
        .createQueryBuilder('container')
        .setLock('pessimistic_write')
        .where('container.id = :containerId', { containerId: id })
        .andWhere('container.deletedAt IS NULL')
        .getOne();

      if (!container) {
        throw new NotFoundException('Container not found');
      }

      const itemRepository = manager.getRepository(Item);

      // Lock all active items that will be soft-deleted to prevent concurrent modifications
      await itemRepository
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.containerId = :containerId', { containerId: id })
        .andWhere('item.deletedAt IS NULL')
        .getMany();

      // Mark active items as deleted by container
      await itemRepository.update(
        {
          containerId: id,
          deletedAt: IsNull(),
        },
        {
          deletedByContainer: true,
        },
      );

      // Soft delete only active items (those that were marked)
      await itemRepository.softDelete({
        containerId: id,
        deletedAt: IsNull(),
      });

      const deleteResult = await manager.getRepository(Container).softDelete(id);

      if (!deleteResult.affected) {
        throw new NotFoundException('Container could not be soft-deleted');
      }
    });

    await this.clearContainerCache(id);
  }

  async restore(id: string): Promise<Container> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const containerRepository = manager.getRepository(Container);
        const itemRepository = manager.getRepository(Item);

        const container = await containerRepository
          .createQueryBuilder('container')
          .setLock('pessimistic_write')
          .withDeleted()
          .where('container.id = :containerId', { containerId: id })
          .getOne();

        if (!container) {
          throw new NotFoundException('Container not found');
        }

        if (!container.deletedAt) {
          throw new BadRequestException('Container is not deleted');
        }

        // Check if there are active items (non-deleted) that would prevent restoration
        const activeItems = await itemRepository
          .createQueryBuilder('item')
          .where('item.containerId = :containerId', { containerId: id })
          .andWhere('item.deletedAt IS NULL')
          .getCount();

        if (activeItems > 0) {
          throw new BadRequestException('Container has active items. Cannot restore.');
        }

        // Calculate the total volume of items that will be restored
        const result = await itemRepository
          .createQueryBuilder('item')
          .withDeleted()
          .select('COALESCE(SUM(item.totalVolume), 0)', 'sum')
          .where('item.containerId = :containerId', { containerId: id })
          .andWhere('item.deletedAt IS NOT NULL')
          .andWhere('item.deletedByContainer = true')
          .getRawOne<{ sum: string | number }>();

        const usedVolume = this.roundDecimal(Number(result?.sum ?? 0));

        if (!Number.isFinite(usedVolume)) {
          throw new BadRequestException('Invalid restored item volume');
        }

        // Validate and round container total volume
        const rawTotalVolume = Number(container.totalVolume);
        if (!Number.isFinite(rawTotalVolume) || rawTotalVolume <= 0) {
          throw new BadRequestException('Container total volume is invalid');
        }
        const totalVolume = this.roundDecimal(rawTotalVolume);

        // Check capacity before restoring
        if (usedVolume > totalVolume) {
          throw new BadRequestException(
            `Restored items exceed container capacity (${usedVolume}/${totalVolume})`,
          );
        }

        // Restore container first, then its items
        const containerRestoreResult = await containerRepository.restore(id);

        if (!containerRestoreResult.affected) {
          throw new NotFoundException('Container could not be restored');
        }

        // Restore only items that were deleted together with the container
        await itemRepository.restore({
          containerId: id,
          deletedByContainer: true,
        });

        // Reset the flag for restored items
        await itemRepository.update(
          {
            containerId: id,
            deletedAt: IsNull(),
            deletedByContainer: true,
          },
          {
            deletedByContainer: false,
          },
        );

        // Update used volume
        await containerRepository.update(id, { usedVolume });
      });
    } catch (error: unknown) {
      if (this.isDatabaseError(error, '23505')) {
        throw new ConflictException(
          'Container cannot be restored because its name or one of its item identifiers is already in use',
        );
      }
      this.rethrowUnknown(error);
    }

    await this.clearContainerCache(id);
    return this.findOne(id);
  }

  async permanentDelete(id: string): Promise<void> {
    let photoPaths: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      const containerRepository = manager.getRepository(Container);

      const container = await containerRepository
        .createQueryBuilder('container')
        .setLock('pessimistic_write')
        .withDeleted()
        .where('container.id = :id', { id })
        .getOne();

      if (!container) {
        throw new NotFoundException('Container not found');
      }

      if (!container.deletedAt) {
        throw new BadRequestException('Container must be soft-deleted before permanent deletion');
      }

      const items = await manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .withDeleted()
        .select(['item.id', 'item.photo'])
        .where('item.containerId = :id', { id })
        .getMany();

      photoPaths = items
        .map((item) => item.photo?.trim())
        .filter((photo): photo is string => typeof photo === 'string' && photo.length > 0);

      await manager
        .getRepository(Item)
        .createQueryBuilder()
        .delete()
        .from(Item)
        .where('containerId = :id', { id })
        .execute();

      const deleteResult = await containerRepository
        .createQueryBuilder()
        .delete()
        .from(Container)
        .where('id = :id', { id })
        .execute();

      if (!deleteResult.affected) {
        throw new NotFoundException('Container could not be permanently deleted');
      }
    });

    await this.deleteFilesSafely(photoPaths);
    await this.clearContainerCache(id);
  }

  async findDeleted(paginationDto: PaginationDto): Promise<PaginatedResponseDto<Container>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .withDeleted()
      .leftJoinAndSelect('container.createdBy', 'createdBy')
      .where('container.deletedAt IS NOT NULL');

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    const sortEntries = Object.entries(sortObject);

    sortEntries.forEach(([field, direction]) => {
      queryBuilder.addOrderBy(`container.${field}`, direction);
    });

    if (!sortEntries.some(([field]) => field === 'id')) {
      const primaryDirection = sortEntries[0]?.[1] ?? 'DESC';
      queryBuilder.addOrderBy('container.id', primaryDirection);
    }

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async updateUsedVolume(containerId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const containerRepository = manager.getRepository(Container);

      const container = await containerRepository
        .createQueryBuilder('container')
        .setLock('pessimistic_write')
        .where('container.id = :containerId', { containerId })
        .andWhere('container.deletedAt IS NULL')
        .getOne();

      if (!container) {
        throw new NotFoundException('Container not found');
      }

      const result = await manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .select('COALESCE(SUM(item.totalVolume), 0)', 'sum')
        .where('item.containerId = :containerId', { containerId })
        .andWhere('item.deletedAt IS NULL')
        .getRawOne<{ sum: string | number }>();

      const usedVolume = this.roundDecimal(Number(result?.sum ?? 0));

      if (!Number.isFinite(usedVolume)) {
        throw new BadRequestException('Calculated used volume is invalid');
      }

      // Validate and round container total volume
      const rawTotalVolume = Number(container.totalVolume);
      if (!Number.isFinite(rawTotalVolume) || rawTotalVolume <= 0) {
        throw new BadRequestException('Container total volume is invalid');
      }
      const totalVolume = this.roundDecimal(rawTotalVolume);

      if (usedVolume > totalVolume) {
        throw new BadRequestException(
          `Used volume (${usedVolume}) exceeds total volume (${totalVolume})`,
        );
      }

      await containerRepository.update(containerId, { usedVolume });
    });

    await this.clearContainerCache(containerId);
  }

  async cleanupExpiredContainers(retentionDays = 30): Promise<number> {
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      throw new BadRequestException('Retention days must be an integer between 1 and 3650');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const batchSize = 25;
    let deletedCount = 0;
    let failedCount = 0;

    let cursorDeletedAt: Date | null = null;
    let cursorId: string | null = null;

    this.logger.log(
      `Starting expired container cleanup with retention period of ${retentionDays} days`,
    );

    try {
      while (true) {
        const queryBuilder = this.containerRepository
          .createQueryBuilder('container')
          .withDeleted()
          .select(['container.id', 'container.deletedAt'])
          .where('container.deletedAt IS NOT NULL')
          .andWhere('container.deletedAt < :cutoffDate', {
            cutoffDate,
          });

        if (cursorDeletedAt && cursorId) {
          queryBuilder.andWhere(
            new Brackets((qb) => {
              qb.where('container.deletedAt > :cursorDeletedAt', {
                cursorDeletedAt,
              }).orWhere(
                `
                  container.deletedAt = :cursorDeletedAt
                  AND container.id > :cursorId
                `,
                {
                  cursorDeletedAt,
                  cursorId,
                },
              );
            }),
          );
        }

        const expiredContainers = await queryBuilder
          .orderBy('container.deletedAt', 'ASC')
          .addOrderBy('container.id', 'ASC')
          .take(batchSize)
          .getMany();

        if (expiredContainers.length === 0) {
          break;
        }

        for (const container of expiredContainers) {
          try {
            await this.permanentDelete(container.id);
            deletedCount++;
          } catch (error: unknown) {
            failedCount++;
            this.logger.error(
              `Failed to permanently delete expired container ${container.id}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }

        const lastContainer = expiredContainers[expiredContainers.length - 1];

        if (!lastContainer || !lastContainer.deletedAt) {
          this.logger.error('Container cleanup cursor could not be advanced');
          break;
        }

        cursorDeletedAt = lastContainer.deletedAt;
        cursorId = lastContainer.id;
      }

      this.logger.log(
        `Expired container cleanup completed: ${deletedCount} deleted, ${failedCount} failed`,
      );

      return deletedCount;
    } catch (error: unknown) {
      this.logger.error(
        `Cleanup of expired containers failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async deleteFilesSafely(filePaths: string[]): Promise<void> {
    const uniquePaths = [...new Set(filePaths)];

    if (uniquePaths.length === 0) {
      return;
    }

    let deletedCount = 0;
    let failedCount = 0;

    const results = await Promise.allSettled(
      uniquePaths.map((filePath) => this.filesService.deleteFile(filePath)),
    );

    results.forEach((result, index) => {
      const filePath = uniquePaths[index];

      if (!filePath) {
        return;
      }

      if (result.status !== 'rejected') {
        deletedCount++;
        return;
      }

      if (result.reason instanceof NotFoundException) {
        this.logger.warn(`Container item file was already missing: ${filePath}`);
        // We consider this as success (file already gone)
        deletedCount++;
        return;
      }

      failedCount++;
      this.logger.error(
        `ORPHAN_FILE: Failed to delete container item file ${filePath}: ${
          result.reason instanceof Error ? result.reason.message : 'Unknown error'
        }`,
      );
    });

    this.logger.log(`File deletion summary: ${deletedCount} deleted, ${failedCount} failed`);
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
