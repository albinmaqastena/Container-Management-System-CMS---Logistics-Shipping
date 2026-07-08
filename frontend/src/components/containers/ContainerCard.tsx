// src/components/containers/ContainerCard.tsx
import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Button,
  IconButton,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Container } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useContainers } from '../../contexts/ContainerContext';
import { toast } from 'react-toastify';

interface ContainerCardProps {
  container: Container;
  isArchived?: boolean;
  onClick?: () => void;
}

export const ContainerCard: React.FC<ContainerCardProps> = ({
  container,
  isArchived = false,
  onClick,
}) => {
  const { user } = useAuth();
  const { updateContainerStatus, softDeleteContainer } = useContainers();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const usagePercentage = (container.usedVolume / container.totalVolume) * 100;

  const handleStatusChange = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = isArchived ? 'active' : 'archived';
    try {
      await updateContainerStatus(container.id, newStatus);
      toast.success(`Container ${newStatus === 'active' ? 'activated' : 'archived'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete container "${container.name}"?`)) {
      try {
        await softDeleteContainer(container.id);
        toast.success('Container moved to trash');
      } catch (error) {
        toast.error('Failed to delete container');
      }
    }
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
          cursor: onClick ? 'pointer' : 'default',
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6" component="div" noWrap sx={{ maxWidth: '70%' }}>
            {container.name}
          </Typography>
          <Chip
            label={container.status}
            color={isArchived ? 'default' : 'success'}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="textSecondary" gutterBottom>
          Code: {container.containerCode}
        </Typography>

        {container.description && (
          <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
            {container.description}
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">
              Volume
            </Typography>
            <Typography variant="body2">
              {container.usedVolume.toFixed(1)} / {container.totalVolume.toFixed(1)} m³
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(usagePercentage, 100)}
            sx={{ mt: 1, height: 6, borderRadius: 3 }}
            color={usagePercentage > 90 ? 'error' : usagePercentage > 70 ? 'warning' : 'primary'}
          />
          <Typography variant="caption" color="textSecondary">
            {container.availableVolume.toFixed(2)} m³ available
          </Typography>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Items: {container.items?.length || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Created: {new Date(container.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>

      {isAdmin && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          <IconButton
            size="small"
            onClick={handleStatusChange}
            color={isArchived ? 'primary' : 'default'}
            title={isArchived ? 'Activate' : 'Archive'}
          >
            {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={handleDelete}
            title="Delete"
          >
            <DeleteIcon />
          </IconButton>
        </CardActions>
      )}
    </Card>
  );
};