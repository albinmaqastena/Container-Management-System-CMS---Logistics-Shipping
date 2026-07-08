// ============================================
// ITEM TYPES
// ============================================
import { Container } from './container.types';

export interface Item {
  id: string;
  uniqueNumber: string;
  name: string;
  photo?: string;
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
  photo?: string;
  packageQuantity: number;
  productsPerPackage: number;
  packagePrice: number;
  volume: number;
  containerId: string;
}

export interface UpdateItemData {
  uniqueNumber?: string;
  name?: string;
  photo?: string;
  packageQuantity?: number;
  productsPerPackage?: number;
  packagePrice?: number;
  volume?: number;
}