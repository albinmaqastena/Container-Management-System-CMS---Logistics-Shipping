// src/modules/containers/containers.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, IsNull } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { v4 as uuidv4 } from "uuid";
import { Container, ContainerStatus } from "./entities/container.entity";
import { CreateContainerDto } from "./dto/create-container.dto";
import { UpdateContainerDto } from "./dto/update-container.dto";
import { User } from "../auth/entities/user.entity";
import {
  PaginationDto,
  PaginatedResponseDto,
} from "../../common/dto/pagination.dto";
import {
  buildSortObject,
  ALLOWED_SORT_FIELDS,
} from "../../common/utils/sort.utils";
import { Item } from "../items/entities/item.entity";

@Injectable()
export class ContainersService {
  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  private async clearContainerCache(id?: string): Promise<void> {
    const keys = [
      "containers:all",
      "containers:active",
      "containers:archived",
      "containers:deleted",
    ];

    if (id) {
      keys.push(`container:${id}:false`, `container:${id}:true`);
    }

    await Promise.all(keys.map((k) => this.cacheManager.del(k)));
  }

  private async ensureUniqueName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.containerRepository
      .createQueryBuilder("container")
      .withDeleted()
      .where("LOWER(container.name) = LOWER(:name)", { name });

    if (excludeId) {
      queryBuilder.andWhere("container.id != :excludeId", { excludeId });
    }

    const existing = await queryBuilder.getOne();
    if (existing) {
      throw new BadRequestException("Container with this name already exists");
    }
  }

  async findOneWithoutCache(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        createdBy: true,
        items: true,
      },
    });

    if (!container) {
      throw new NotFoundException("Container not found");
    }

    return container;
  }

  async findOneIncludingDeleted(id: string): Promise<Container> {
    const container = await this.containerRepository.findOne({
      where: { id },
      relations: {
        createdBy: true,
        items: true,
      },
      withDeleted: true,
    });

    if (!container) {
      throw new NotFoundException("Container not found");
    }

    return container;
  }

  async create(
    createContainerDto: CreateContainerDto,
    user: User,
  ): Promise<Container> {
    if (createContainerDto.totalVolume <= 0) {
      throw new BadRequestException("Total volume must be greater than 0");
    }

    const name = createContainerDto.customName.trim();
    if (!name) {
      throw new BadRequestException("Container name is required");
    }

    await this.ensureUniqueName(name);

    const containerCode = `CNT-${uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

    const container = new Container({
      name,
      containerCode,
      totalVolume: createContainerDto.totalVolume,
      description: createContainerDto.description?.trim() || "",
      createdBy: user,
      status: ContainerStatus.ACTIVE,
      usedVolume: 0,
    });

    try {
      const saved = await this.containerRepository.save(container);
      await this.clearContainerCache(saved.id);
      return saved;
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new BadRequestException(
          "Container with this name already exists",
        );
      }
      throw error;
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
      .createQueryBuilder("container")
      .leftJoinAndSelect("container.createdBy", "createdBy")
      .leftJoinAndSelect("container.items", "items", "items.deletedAt IS NULL");

    if (includeDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.where("container.deletedAt IS NULL");
    }

    if (status) {
      queryBuilder.andWhere("container.status = :status", { status });
    }

    const sortObject = buildSortObject(
      sort,
      ALLOWED_SORT_FIELDS.containers,
    );

    Object.entries(sortObject).forEach(
      ([key, direction]) => {
        if (key === 'deletedAt') {
          queryBuilder.addOrderBy(
            `container.${key}`,
            direction,
            direction === 'DESC'
              ? 'NULLS LAST'
              : 'NULLS FIRST',
          );
          return;
        }

        queryBuilder.addOrderBy(
          `container.${key}`,
          direction,
        );
      },
    );

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
      .createQueryBuilder("container")
      .leftJoinAndSelect("container.createdBy", "createdBy")
      .leftJoinAndSelect("container.items", "items", "items.deletedAt IS NULL")
      .where("container.deletedAt IS NULL")
      .andWhere(
        "(container.name ILIKE :query OR container.containerCode ILIKE :query OR container.description ILIKE :query)",
        { query: `%${query.trim()}%` },
      );

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    Object.entries(sortObject).forEach(([field, direction]) => {
      queryBuilder.addOrderBy(`container.${field}`, direction);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async findOne(
    id: string,
    includeDeleted: boolean = false,
  ): Promise<Container> {
    const cacheKey = `container:${id}:${includeDeleted}`;
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
      throw new NotFoundException("Container not found");
    }

    await this.cacheManager.set(cacheKey, container, 300);
    return container;
  }

  async update(
    id: string,
    updateContainerDto: UpdateContainerDto,
  ): Promise<Container> {
    const container = await this.findOne(id);

    if (updateContainerDto.name !== undefined) {
      const newName = updateContainerDto.name.trim();
      if (!newName) {
        throw new BadRequestException("Container name cannot be empty");
      }

      if (newName !== container.name) {
        await this.ensureUniqueName(newName, id);
        container.name = newName;
      }
    }

    if (updateContainerDto.description !== undefined) {
      container.description = updateContainerDto.description?.trim() ?? "";
    }

    if (updateContainerDto.status !== undefined) {
      container.status = updateContainerDto.status;
    }

    try {
      const updated = await this.containerRepository.save(container);
      await this.clearContainerCache(id);
      return updated;
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new BadRequestException(
          "Container with this name already exists",
        );
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: ContainerStatus): Promise<Container> {
    const container = await this.findOneWithoutCache(id);
    container.status = status;

    const updated = await this.containerRepository.save(container);
    await this.clearContainerCache(id);
    return updated;
  }

  // ✅ SOFT DELETE - me transaction dhe pessimistic lock
  async softDelete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const container = await manager
        .getRepository(Container)
        .createQueryBuilder("container")
        .setLock("pessimistic_write")
        .where("container.id = :id", { id })
        .getOne();

      if (!container) {
        throw new NotFoundException("Container not found");
      }

      await manager.getRepository(Item).softDelete({ containerId: id });
      await manager.getRepository(Container).softDelete(id);
    });

    await this.clearContainerCache(id);
  }

  // ✅ RESTORE - me transaction dhe kontroll të items
  async restore(id: string): Promise<Container> {
    await this.dataSource.transaction(async (manager) => {
      const container = await manager.getRepository(Container).findOne({
        where: { id },
        relations: { items: true },
        withDeleted: true,
      });

      if (!container) {
        throw new NotFoundException("Container not found");
      }

      if (!container.deletedAt) {
        throw new BadRequestException("Container is not deleted");
      }

      // ✅ Kontrollo nëse ka item-e të krijuara pas fshirjes
      const activeItems = container.items?.filter((i) => !i.deletedAt) || [];
      if (activeItems.length > 0) {
        throw new BadRequestException(
          "Container has active items. Cannot restore.",
        );
      }

      await manager.getRepository(Container).restore(id);
      await manager.getRepository(Item).restore({ containerId: id });

      // Përditëso volumin
      const result = await manager
        .getRepository(Item)
        .createQueryBuilder("item")
        .select("COALESCE(SUM(item.totalVolume), 0)", "sum")
        .where("item.containerId = :containerId", { containerId: id })
        .andWhere("item.deletedAt IS NULL")
        .getRawOne();

      const usedVolume = Number(result?.sum) || 0;
      await manager.getRepository(Container).update(id, { usedVolume });
    });

    await this.clearContainerCache(id);
    return this.findOne(id);
  }

  // ✅ PERMANENT DELETE - me transaction
  async permanentDelete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const container = await manager.getRepository(Container).findOne({
        where: { id },
        withDeleted: true,
      });

      if (!container) {
        throw new NotFoundException("Container not found");
      }

      await manager
        .getRepository(Item)
        .createQueryBuilder()
        .delete()
        .from(Item)
        .where("containerId = :id", { id })
        .execute();

      await manager
        .getRepository(Container)
        .createQueryBuilder()
        .delete()
        .from(Container)
        .where("id = :id", { id })
        .execute();
    });

    await this.clearContainerCache(id);
  }

  async findDeleted(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Container>> {
    const limit = paginationDto.limit ?? 10;
    const offset = paginationDto.offset ?? 0;
    const sort = paginationDto.sort;

    const queryBuilder = this.containerRepository
      .createQueryBuilder("container")
      .withDeleted()
      .leftJoinAndSelect("container.createdBy", "createdBy")
      .leftJoinAndSelect(
        "container.items",
        "items",
        "items.deletedAt IS NOT NULL",
      )
      .where("container.deletedAt IS NOT NULL");

    const sortObject = buildSortObject(sort, ALLOWED_SORT_FIELDS.containers);
    Object.entries(sortObject).forEach(([field, direction]) => {
      queryBuilder.addOrderBy(`container.${field}`, direction);
    });

    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResponseDto(data, total, limit, offset);
  }

  async updateUsedVolume(containerId: string): Promise<void> {
    const result = await this.itemRepository
      .createQueryBuilder("item")
      .select("COALESCE(SUM(item.totalVolume), 0)", "sum")
      .where("item.containerId = :containerId", { containerId })
      .andWhere("item.deletedAt IS NULL")
      .getRawOne();

    const usedVolume = Number(result?.sum) || 0;
    const container = await this.findOneWithoutCache(containerId);

    if (usedVolume > container.totalVolume) {
      throw new BadRequestException(
        `Used volume (${usedVolume}) exceeds total volume (${container.totalVolume})`,
      );
    }

    await this.containerRepository.update(containerId, { usedVolume });
    await this.clearContainerCache(containerId);
  }
}