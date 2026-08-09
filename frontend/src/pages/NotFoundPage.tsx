// src/pages/NotFoundPage.tsx

import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
} from '@mui/material';
import {
  ErrorOutlined as ErrorIcon,
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';

export const NotFoundPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: {
          xs: '70vh',
          sm: '75vh',
        },

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        boxSizing: 'border-box',

        px: {
          xs: 1,
          sm: 2,
        },

        py: {
          xs: 4,
          sm: 5,
          md: 6,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 620,

          position: 'relative',
          overflow: 'hidden',

          boxSizing: 'border-box',

          px: {
            xs: 2.5,
            sm: 4,
            md: 5,
          },

          py: {
            xs: 4,
            sm: 5,
            md: 6,
          },

          textAlign: 'center',

          backgroundColor: '#ffffff',

          border: '1px solid #dedee2',

          borderRadius: {
            xs: 2,
            sm: 2.5,
          },

          boxShadow:
            '0 8px 28px rgba(0, 0, 0, 0.045)',

          '&::before': {
            content: '""',

            position: 'absolute',

            top: 0,
            left: 0,
            right: 0,

            height: 3,

            backgroundColor: '#dc2626',
          },
        }}
      >
        {/* Error icon */}
        <Box
          sx={{
            width: {
              xs: 64,
              sm: 72,
            },

            height: {
              xs: 64,
              sm: 72,
            },

            mx: 'auto',
            mb: 2.5,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            borderRadius: '50%',

            backgroundColor: '#fef2f2',

            border: '1px solid #fecaca',
          }}
        >
          <ErrorIcon
            aria-hidden="true"
            sx={{
              fontSize: {
                xs: 32,
                sm: 36,
              },

              color: '#dc2626',
            }}
          />
        </Box>

        {/* Error code */}
        <Typography
          component="h1"
          sx={{
            color: '#18181b',

            fontSize: {
              xs: '3.5rem',
              sm: '4.5rem',
            },

            fontWeight: 800,

            lineHeight: 1,

            letterSpacing: '-0.055em',
          }}
        >
          404
        </Typography>

        {/* Title */}
        <Typography
          component="h2"
          sx={{
            mt: 1.5,

            color: '#202024',

            fontSize: {
              xs: '1.35rem',
              sm: '1.6rem',
            },

            fontWeight: 700,

            lineHeight: 1.25,

            letterSpacing: '-0.025em',
          }}
        >
          Page Not Found
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          sx={{
            mt: 1.25,

            mx: 'auto',

            maxWidth: 430,

            color: '#71717a',

            fontSize: {
              xs: '0.88rem',
              sm: '0.94rem',
            },

            lineHeight: 1.7,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist.
        </Typography>

        {/* Divider */}
        <Box
          sx={{
            width: '100%',
            height: '1px',

            my: {
              xs: 3,
              sm: 3.5,
            },

            backgroundColor: '#ececef',
          }}
        />

        {/* Action */}
        <Button
          variant="contained"
          size="large"
          onClick={() =>
            navigate(
              user
                ? '/dashboard'
                : '/login',
            )
          }
          sx={{
            minWidth: {
              xs: '100%',
              sm: 190,
            },

            minHeight: 46,

            px: 3,

            borderRadius: 2,

            backgroundColor: '#202024',

            color: '#ffffff',

            fontSize: '0.88rem',

            fontWeight: 700,

            textTransform: 'none',

            boxShadow: 'none',

            transition:
              'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

            '&:hover': {
              backgroundColor: '#111113',

              boxShadow:
                '0 6px 16px rgba(0, 0, 0, 0.14)',

              transform:
                'translateY(-1px)',
            },

            '&:active': {
              transform:
                'translateY(0)',
            },

            '&:focus-visible': {
              outline:
                '2px solid #202024',

              outlineOffset: 3,
            },
          }}
        >
          {user
            ? 'Go to Dashboard'
            : 'Go to Login'}
        </Button>

        {/* Bottom information */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',

            mt: 2.5,

            color: '#a1a1aa',

            fontSize: {
              xs: '0.7rem',
              sm: '0.74rem',
            },

            lineHeight: 1.5,
          }}
        >
          Error code: 404 · Page not found
        </Typography>
      </Paper>
    </Box>
  );
};

export default NotFoundPage;