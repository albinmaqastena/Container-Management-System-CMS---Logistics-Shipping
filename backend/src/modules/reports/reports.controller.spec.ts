// src/modules/reports/reports.controller.spec.ts

import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ContainerStatus } from '../containers/entities/container.entity';
import { ReportQueryDto } from './dto/report-query.dto';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: jest.Mocked<ReportsService>;

  const containerId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            generateContainerExcel: jest.fn(),
            generateAllContainersExcel: jest.fn(),
            generateContainerPdf: jest.fn(),
            generateAllContainersPdf: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);

    service = module.get<ReportsService>(ReportsService) as jest.Mocked<ReportsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportAllContainersExcel', () => {
    it('should export all containers as Excel', async () => {
      const buffer = Buffer.from('excel-report');

      const query: ReportQueryDto = {
        status: ContainerStatus.ACTIVE,
      };

      service.generateAllContainersExcel.mockResolvedValue(buffer);

      const result = await controller.exportAllContainersExcel(query);

      expect(result).toBeInstanceOf(StreamableFile);

      expect(service.generateAllContainersExcel).toHaveBeenCalledWith(query);

      expect(result.getHeaders()).toEqual({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="containers-report.xlsx"',
        length: buffer.length,
      });
    });
  });

  describe('exportAllContainersPdf', () => {
    it('should export all containers as PDF', async () => {
      const buffer = Buffer.from('pdf-report');

      const query: ReportQueryDto = {
        fromDate: new Date('2026-01-01T00:00:00.000Z'),
        toDate: new Date('2026-01-31T23:59:59.999Z'),
      };

      service.generateAllContainersPdf.mockResolvedValue(buffer);

      const result = await controller.exportAllContainersPdf(query);

      expect(result).toBeInstanceOf(StreamableFile);

      expect(service.generateAllContainersPdf).toHaveBeenCalledWith(query);

      expect(result.getHeaders()).toEqual({
        type: 'application/pdf',
        disposition: 'attachment; filename="containers-report.pdf"',
        length: buffer.length,
      });
    });
  });

  describe('exportContainerExcel', () => {
    it('should export one container as Excel', async () => {
      const buffer = Buffer.from('container-excel-report');

      service.generateContainerExcel.mockResolvedValue(buffer);

      const result = await controller.exportContainerExcel(containerId);

      expect(result).toBeInstanceOf(StreamableFile);

      expect(service.generateContainerExcel).toHaveBeenCalledWith(containerId);

      expect(result.getHeaders()).toEqual({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="container-${containerId}.xlsx"`,
        length: buffer.length,
      });
    });
  });

  describe('exportContainerPdf', () => {
    it('should export one container as PDF', async () => {
      const buffer = Buffer.from('container-pdf-report');

      service.generateContainerPdf.mockResolvedValue(buffer);

      const result = await controller.exportContainerPdf(containerId);

      expect(result).toBeInstanceOf(StreamableFile);

      expect(service.generateContainerPdf).toHaveBeenCalledWith(containerId);

      expect(result.getHeaders()).toEqual({
        type: 'application/pdf',
        disposition: `attachment; filename="container-${containerId}.pdf"`,
        length: buffer.length,
      });
    });
  });

  it('should propagate service errors', async () => {
    const error = new Error('Report generation failed');

    service.generateContainerPdf.mockRejectedValue(error);

    await expect(controller.exportContainerPdf(containerId)).rejects.toBe(error);
  });
});
