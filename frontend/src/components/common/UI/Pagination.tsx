import React from 'react';
import { Box, Pagination as MuiPagination, PaginationItem } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface PaginationProps {
  count: number;
  page: number;
  onChange: (page: number) => void;
  siblingCount?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  count,
  page,
  onChange,
  siblingCount = 1,
}) => {
  const handleChange = (_: React.ChangeEvent<unknown>, value: number) => {
    onChange(value);
  };

  if (count <= 1) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
      <MuiPagination
        count={count}
        page={page}
        onChange={handleChange}
        siblingCount={siblingCount}
        renderItem={(item) => (
          <PaginationItem
            slots={{
              previous: ChevronLeft,
              next: ChevronRight,
            }}
            {...item}
          />
        )}
        color="primary"
        size="large"
        showFirstButton
        showLastButton
      />
    </Box>
  );
};