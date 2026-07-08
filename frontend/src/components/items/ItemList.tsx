import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Item } from '../../types';
import { ItemCard } from './ItemCard';

interface ItemListProps {
  items: Item[];
  loading?: boolean;
  emptyMessage?: string;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  loading = false,
  emptyMessage = 'No items found',
  onEdit,
  onDelete,
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="textSecondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.id}
          sx={{
            width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.33% - 16px)' },
            minWidth: { xs: '100%', sm: '280px' },
          }}
        >
          <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
        </Box>
      ))}
    </Box>
  );
};