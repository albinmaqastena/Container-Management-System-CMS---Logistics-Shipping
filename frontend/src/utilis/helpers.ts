// src/utils/helpers.ts
import {
  CONTAINER_STATUS,
  ROLES,
} from './constants';

type ContainerStatus =
  (typeof CONTAINER_STATUS)[keyof typeof CONTAINER_STATUS];

type UserRole = (typeof ROLES)[keyof typeof ROLES];

type StatusValue = ContainerStatus | UserRole;

export type StatusColor =
  | 'success'
  | 'warning'
  | 'info'
  | 'default'
  | 'primary';

export const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
};

export const truncateText = (
  text: string,
  maxLength = 50,
): string => {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return '.'.repeat(maxLength);
  }

  return `${text.slice(0, maxLength - 3)}...`;
};

export const isObjectEmpty = (
  obj: Record<string, unknown>,
): boolean => Object.keys(obj).length === 0;

/**
 * Clones a value deeply using structuredClone.
 * Throws an error if the environment does not support structuredClone.
 */
export const deepClone = <T>(value: T): T => {
  if (typeof structuredClone !== 'function') {
    throw new Error(
      'structuredClone is not supported in this environment',
    );
  }

  return structuredClone(value);
};

/**
 * Generates a client-side temporary ID.
 * Prefers crypto.randomUUID() with a fallback that produces a valid UUID v4
 * using crypto.getRandomValues(). Not suitable for security-sensitive identifiers.
 */
export const generateId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Fallback që gjeneron një UUID v4 duke përdorur crypto.getRandomValues()
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Cakto versionin (4) dhe variantin (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  // Fallback i fundit (jo-kriptografik) për mjedise pa crypto
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

export const getStatusColor = (
  status: StatusValue,
): StatusColor => {
  switch (status) {
    case CONTAINER_STATUS.ACTIVE:
      return 'success';

    case CONTAINER_STATUS.SHIPPED:
      return 'info';

    case CONTAINER_STATUS.ARCHIVED:
      return 'default';

    case ROLES.SUPER_ADMIN:
      return 'primary';

    case ROLES.ADMIN:
      return 'warning';

    case ROLES.USER:
      return 'default';

    default:
      return 'default';
  }
};