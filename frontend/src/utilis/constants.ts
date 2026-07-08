// src/utils/constants.ts
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const CONTAINER_STATUS = {
  ACTIVE: 'active',
  SHIPPED: 'shipped',
  ARCHIVED: 'archived',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  DEFAULT_OFFSET: 0,
  MAX_LIMIT: 100,
} as const;

export const FILE = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

export const ITEM = {
  MAX_UNIQUE_NUMBER_LENGTH: 50,
  MIN_PACKAGE_QUANTITY: 1,
  MAX_PACKAGE_QUANTITY: 10000,
} as const;