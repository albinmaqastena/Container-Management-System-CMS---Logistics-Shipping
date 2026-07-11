// src/common/utils/sort.utils.ts

import {
  BadRequestException,
} from '@nestjs/common';

export type SortDirection =
  | 'ASC'
  | 'DESC';

export interface SortOptions {
  field: string;
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
  users: [
    'id',
    'username',
    'email',
    'role',
    'isActive',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  audit: [
    'id',
    'action',
    'status',
    'userId',
    'targetId',
    'targetType',
    'createdAt',
  ],
} as const;

export const parseSort = (
  sortString?: string,
  allowedFields: readonly string[] = [],
): SortOptions[] => {
  if (!sortString?.trim()) {
    return [
      {
        field: 'createdAt',
        order: 'DESC',
      },
    ];
  }

  const sorts =
    sortString
      .split(',')
      .map((part) =>
        part.trim(),
      )
      .filter(Boolean)
      .map((part) => {
        const [
          rawField,
          rawOrder,
        ] = part.split(':');

        const field =
          rawField?.trim();
        const order =
          rawOrder
            ?.trim()
            .toUpperCase();

        if (
          !field ||
          !['ASC', 'DESC'].includes(
            order,
          )
        ) {
          throw new BadRequestException(
            `Invalid sort expression: ${part}`,
          );
        }

        if (
          allowedFields.length > 0 &&
          !allowedFields.includes(
            field,
          )
        ) {
          throw new BadRequestException(
            `Sorting by "${field}" is not allowed`,
          );
        }

        return {
          field,
          order:
            order as SortDirection,
        };
      });

  return sorts.length
    ? sorts
    : [
        {
          field: 'createdAt',
          order: 'DESC',
        },
      ];
};

export const buildSortObject = (
  sortString?: string,
  allowedFields: readonly string[] = [],
): Record<
  string,
  SortDirection
> => {
  return Object.fromEntries(
    parseSort(
      sortString,
      allowedFields,
    ).map(
      ({ field, order }) => [
        field,
        order,
      ],
    ),
  );
};