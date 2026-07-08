// src/utils/helpers.ts
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const isObjectEmpty = (obj: object): boolean => {
  return Object.keys(obj).length === 0;
};

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const getStatusColor = (
  status: string
): 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'shipped':
      return 'info';
    case 'archived':
      return 'default';
    case 'super_admin':
      return 'error';
    case 'admin':
      return 'warning';
    case 'user':
      return 'primary';
    default:
      return 'default';
  }
};