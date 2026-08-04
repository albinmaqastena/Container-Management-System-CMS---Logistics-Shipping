// src/modules/reports/reports.service.spec.ts

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { ReportsService } from './reports.service';
import { Container, ContainerStatus } from '../containers/entities/container.entity';
import { ReportQueryDto } from './dto/report-query.dto';

describe('ReportsService', () => {
  let service: ReportsService;
  let repository: jest.Mocked<Repository<Container>>;

  const containerId = '550e8400-e29b-41d4-a716-446655440000';

  const container = new Container({
    id: containerId,
    name: 'Container Alpha',
    containerCode: 'CONT-001',
    status: ContainerStatus.ACTIVE,
    description: 'Test container',
    totalVolume: 100,
    usedVolume: 10,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    items: [
      {
        id: 'item-1',
        uniqueNumber: 'ITEM-001',
        name: 'Test item',
        packageQuantity: 2,
        productsPerPackage: 5,
        packagePrice: 20,
        volume: 5,
        totalVolume: 10,
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
      },
    ] as Container['items'],
  });

  const createQueryBuilder = (
    result: Container | Container[] | null,
  ): jest.Mocked<SelectQueryBuilder<Container>> => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      getOne: jest.fn(),
      getMany: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<Container>>;

    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.addOrderBy.mockReturnValue(queryBuilder);

    queryBuilder.getOne.mockResolvedValue(Array.isArray(result) ? (result[0] ?? null) : result);

    queryBuilder.getMany.mockResolvedValue(Array.isArray(result) ? result : result ? [result] : []);

    return queryBuilder;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Container),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    repository = module.get(getRepositoryToken(Container));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateContainerExcel', () => {
    it('should generate an Excel buffer for one container', async () => {
      const queryBuilder = createQueryBuilder(container);

      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.generateContainerExcel(containerId);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('container');

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'container.items',
        'item',
        'item.deletedAt IS NULL',
      );

      expect(queryBuilder.where).toHaveBeenCalledWith('container.id = :containerId', {
        containerId,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('container.deletedAt IS NULL');

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('item.createdAt', 'ASC');
    });

    it('should throw when the container does not exist', async () => {
      repository.createQueryBuilder.mockReturnValue(createQueryBuilder(null));

      await expect(service.generateContainerExcel(containerId)).rejects.toThrow(
        new NotFoundException('Container not found'),
      );
    });
  });

  describe('generateAllContainersExcel', () => {
    it('should generate an Excel buffer with filters', async () => {
      const queryBuilder = createQueryBuilder([container]);

      repository.createQueryBuilder.mockReturnValue(queryBuilder);

      const query: ReportQueryDto = {
        status: ContainerStatus.ACTIVE,
        fromDate: new Date('2026-01-01T00:00:00.000Z'),
        toDate: new Date('2026-01-31T23:59:59.999Z'),
      };

      const result = await service.generateAllContainersExcel(query);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('container.status = :status', {
        status: ContainerStatus.ACTIVE,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('container.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('container.createdAt <= :toDate', {
        toDate: query.toDate,
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('container.createdAt', 'DESC');

      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('item.createdAt', 'ASC');
    });

    it('should generate an Excel buffer when no containers exist', async () => {
      repository.createQueryBuilder.mockReturnValue(createQueryBuilder([]));

      const result = await service.generateAllContainersExcel({});

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateContainerPdf', () => {
    it('should generate a PDF buffer for one container', async () => {
      repository.createQueryBuilder.mockReturnValue(createQueryBuilder(container));

      const result = await service.generateContainerPdf(containerId);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateAllContainersPdf', () => {
    it('should generate a PDF buffer for all containers', async () => {
      repository.createQueryBuilder.mockReturnValue(createQueryBuilder([container]));

      const result = await service.generateAllContainersPdf({});

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.subarray(0, 4).toString()).toBe('%PDF');
    });

    it.each(['generateAllContainersExcel', 'generateAllContainersPdf'] as const)(
      'should reject an invalid date range in %s',
      async (methodName) => {
        const query: ReportQueryDto = {
          fromDate: new Date('2026-02-01T00:00:00.000Z'),
          toDate: new Date('2026-01-01T00:00:00.000Z'),
        };

        await expect(service[methodName](query)).rejects.toThrow(
          new BadRequestException('fromDate must be before or equal to toDate'),
        );

        expect(repository.createQueryBuilder).not.toHaveBeenCalled();
      },
    );
  });
});
