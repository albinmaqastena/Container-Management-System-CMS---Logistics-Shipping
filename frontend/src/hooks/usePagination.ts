// src/hooks/usePagination.ts

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

const DEFAULT_LIMIT = 10;

interface UsePaginationProps {
  initialLimit?: number;
  initialOffset?: number;
  total?: number;
}

interface UsePaginationResult {
  limit: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
  nextPage: () => void;
  previousPage: () => void;
  handlePageChange: (page: number) => void;
  handleLimitChange: (newLimit: number) => void;
  resetPagination: () => void;
}

const normalizePositiveInteger = (
  value: number,
  fallback: number,
): number =>
  Number.isInteger(value) && value > 0
    ? value
    : fallback;

const normalizeOffset = (value: number): number =>
  Number.isInteger(value) && value >= 0
    ? value
    : 0;

export function usePagination({
  initialLimit = DEFAULT_LIMIT,
  initialOffset = 0,
  total = 0,
}: UsePaginationProps = {}): UsePaginationResult {
  const normalizedTotal =
    Number.isFinite(total) && total > 0
      ? Math.floor(total)
      : 0;

  const [limit, setLimit] = useState(() =>
    normalizePositiveInteger(initialLimit, DEFAULT_LIMIT),
  );

  const [offset, setOffset] = useState(() =>
    normalizeOffset(initialOffset),
  );

  const totalPages = useMemo(() => {
    if (normalizedTotal === 0) {
      return 0;
    }

    return Math.ceil(normalizedTotal / limit);
  }, [normalizedTotal, limit]);

  const currentPage = useMemo(
    () =>
      totalPages === 0
        ? 1
        : Math.min(
            Math.floor(offset / limit) + 1,
            totalPages,
          ),
    [offset, limit, totalPages],
  );

  // Korrigjim i offset-it duke përdorur functional update
  useEffect(() => {
    const maximumOffset =
      totalPages === 0
        ? 0
        : (totalPages - 1) * limit;

    setOffset((currentOffset) =>
      currentOffset > maximumOffset
        ? maximumOffset
        : currentOffset,
    );
  }, [limit, totalPages]);

  const handlePageChange = useCallback(
    (page: number) => {
      const normalizedPage = normalizePositiveInteger(page, 1);
      const targetPage =
        totalPages > 0
          ? Math.min(normalizedPage, totalPages)
          : 1;

      setOffset((targetPage - 1) * limit);
    },
    [limit, totalPages],
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      setLimit(normalizePositiveInteger(newLimit, DEFAULT_LIMIT));
      setOffset(0);
    },
    [],
  );

  const resetPagination = useCallback(() => {
    setOffset(0);
  }, []);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setOffset(currentPage * limit);
    }
  }, [currentPage, totalPages, limit]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setOffset((currentPage - 2) * limit);
    }
  }, [currentPage, limit]);

  return {
    limit,
    offset,
    currentPage,
    totalPages,
    hasMore: totalPages > 0 && currentPage < totalPages,
    hasPrevious: totalPages > 0 && currentPage > 1,
    nextPage,
    previousPage,
    handlePageChange,
    handleLimitChange,
    resetPagination,
  };
}