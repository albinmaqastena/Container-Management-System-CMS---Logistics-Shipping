import type { PaginationParams } from './api.types';
import type { Container } from './container.types';

export interface Item {
  id: string;
  uniqueNumber: string;
  name: string;
  photo?: string | null;
  photoUrl?: string | null;
  packageQuantity: number;
  productsPerPackage: number;
  packagePrice: number;
  volume: number;
  totalVolume: number;
  container: Container;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateItemData {
  uniqueNumber: string;
  name: string;
  photo?: string | null;
  packageQuantity: number;
  productsPerPackage: number;
  packagePrice: number;
  volume: number;
  containerId: string;
}

export interface UpdateItemData {
  uniqueNumber?: string;
  name?: string;
  photo?: string | null;
  packageQuantity?: number;
  productsPerPackage?: number;
  packagePrice?: number;
  volume?: number;
}

export interface ItemQueryParams extends PaginationParams {
  containerId?: string;
  includeDeleted?: boolean;
}

export interface ItemSearchParams extends PaginationParams {
  containerId?: string;
}