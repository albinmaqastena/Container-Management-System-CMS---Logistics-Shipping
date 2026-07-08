// src/components/containers/ContainerList.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { Container } from '../../types';
import { ContainerCard } from './ContainerCard';
import { useNavigate } from 'react-router-dom';

interface ContainerListProps {
  containers: Container[];
  isArchived?: boolean;
  emptyMessage?: string;
}

export const ContainerList: React.FC<ContainerListProps> = ({
  containers,
  isArchived = false,
  emptyMessage = 'No containers found',
}) => {
  const navigate = useNavigate();

  if (containers.length === 0) {
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
      {containers.map((container) => (
        <Box
          key={container.id}
          sx={{
            width: {
              xs: '100%',
              sm: 'calc(50% - 12px)',
              md: 'calc(33.33% - 16px)',
            },
            minWidth: {
              xs: '100%',
              sm: '280px',
            },
          }}
        >
          <ContainerCard
            container={container}
            isArchived={isArchived}
            onClick={() => navigate(`/containers/${container.id}`)}
          />
        </Box>
      ))}
    </Box>
  );
};