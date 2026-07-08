// src/components/containers/ContainerDetailList.tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { Container } from '../../types';
import { useNavigate } from 'react-router-dom';

interface ContainerDetailListProps {
  containers: Container[];
  onView?: (container: Container) => void;
  showActions?: boolean;
}

export const ContainerDetailList: React.FC<ContainerDetailListProps> = ({
  containers,
  onView,
  showActions = true,
}) => {
  const navigate = useNavigate();

  const handleView = (container: Container) => {
    if (onView) {
      onView(container);
    } else {
      navigate(`/containers/${container.id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'archived':
        return 'default';
      case 'shipped':
        return 'info';
      default:
        return 'default';
    }
  };

  if (containers.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="textSecondary">No containers found</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table>
        <TableHead sx={{ bgcolor: 'grey.50' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">
              Volume (m³)
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">
              Usage
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">
              Items
            </TableCell>
            {showActions && (
              <TableCell sx={{ fontWeight: 600 }} align="center">
                Actions
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {containers.map((container) => {
            const usagePercentage =
              container.totalVolume > 0
                ? (container.usedVolume / container.totalVolume) * 100
                : 0;

            return (
              <TableRow
                key={container.id}
                hover
                sx={{
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500 }}
                  >
                    {container.name}
                  </Typography>
                  {container.description && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{
                        display: 'block',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {container.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {container.containerCode}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={container.status}
                    color={getStatusColor(container.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {container.usedVolume.toFixed(1)} /{' '}
                    {container.totalVolume.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {container.availableVolume.toFixed(1)} available
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 120 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usagePercentage, 100)}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                      }}
                      color={
                        usagePercentage > 90
                          ? 'error'
                          : usagePercentage > 70
                          ? 'warning'
                          : 'primary'
                      }
                    />
                    <Typography variant="caption" color="textSecondary">
                      {usagePercentage.toFixed(0)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {container.items?.length || 0}
                  </Typography>
                </TableCell>
                {showActions && (
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleView(container)}
                      title="View details"
                      sx={{
                        '&:hover': {
                          bgcolor: 'primary.light',
                          color: 'primary.main',
                        },
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};