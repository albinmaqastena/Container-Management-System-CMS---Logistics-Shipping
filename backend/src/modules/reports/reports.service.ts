// src/modules/reports/reports.service.ts

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { ReportQueryDto } from './dto/report-query.dto';
import { ContainerReport, ReportItem, ReportsSummary } from './reports.types';
import { Container } from '../containers/entities/container.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Container)
    private readonly containerRepository: Repository<Container>,
  ) {}

  async generateContainerExcel(containerId: string): Promise<Buffer> {
    const report = await this.getContainerReport(containerId);
    const workbook = this.createWorkbook();

    this.addContainerWorksheet(workbook, report);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    this.logger.log(`Generated Excel report for container ${containerId}`);

    return buffer;
  }

  async generateAllContainersExcel(query: ReportQueryDto): Promise<Buffer> {
    this.validateDateRange(query);

    const reports = await this.getContainerReports(query);
    const workbook = this.createWorkbook();

    this.addSummaryWorksheet(workbook, reports);

    reports.forEach((report) => {
      this.addContainerWorksheet(workbook, report);
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    this.logger.log(`Generated Excel report for ${reports.length} containers`);

    return buffer;
  }

  async generateContainerPdf(containerId: string): Promise<Buffer> {
    const report = await this.getContainerReport(containerId);

    const buffer = await this.createPdf((document) => {
      this.addPdfTitle(document, `Container Report - ${report.containerCode}`);
      this.addContainerPdfSection(document, report);
    });

    this.logger.log(`Generated PDF report for container ${containerId}`);

    return buffer;
  }

  async generateAllContainersPdf(query: ReportQueryDto): Promise<Buffer> {
    this.validateDateRange(query);

    const reports = await this.getContainerReports(query);
    const summary = this.calculateSummary(reports);

    const buffer = await this.createPdf((document) => {
      this.addPdfTitle(document, 'Containers Report');
      this.addSummaryPdf(document, summary);

      reports.forEach((report, index) => {
        if (index > 0 || document.y > 390) {
          document.addPage();
        } else {
          document.moveDown();
        }

        this.addContainerPdfSection(document, report);
      });
    });

    this.logger.log(`Generated PDF report for ${reports.length} containers`);

    return buffer;
  }

  private createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Container Management System';
    workbook.created = new Date();

    return workbook;
  }

  private async getContainerReport(containerId: string): Promise<ContainerReport> {
    const container = await this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.items', 'item', 'item.deletedAt IS NULL')
      .where('container.id = :containerId', { containerId })
      .andWhere('container.deletedAt IS NULL')
      .orderBy('item.createdAt', 'ASC')
      .getOne();

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    return this.mapContainerReport(container);
  }

  private async getContainerReports(query: ReportQueryDto): Promise<ContainerReport[]> {
    const queryBuilder = this.containerRepository
      .createQueryBuilder('container')
      .leftJoinAndSelect('container.items', 'item', 'item.deletedAt IS NULL')
      .where('container.deletedAt IS NULL');

    this.applyFilters(queryBuilder, query);

    const containers = await queryBuilder
      .orderBy('container.createdAt', 'DESC')
      .addOrderBy('item.createdAt', 'ASC')
      .getMany();

    return containers.map((container) => this.mapContainerReport(container));
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Container>, query: ReportQueryDto): void {
    if (query.status) {
      queryBuilder.andWhere('container.status = :status', {
        status: query.status,
      });
    }

    if (query.fromDate) {
      queryBuilder.andWhere('container.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }

    if (query.toDate) {
      queryBuilder.andWhere('container.createdAt <= :toDate', {
        toDate: query.toDate,
      });
    }
  }

  private validateDateRange(query: ReportQueryDto): void {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }
  }

  private mapContainerReport(container: Container): ContainerReport {
    const items: ReportItem[] = (container.items ?? []).map((item) => {
      const packageQuantity = this.toFiniteNumber(item.packageQuantity);
      const productsPerPackage = this.toFiniteNumber(item.productsPerPackage);
      const packagePrice = this.toFiniteNumber(item.packagePrice);
      const volume = this.toFiniteNumber(item.volume);
      const totalVolume = this.toFiniteNumber(item.totalVolume);

      return {
        id: item.id,
        uniqueNumber: item.uniqueNumber,
        name: item.name,
        packageQuantity,
        productsPerPackage,
        packagePrice,
        volume,
        totalVolume,
        totalProducts: packageQuantity * productsPerPackage,
        totalValue: this.roundToTwoDecimals(packageQuantity * packagePrice),
      };
    });

    const totalPackages = items.reduce((sum, item) => sum + item.packageQuantity, 0);
    const totalProducts = items.reduce((sum, item) => sum + item.totalProducts, 0);
    const totalValue = this.roundToTwoDecimals(
      items.reduce((sum, item) => sum + item.totalValue, 0),
    );

    const totalVolume = this.toFiniteNumber(container.totalVolume);
    const usedVolume = this.toFiniteNumber(container.usedVolume);
    const availableVolume = this.toFiniteNumber(container.availableVolume);
    const usagePercentage = totalVolume > 0 ? Math.min(100, (usedVolume / totalVolume) * 100) : 0;

    return {
      id: container.id,
      name: container.name,
      containerCode: container.containerCode,
      status: container.status,
      description: container.description ?? '',
      totalVolume,
      usedVolume,
      availableVolume,
      usagePercentage,
      totalItems: items.length,
      totalPackages,
      totalProducts,
      totalValue,
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
      items,
    };
  }

  private calculateSummary(reports: ContainerReport[]): ReportsSummary {
    const summary = reports.reduce<ReportsSummary>(
      (summary, report) => ({
        totalContainers: summary.totalContainers + 1,
        totalItems: summary.totalItems + report.totalItems,
        totalPackages: summary.totalPackages + report.totalPackages,
        totalProducts: summary.totalProducts + report.totalProducts,
        totalCapacity: summary.totalCapacity + report.totalVolume,
        totalUsedVolume: summary.totalUsedVolume + report.usedVolume,
        totalAvailableVolume: summary.totalAvailableVolume + report.availableVolume,
        totalValue: summary.totalValue + report.totalValue,
      }),
      {
        totalContainers: 0,
        totalItems: 0,
        totalPackages: 0,
        totalProducts: 0,
        totalCapacity: 0,
        totalUsedVolume: 0,
        totalAvailableVolume: 0,
        totalValue: 0,
      },
    );

    return {
      ...summary,
      totalValue: this.roundToTwoDecimals(summary.totalValue),
    };
  }

  private addSummaryWorksheet(workbook: ExcelJS.Workbook, reports: ContainerReport[]): void {
    const summary = this.calculateSummary(reports);
    const worksheet = workbook.addWorksheet('Summary');

    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 24 },
    ];

    worksheet.addRows([
      { metric: 'Generated at', value: new Date() },
      { metric: 'Total containers', value: summary.totalContainers },
      { metric: 'Total item lines', value: summary.totalItems },
      { metric: 'Total packages', value: summary.totalPackages },
      { metric: 'Total products', value: summary.totalProducts },
      { metric: 'Total capacity', value: summary.totalCapacity },
      { metric: 'Used volume', value: summary.totalUsedVolume },
      {
        metric: 'Available volume',
        value: summary.totalAvailableVolume,
      },
      { metric: 'Total value', value: summary.totalValue },
    ]);

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: 'center' };
    worksheet.getColumn('value').numFmt = '#,##0.00';
    worksheet.getCell('B2').numFmt = 'yyyy-mm-dd hh:mm';
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private addContainerWorksheet(workbook: ExcelJS.Workbook, report: ContainerReport): void {
    const worksheet = workbook.addWorksheet(
      this.createUniqueSheetName(workbook, report.containerCode),
    );

    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = `Container Report - ${report.containerCode}`;
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    const details: Array<[string, string | number | Date]> = [
      ['Name', report.name],
      ['Code', report.containerCode],
      ['Status', report.status],
      ['Description', report.description || '-'],
      ['Total volume', report.totalVolume],
      ['Used volume', report.usedVolume],
      ['Available volume', report.availableVolume],
      ['Usage percentage', report.usagePercentage / 100],
      ['Item lines', report.totalItems],
      ['Total packages', report.totalPackages],
      ['Total products', report.totalProducts],
      ['Total value', report.totalValue],
      ['Created at', report.createdAt],
      ['Updated at', report.updatedAt],
    ];

    details.forEach(([label, value], index) => {
      const row = index + 3;
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`A${row}`).font = { bold: true };
      worksheet.getCell(`B${row}`).value = value;
    });

    worksheet.getCell('B10').numFmt = '0.00%';
    worksheet.getCell('B14').numFmt = '#,##0.00';
    worksheet.getCell('B15').numFmt = 'yyyy-mm-dd hh:mm';
    worksheet.getCell('B16').numFmt = 'yyyy-mm-dd hh:mm';

    const headerRow = 18;
    const headers = [
      'Unique number',
      'Item name',
      'Packages',
      'Products/package',
      'Total products',
      'Price/package',
      'Total value',
      'Volume/package',
      'Total volume',
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    report.items.forEach((item, index) => {
      const row = worksheet.getRow(headerRow + index + 1);

      row.values = [
        item.uniqueNumber,
        item.name,
        item.packageQuantity,
        item.productsPerPackage,
        item.totalProducts,
        item.packagePrice,
        item.totalValue,
        item.volume,
        item.totalVolume,
      ];

      [6, 7, 8, 9].forEach((column) => {
        row.getCell(column).numFmt = '#,##0.00';
      });
    });

    worksheet.columns = [
      { width: 20 },
      { width: 32 },
      { width: 13 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 17 },
      { width: 16 },
    ];
    worksheet.views = [{ state: 'frozen', ySplit: headerRow }];
    worksheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: headers.length },
    };
  }

  private createPdf(render: (document: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.once('end', () => resolve(Buffer.concat(chunks)));
      document.once('error', reject);

      try {
        render(document);
        this.addPdfPageNumbers(document);
        document.end();
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error('Unable to generate PDF report'));
      }
    });
  }

  private addPdfTitle(document: PDFKit.PDFDocument, title: string): void {
    document
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(title, { align: 'center' })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#555555')
      .text(`Generated at: ${this.formatDate(new Date())}`, {
        align: 'center',
      })
      .fillColor('#000000')
      .moveDown();
  }

  private addSummaryPdf(document: PDFKit.PDFDocument, summary: ReportsSummary): void {
    document.font('Helvetica-Bold').fontSize(13).text('Summary').moveDown(0.4);

    const rows: Array<[string, string]> = [
      ['Total containers', String(summary.totalContainers)],
      ['Total item lines', String(summary.totalItems)],
      ['Total packages', String(summary.totalPackages)],
      ['Total products', String(summary.totalProducts)],
      ['Total capacity', this.formatNumber(summary.totalCapacity)],
      ['Used volume', this.formatNumber(summary.totalUsedVolume)],
      ['Available volume', this.formatNumber(summary.totalAvailableVolume)],
      ['Total value', this.formatNumber(summary.totalValue)],
    ];

    rows.forEach(([label, value]) => {
      document
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value);
    });
  }

  private addContainerPdfSection(document: PDFKit.PDFDocument, report: ContainerReport): void {
    document
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`${report.name} (${report.containerCode})`)
      .moveDown(0.3);

    const details: Array<[string, string]> = [
      ['Status', report.status],
      ['Description', report.description || '-'],
      ['Total volume', this.formatNumber(report.totalVolume)],
      ['Used volume', this.formatNumber(report.usedVolume)],
      ['Available volume', this.formatNumber(report.availableVolume)],
      ['Usage', `${this.formatNumber(report.usagePercentage)}%`],
      ['Item lines', String(report.totalItems)],
      ['Packages', String(report.totalPackages)],
      ['Products', String(report.totalProducts)],
      ['Total value', this.formatNumber(report.totalValue)],
      ['Created at', this.formatDate(report.createdAt)],
    ];

    details.forEach(([label, value]) => {
      document
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value);
    });

    document.moveDown(0.6);

    if (report.items.length === 0) {
      document.font('Helvetica-Oblique').text('No items in this container.');
      return;
    }

    report.items.forEach((item) => {
      this.ensurePdfSpace(document, 38);

      document
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${item.uniqueNumber} - ${item.name}`)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Packages: ${item.packageQuantity} | ` +
            `Products: ${item.totalProducts} | ` +
            `Value: ${this.formatNumber(item.totalValue)} | ` +
            `Volume: ${this.formatNumber(item.totalVolume)}`,
        )
        .moveDown(0.35);
    });
  }

  private ensurePdfSpace(document: PDFKit.PDFDocument, requiredHeight: number): void {
    const bottom = document.page.height - document.page.margins.bottom - 20;

    if (document.y + requiredHeight > bottom) {
      document.addPage();
    }
  }

  private addPdfPageNumbers(document: PDFKit.PDFDocument): void {
    const range = document.bufferedPageRange();

    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      document.switchToPage(pageIndex);
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#666666')
        .text(
          `Page ${pageIndex - range.start + 1} of ${range.count}`,
          40,
          document.page.height - 30,
          {
            width: document.page.width - 80,
            align: 'center',
            lineBreak: false,
          },
        );
    }

    document.fillColor('#000000');
  }

  private createUniqueSheetName(workbook: ExcelJS.Workbook, requestedName: string): string {
    const baseName = requestedName.replace(/[\\/*?:[\]]/g, '-').slice(0, 31) || 'Container';

    let name = baseName;
    let counter = 1;

    while (workbook.getWorksheet(name)) {
      const suffix = `-${counter}`;
      name = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
      counter += 1;
    }

    return name;
  }

  private toFiniteNumber(value: unknown): number {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
