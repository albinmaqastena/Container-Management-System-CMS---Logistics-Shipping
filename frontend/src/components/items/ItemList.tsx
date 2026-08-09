// src/components/items/ItemList.tsx

import {
  Box,
  Grid,
  Typography,
} from '@mui/material';

import type { Item } from '../../types';

import { ItemCard } from './ItemCard';
import { LoadingSpinner } from '../common/UI/LoadingSpinner';

interface ItemListProps {
  items: Item[];
  loading?: boolean;
  emptyMessage?: string;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
}

export const ItemList = ({
  items,
  loading = false,
  emptyMessage = 'No items found',
  onEdit,
  onDelete,
}: ItemListProps) => {
  if (loading) {
    return (
      <LoadingSpinner
        message="Loading items..."
        minHeight="200px"
      />
    );
  }

  if (items.length === 0) {
    return (
      <Box
        role="status"
        sx={{
          width: '100%',

          minHeight: {
            xs: 200,
            sm: 240,
          },

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

          textAlign: 'center',

          px: {
            xs: 2,
            sm: 3,
          },

          py: {
            xs: 4,
            sm: 5,
          },

          backgroundColor: '#ffffff',

          border:
            '1px dashed #d4d4d8',

          borderRadius: 2.5,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: '#6f6f74',

            fontSize: {
              xs: '0.88rem',
              sm: '0.95rem',
            },

            fontWeight: 600,

            lineHeight: 1.5,
          }}
        >
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid
      container
      spacing={{
        xs: 2,
        sm: 2.5,
        md: 3,
      }}
      sx={{
        width: '100%',

        alignItems: 'stretch',
      }}
    >
      {items.map((item) => (
        <Grid
          key={item.id}
          size={{
            xs: 12,
            sm: 6,
            md: 4,
          }}
          sx={{
            display: 'flex',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
            }}
          >
            <ItemCard
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};