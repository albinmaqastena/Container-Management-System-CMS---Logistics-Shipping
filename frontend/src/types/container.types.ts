import type { User } from './auth.types';
import type { Item } from './item.types';
import type { PaginationParams } from './api.types';

export enum ContainerStatus {
  ACTIVE = 'active',
  SHIPPED = 'shipped',
  ARCHIVED = 'archived',
}

export interface Container {
  id: string;
  name: string;
  containerCode: string;
  totalVolume: number;
  usedVolume: number;
  availableVolume: number;
  status: ContainerStatus;
  description: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ContainerWithItems
  extends Container {
  items: Item[];
}

export interface CreateContainerData {
  customName: string;
  totalVolume: number;
  description?: string;
}

export interface UpdateContainerData {
  name?: string;
  totalVolume?: number;
  description?: string;
}

export interface ContainerQueryParams
  extends PaginationParams {
  status?: ContainerStatus;
  includeDeleted?: boolean;
}