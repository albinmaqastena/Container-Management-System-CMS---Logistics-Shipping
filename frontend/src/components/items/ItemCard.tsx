import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  CardActions,
  LinearProgress,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { Item } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface ItemCardProps {
  item: Item;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%' }}>
            {item.name}
          </Typography>
          <Chip
            label={item.uniqueNumber}
            color="primary"
            size="small"
            variant="outlined"
          />
        </Box>

        {item.photo && (
          <Box
            component="img"
            src={item.photo}
            alt={item.name}
            sx={{
              width: '100%',
              height: 120,
              objectFit: 'cover',
              borderRadius: 1,
              my: 2,
            }}
          />
        )}

        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" gutterBottom>
            <strong>Package Quantity:</strong> {item.packageQuantity}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Products/Package:</strong> {item.productsPerPackage}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Price/Package:</strong> ${item.packagePrice.toFixed(2)}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Volume/Package:</strong> {item.volume.toFixed(2)} m³
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Total Volume:</strong> {item.totalVolume.toFixed(2)} m³
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min((item.totalVolume / (item.container?.totalVolume || 1)) * 100, 100)}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        </Box>
      </CardContent>

      {isAdmin && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onEdit && (
            <IconButton size="small" onClick={() => onEdit(item)}>
              <EditIcon />
            </IconButton>
          )}
          {onDelete && (
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(item.id)}
            >
              <DeleteIcon />
            </IconButton>
          )}
        </CardActions>
      )}
    </Card>
  );
};