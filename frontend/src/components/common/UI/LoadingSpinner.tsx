// src/components/common/UI/LoadingSpinner.tsx

import type { SxProps, Theme } from '@mui/material';

import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  minHeight?: string | number;
  sx?: SxProps<Theme>;
}

export const LoadingSpinner = ({
  message = 'Loading...',
  fullScreen = false,
  minHeight,
  sx,
}: LoadingSpinnerProps) => {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',

        minHeight:
          minHeight ??
          (fullScreen ? '100vh' : '60vh'),

        px: {
          xs: 2,
          sm: 3,
        },

        py: {
          xs: 3,
          sm: 4,
        },

        textAlign: 'center',

        backgroundColor: 'transparent',

        ...sx,
      }}
    >
      <Box
        sx={{
          width: {
            xs: 72,
            sm: 78,
          },

          height: {
            xs: 72,
            sm: 78,
          },

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: '50%',

          backgroundColor: '#ffffff',

          border:
            '1px solid rgba(0,0,0,0.06)',

          boxShadow:
            '0 10px 28px rgba(0,0,0,0.07)',

          mb: 2,
        }}
      >
        <CircularProgress
          size={34}
          thickness={4}
          aria-label="Loading"
          sx={{
            color: '#202020',
          }}
        />
      </Box>

      <Typography
        variant="body1"
        sx={{
          color: '#6f6f73',

          fontSize: {
            xs: '0.88rem',
            sm: '0.94rem',
          },

          fontWeight: 500,

          lineHeight: 1.5,

          letterSpacing: '-0.005em',
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};