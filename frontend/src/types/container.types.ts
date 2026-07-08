// ============================================
// CONTAINER TYPES
// ============================================
import { User } from './auth.types';
import { Item } from './item.types';

export type ContainerStatus = 'active' | 'shipped' | 'archived';

export interface Container {
  id: string;
  name: string;
  containerCode: string;
  totalVolume: number;
  usedVolume: number;
  availableVolume: number;
  status: ContainerStatus;
  description?: string;
  createdBy: User;
  items: Item[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateContainerData {
  customName: string;
  totalVolume: number;
  description?: string;
}

export interface UpdateContainerData {
  name?: string;
  description?: string;
  status?: ContainerStatus;
}