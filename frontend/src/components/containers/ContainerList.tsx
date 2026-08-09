// src/components/containers/ContainerList.tsx

import type { Container } from '../../types';

import {
  Box,
  Grid,
  Typography,
} from '@mui/material';

import { ContainerCard } from './ContainerCard';

import { useNavigate } from 'react-router-dom';

interface ContainerListProps {
  containers: Container[];
  emptyMessage?: string;
}

export const ContainerList = ({
  containers,
  emptyMessage = 'No containers found',
}: ContainerListProps) => {
  const navigate = useNavigate();

  if (containers.length === 0) {
    return (
      <Box
        role="status"
        sx={{
          width: '100%',

          minHeight: {
            xs: 220,
            sm: 260,
          },

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          px: {
            xs: 2,
            sm: 3,
          },

          py: {
            xs: 5,
            sm: 6,
          },

          textAlign: 'center',

          backgroundColor: '#ffffff',

          border: '1px dashed #d8d8dc',

          borderRadius: 2.5,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: '#77777c',

            fontSize: {
              xs: '0.84rem',
              sm: '0.9rem',
            },

            fontWeight: 500,

            lineHeight: 1.6,
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
      {containers.map((container) => (
        <Grid
          key={container.id}
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
            <ContainerCard
              container={container}
              onClick={() =>
                navigate(
                  `/containers/${container.id}`,
                )
              }
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};