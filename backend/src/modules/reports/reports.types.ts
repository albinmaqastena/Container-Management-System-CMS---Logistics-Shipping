// src/modules/reports/reports.types.ts

import { ContainerStatus } from '../containers/entities/container.entity';

export interface ReportItem {
  id: string;
  uniqueNumber: string;
  name: string;
  packageQuantity: number;
  productsPerPackage: number;
  packagePrice: number;
  volume: number;
  totalVolume: number;
  totalProducts: number;
  totalValue: number;
}

export interface ContainerReport {
  id: string;
  name: string;
  containerCode: string;
  status: ContainerStatus;
  description: string;
  totalVolume: number;
  usedVolume: number;
  availableVolume: number;
  usagePercentage: number;
  totalItems: number;
  totalPackages: number;
  totalProducts: number;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
  items: ReportItem[];
}

export interface ReportsSummary {
  totalContainers: number;
  totalItems: number;
  totalPackages: number;
  totalProducts: number;
  totalCapacity: number;
  totalUsedVolume: number;
  totalAvailableVolume: number;
  totalValue: number;
}
