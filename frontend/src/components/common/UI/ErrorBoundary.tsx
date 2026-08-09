// src/components/common/ErrorBoundary/ErrorBoundary.tsx

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import {
  Box,
  Typography,
  Button,
  Paper,
} from '@mui/material';

import {
  ErrorOutlineRounded as ErrorIcon,
  RefreshRounded as RefreshIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    // Në production, këtu mund të shtohet integrim me Sentry ose shërbim tjetër monitoring
    console.error(
      'Error caught by boundary:',
      error,
      errorInfo,
    );
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isDevelopment =
        process.env.NODE_ENV === 'development';

      const errorMessage = isDevelopment
        ? this.state.error?.message ??
          'An unexpected error occurred.'
        : 'An unexpected error occurred. Please reload the page.';

      return (
        <Box
          sx={{
            minHeight: '70vh',

            width: '100%',

            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',

            px: {
              xs: 2,
              sm: 3,
            },

            py: {
              xs: 4,
              sm: 6,
            },

            backgroundColor: '#f7f7f8',
          }}
        >
          <Paper
            role="alert"
            elevation={0}
            sx={{
              width: '100%',

              maxWidth: 520,

              mx: 'auto',

              px: {
                xs: 2.5,
                sm: 4,
              },

              py: {
                xs: 3,
                sm: 4,
              },

              textAlign: 'center',

              borderRadius: {
                xs: 3,
                sm: 3.5,
              },

              backgroundColor: '#ffffff',

              border:
                '1px solid rgba(0,0,0,0.07)',

              boxShadow:
                '0 16px 40px rgba(0,0,0,0.08)',
            }}
          >
            <Box
              sx={{
                width: {
                  xs: 56,
                  sm: 62,
                },

                height: {
                  xs: 56,
                  sm: 62,
                },

                mx: 'auto',

                mb: {
                  xs: 2,
                  sm: 2.5,
                },

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                borderRadius: '50%',

                backgroundColor: '#f2f2f3',

                border:
                  '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <ErrorIcon
                sx={{
                  fontSize: {
                    xs: 30,
                    sm: 34,
                  },

                  color: '#3f3f43',
                }}
              />
            </Box>

            <Typography
              component="h1"
              sx={{
                color: '#181818',

                fontSize: {
                  xs: '1.35rem',
                  sm: '1.55rem',
                },

                fontWeight: 700,

                lineHeight: 1.25,

                letterSpacing: '-0.025em',
              }}
            >
              Something went wrong
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 1.25,

                mb: {
                  xs: 2.5,
                  sm: 3,
                },

                color: '#707075',

                fontSize: {
                  xs: '0.85rem',
                  sm: '0.9rem',
                },

                lineHeight: 1.65,

                wordBreak: 'break-word',
              }}
            >
              {errorMessage}
            </Typography>

            <Button
              variant="contained"
              onClick={this.handleReload}
              aria-label="Reload the page"
              startIcon={<RefreshIcon />}
              disableElevation
              sx={{
                minWidth: 160,

                minHeight: 46,

                px: 2.5,

                borderRadius: 2.25,

                backgroundColor: '#202020',

                color: '#ffffff',

                fontSize: '0.9rem',

                fontWeight: 600,

                textTransform: 'none',

                boxShadow: 'none',

                transition:
                  'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

                '&:hover': {
                  backgroundColor: '#111111',

                  transform: 'translateY(-1px)',

                  boxShadow:
                    '0 7px 18px rgba(0,0,0,0.13)',
                },

                '&:active': {
                  transform: 'translateY(0)',

                  boxShadow: 'none',
                },
              }}
            >
              Reload Page
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}