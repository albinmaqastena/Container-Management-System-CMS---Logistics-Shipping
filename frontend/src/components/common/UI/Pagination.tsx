// src/components/common/UI/Pagination.tsx

import type { ChangeEvent } from 'react';

import {
  Box,
  Pagination as MuiPagination,
  PaginationItem,
} from '@mui/material';

import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';

interface PaginationProps {
  count: number;
  page: number;
  onChange: (page: number) => void;
  siblingCount?: number;
}

export const Pagination = ({
  count,
  page,
  onChange,
  siblingCount = 1,
}: PaginationProps) => {
  // Normalizimi i count-it për të shmangur vlera jo valide
  const normalizedCount = Math.max(
    0,
    Math.floor(count),
  );

  if (normalizedCount <= 1) {
    return null;
  }

  const normalizedPage = Math.min(
    Math.max(1, Math.floor(page)),
    normalizedCount,
  );

  const normalizedSiblingCount = Math.max(
    0,
    Math.floor(siblingCount),
  );

  const handleChange = (
    _: ChangeEvent<unknown>,
    value: number,
  ): void => {
    onChange(value);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',

        mt: {
          xs: 2.5,
          sm: 3,
        },

        px: {
          xs: 0.5,
          sm: 1,
        },

        pb: 0.5,

        overflowX: 'auto',
        overflowY: 'hidden',

        WebkitOverflowScrolling: 'touch',

        '&::-webkit-scrollbar': {
          height: 4,
        },

        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },

        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.12)',
          borderRadius: 999,
        },
      }}
    >
      <MuiPagination
        aria-label="Pagination navigation"
        count={normalizedCount}
        page={normalizedPage}
        onChange={handleChange}
        siblingCount={normalizedSiblingCount}
        color="primary"
        size="medium"
        showFirstButton
        showLastButton
        renderItem={(item) => (
          <PaginationItem
            slots={{
              previous: ChevronLeft,
              next: ChevronRight,
            }}
            {...item}
            sx={{
              minWidth: {
                xs: 34,
                sm: 38,
              },

              height: {
                xs: 34,
                sm: 38,
              },

              mx: {
                xs: 0.2,
                sm: 0.35,
              },

              borderRadius: 2,

              color: '#5f5f63',

              backgroundColor: 'transparent',

              border:
                '1px solid transparent',

              fontSize: {
                xs: '0.8rem',
                sm: '0.86rem',
              },

              fontWeight: 600,

              transition:
                'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

              '&:hover': {
                color: '#333336',

                backgroundColor: '#f1f1f2',

                borderColor:
                  'rgba(0,0,0,0.05)',

                transform: 'translateY(-1px)',
              },

              '&.Mui-selected': {
                color: '#ffffff',

                background:
                  'linear-gradient(135deg, #242424 0%, #111111 100%)',

                borderColor: '#1b1b1b',

                boxShadow:
                  '0 5px 14px rgba(0,0,0,0.12)',

                '&:hover': {
                  color: '#ffffff',

                  background:
                    'linear-gradient(135deg, #202020 0%, #0c0c0c 100%)',

                  transform: 'translateY(-1px)',
                },
              },

              '&.Mui-disabled': {
                opacity: 0.4,

                color: '#9a9a9e',

                backgroundColor: 'transparent',

                transform: 'none',
              },

              '&.MuiPaginationItem-ellipsis': {
                color: '#8b8b90',

                borderColor: 'transparent',

                backgroundColor: 'transparent',
              },

              '& .MuiSvgIcon-root': {
                fontSize: {
                  xs: 19,
                  sm: 20,
                },
              },
            }}
          />
        )}
        sx={{
          flexShrink: 0,

          '& .MuiPagination-ul': {
            flexWrap: 'nowrap',

            alignItems: 'center',

            gap: {
              xs: 0.15,
              sm: 0.25,
            },
          },
        }}
      />
    </Box>
  );
};