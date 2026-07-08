// src/hooks/usePagination.ts
import { useState, useCallback } from 'react';

interface UsePaginationProps {
  initialLimit?: number;
  initialOffset?: number;
  total?: number;
}

export function usePagination({ initialLimit = 10, initialOffset = 0, total = 0 }: UsePaginationProps = {}) {
  const [limit, setLimit] = useState(initialLimit);
  const [offset, setOffset] = useState(initialOffset);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(total / limit);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setOffset((page - 1) * limit);
  }, [limit]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setOffset(0);
    setCurrentPage(1);
  }, []);

  const resetPagination = useCallback(() => {
    setOffset(0);
    setCurrentPage(1);
  }, []);

  return {
    limit,
    offset,
    currentPage,
    totalPages,
    hasMore: currentPage < totalPages,
    handlePageChange,
    handleLimitChange,
    resetPagination,
  };
}