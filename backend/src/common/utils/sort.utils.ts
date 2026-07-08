// src/common/utils/sort.utils.ts
export interface SortOptions {
  field: string;
  order: 'ASC' | 'DESC';
}

export const ALLOWED_SORT_FIELDS = {
  containers: ['id', 'name', 'containerCode', 'totalVolume', 'usedVolume', 'status', 'createdAt', 'updatedAt'],
  items: ['id', 'uniqueNumber', 'name', 'packageQuantity', 'productsPerPackage', 'packagePrice', 'volume', 'totalVolume', 'createdAt', 'updatedAt'],
  users: ['id', 'username', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
  audit: ['id', 'action', 'status', 'userId', 'targetId', 'targetType', 'createdAt'],
};

export const parseSort = (sortString?: string, allowedFields: string[] = []): SortOptions[] => {
  if (!sortString) {
    return [{ field: 'createdAt', order: 'DESC' }];
  }

  const parts = sortString.split(',').map((s) => {
    const [field, order] = s.split(':');
    const normalizedOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field: field.trim(), order: normalizedOrder as 'ASC' | 'DESC' };
  });

  // Filter only allowed fields to prevent SQL injection
  const validSorts: SortOptions[] = allowedFields.length > 0
    ? parts.filter((s) => allowedFields.includes(s.field))
    : parts;

  return validSorts.length > 0 ? validSorts : [{ field: 'createdAt', order: 'DESC' }];
};

export const buildSortObject = (sortString?: string, allowedFields: string[] = []): Record<string, 'ASC' | 'DESC'> => {
  const sorts = parseSort(sortString, allowedFields);
  const sortObject: Record<string, 'ASC' | 'DESC'> = {};
  sorts.forEach((s) => {
    sortObject[s.field] = s.order;
  });
  return sortObject;
};