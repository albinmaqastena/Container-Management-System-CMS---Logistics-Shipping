// src/common/utils/sort.utils.ts

import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'ASC' | 'DESC';

export interface SortOptions<TField extends string = string> {
  field: TField;
  order: SortDirection;
}

export const ALLOWED_SORT_FIELDS = {
  containers: [
    'id',
    'name',
    'containerCode',
    'totalVolume',
    'usedVolume',
    'status',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  items: [
    'id',
    'uniqueNumber',
    'name',
    'packageQuantity',
    'productsPerPackage',
    'packagePrice',
    'volume',
    'totalVolume',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  users: ['id', 'username', 'email', 'role', 'isActive', 'createdAt', 'updatedAt', 'deletedAt'],
  audit: ['id', 'action', 'status', 'userId', 'targetId', 'targetType', 'createdAt'],
} as const;

const resolveDefaultField = <TField extends string>(
  allowedFields: readonly TField[],
  defaultField?: TField,
): TField => {
  if (defaultField && !allowedFields.includes(defaultField)) {
    throw new BadRequestException(`Default sort field "${defaultField}" is not allowed`);
  }

  return defaultField ?? allowedFields.find((field) => field === 'createdAt') ?? allowedFields[0];
};

export const parseSort = <TField extends string>(
  sortString: string | undefined,
  allowedFields: readonly TField[],
  defaultField?: TField,
): SortOptions<TField>[] => {
  if (allowedFields.length === 0) {
    throw new BadRequestException('No sortable fields are configured');
  }

  if (!sortString?.trim()) {
    const field = resolveDefaultField(allowedFields, defaultField);
    return [{ field, order: 'DESC' }];
  }

  const seenFields = new Set<TField>();
  const sorts: SortOptions<TField>[] = [];

  for (const part of sortString.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const segments = trimmed.split(':');
    if (segments.length !== 2) {
      throw new BadRequestException(`Invalid sort expression: ${trimmed}`);
    }

    const rawField = segments[0];
    const rawOrder = segments[1];

    if (!rawField || !rawOrder) {
      throw new BadRequestException(`Invalid sort expression: ${trimmed}`);
    }

    const fieldCandidate = rawField.trim();
    const order = rawOrder.trim().toUpperCase();

    if (order !== 'ASC' && order !== 'DESC') {
      throw new BadRequestException(`Invalid sort expression: ${trimmed}`);
    }

    const field = allowedFields.find((allowedField) => allowedField === fieldCandidate);

    if (!field) {
      throw new BadRequestException(`Sorting by "${fieldCandidate}" is not allowed`);
    }

    if (seenFields.has(field)) {
      throw new BadRequestException(`Duplicate sort field: ${field}`);
    }
    seenFields.add(field);

    sorts.push({ field, order });
  }

  if (sorts.length === 0) {
    const field = resolveDefaultField(allowedFields, defaultField);
    return [{ field, order: 'DESC' }];
  }

  return sorts;
};

export const buildSortObject = <TField extends string>(
  sortString: string | undefined,
  allowedFields: readonly TField[],
  defaultField?: TField,
): Partial<Record<TField, SortDirection>> => {
  return parseSort(sortString, allowedFields, defaultField).reduce<
    Partial<Record<TField, SortDirection>>
  >((result, { field, order }) => {
    result[field] = order;
    return result;
  }, {});
};
