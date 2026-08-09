// src/pages/ResetPasswordPage.tsx

import { useEffect, useRef } from 'react';
import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Button,
} from '@mui/material';

import {
  LockResetOutlined as LockResetIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

import { ResetPasswordForm } from '../components/auths/ResetPasswordForm';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const token =
    searchParams.get('token');

  const timeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const handleSuccess = (): void => {
    if (timeoutRef.current) {
      clearTimeout(
        timeoutRef.current,
      );
    }

    timeoutRef.current =
      setTimeout(() => {
        timeoutRef.current =
          null;

        navigate('/login');
      }, 2000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current,
        );

        timeoutRef.current =
          null;
      }
    };
  }, []);

  if (!token) {
    return (
      <Box
        sx={{
          width: '100%',

          minHeight: '100dvh',

          display: 'flex',

          alignItems: 'center',

          justifyContent:
            'center',

          backgroundColor:
            '#f5f5f6',

          boxSizing: 'border-box',

          px: {
            xs: 2,
            sm: 3,
          },

          py: {
            xs: 4,
            sm: 5,
          },
        }}
      >
        <Container
          maxWidth="xs"
          disableGutters
          sx={{
            width: '100%',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',

              boxSizing:
                'border-box',

              overflow: 'hidden',

              border:
                '1px solid #d7d7db',

              borderRadius: 3,

              backgroundColor:
                '#ffffff',

              boxShadow:
                '0 12px 36px rgba(0, 0, 0, 0.07)',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: {
                  xs: 2.5,
                  sm: 3.5,
                },

                pt: {
                  xs: 3,
                  sm: 3.5,
                },

                pb: 2.5,

                textAlign:
                  'center',

                borderBottom:
                  '1px solid #e5e5e8',
              }}
            >
              <Box
                sx={{
                  width: 58,
                  height: 58,

                  mx: 'auto',

                  mb: 2,

                  display: 'flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  borderRadius:
                    '50%',

                  backgroundColor:
                    '#fef2f2',

                  border:
                    '1px solid #fecaca',

                  color:
                    '#dc2626',
                }}
              >
                <LockResetIcon
                  sx={{
                    fontSize: 29,
                  }}
                />
              </Box>

              <Typography
                component="h1"
                sx={{
                  color:
                    '#18181b',

                  fontSize: {
                    xs: '1.4rem',
                    sm: '1.55rem',
                  },

                  fontWeight: 800,

                  lineHeight: 1.2,

                  letterSpacing:
                    '-0.03em',
                }}
              >
                Reset Password
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,

                  color:
                    '#71717a',

                  fontSize:
                    '0.82rem',

                  lineHeight: 1.6,
                }}
              >
                We couldn&apos;t verify
                your password reset
                request.
              </Typography>
            </Box>

            {/* Content */}
            <Box
              sx={{
                p: {
                  xs: 2.5,
                  sm: 3.5,
                },
              }}
            >
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,

                  alignItems:
                    'center',

                  border:
                    '1px solid #fecaca',

                  borderRadius: 2,

                  backgroundColor:
                    '#fff7f7',

                  color:
                    '#991b1b',

                  fontSize:
                    '0.84rem',

                  fontWeight: 600,

                  '& .MuiAlert-icon':
                    {
                      color:
                        '#dc2626',
                    },
                }}
              >
                Invalid reset token
              </Alert>

              <Button
                fullWidth
                variant="outlined"
                startIcon={
                  <ArrowBackIcon />
                }
                onClick={() =>
                  navigate('/login')
                }
                sx={{
                  minHeight: 46,

                  borderRadius: 2,

                  borderColor:
                    '#c9c9ce',

                  color:
                    '#27272a',

                  backgroundColor:
                    '#ffffff',

                  fontSize:
                    '0.86rem',

                  fontWeight: 700,

                  textTransform:
                    'none',

                  boxShadow:
                    'none',

                  '&:hover': {
                    borderColor:
                      '#202024',

                    backgroundColor:
                      '#f5f5f6',

                    boxShadow:
                      'none',
                  },
                }}
              >
                Back to Login
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',

        minHeight: '100dvh',

        display: 'flex',

        alignItems: 'center',

        justifyContent:
          'center',

        backgroundColor:
          '#f5f5f6',

        boxSizing: 'border-box',

        px: {
          xs: 2,
          sm: 3,
        },

        py: {
          xs: 4,
          sm: 5,
        },
      }}
    >
      <Container
        maxWidth="xs"
        disableGutters
        sx={{
          width: '100%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',

            boxSizing: 'border-box',

            overflow: 'hidden',

            border:
              '1px solid #d7d7db',

            borderRadius: 3,

            backgroundColor:
              '#ffffff',

            boxShadow:
              '0 12px 36px rgba(0, 0, 0, 0.07)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: {
                xs: 2.5,
                sm: 3.5,
              },

              pt: {
                xs: 3,
                sm: 3.5,
              },

              pb: 2.5,

              textAlign: 'center',

              borderBottom:
                '1px solid #e5e5e8',

              backgroundColor:
                '#fafafa',
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: {
                  xs: 58,
                  sm: 64,
                },

                height: {
                  xs: 58,
                  sm: 64,
                },

                mx: 'auto',

                mb: 2,

                display: 'flex',

                alignItems: 'center',

                justifyContent:
                  'center',

                borderRadius: '50%',

                backgroundColor:
                  '#f1f1f3',

                border:
                  '1px solid #dedee2',

                color: '#27272a',
              }}
            >
              <LockResetIcon
                sx={{
                  fontSize: {
                    xs: 28,
                    sm: 31,
                  },
                }}
              />
            </Box>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                color: '#18181b',

                fontSize: {
                  xs: '1.45rem',
                  sm: '1.65rem',
                },

                fontWeight: 800,

                lineHeight: 1.2,

                letterSpacing:
                  '-0.035em',
              }}
            >
              Reset Password
            </Typography>

            {/* Subtitle */}
            <Typography
              variant="body2"
              sx={{
                mt: 0.75,

                mx: 'auto',

                maxWidth: 320,

                color: '#71717a',

                fontSize: {
                  xs: '0.8rem',
                  sm: '0.84rem',
                },

                fontWeight: 500,

                lineHeight: 1.6,
              }}
            >
              Create a new secure
              password for your
              account.
            </Typography>
          </Box>

          {/* Form */}
          <Box
            sx={{
              p: {
                xs: 2.5,
                sm: 3.5,
              },

              /*
               * Design only për
               * ResetPasswordForm.
               * Nuk ndryshon logjikën
               * e komponentit.
               */

              '& .MuiTextField-root':
                {
                  mb: 0.5,
                },

              '& .MuiInputLabel-root':
                {
                  color: '#66666c',

                  fontWeight: 500,
                },

              '& .MuiInputLabel-root.Mui-focused':
                {
                  color: '#202024',
                },

              '& .MuiOutlinedInput-root':
                {
                  minHeight: 50,

                  borderRadius: 2,

                  backgroundColor:
                    '#ffffff',

                  color: '#18181b',

                  transition:
                    'border-color 0.18s ease, box-shadow 0.18s ease',

                  '& fieldset': {
                    borderColor:
                      '#c9c9ce',
                  },

                  '&:hover fieldset':
                    {
                      borderColor:
                        '#9f9fa5',
                    },

                  '&.Mui-focused fieldset':
                    {
                      borderColor:
                        '#202024',

                      borderWidth:
                        1.5,
                    },

                  '&.Mui-focused':
                    {
                      boxShadow:
                        '0 0 0 3px rgba(32,32,36,0.06)',
                    },
                },

              '& .MuiInputBase-input':
                {
                  color: '#18181b',

                  fontSize: {
                    xs: '16px',
                    sm: '0.9rem',
                  },

                  fontWeight: 500,
                },

              '& .MuiFormHelperText-root':
                {
                  mx: 0.25,

                  mt: 0.65,

                  fontSize:
                    '0.72rem',
                },

              '& .MuiButton-contained':
                {
                  minHeight: 46,

                  borderRadius: 2,

                  backgroundColor:
                    '#202024',

                  color: '#ffffff',

                  fontSize:
                    '0.86rem',

                  fontWeight: 700,

                  textTransform:
                    'none',

                  boxShadow: 'none',

                  transition:
                    'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

                  '&:hover': {
                    backgroundColor:
                      '#111113',

                    boxShadow:
                      '0 6px 16px rgba(0,0,0,0.12)',

                    transform:
                      'translateY(-1px)',
                  },

                  '&:active': {
                    transform:
                      'translateY(0)',
                  },

                  '&.Mui-disabled':
                    {
                      backgroundColor:
                        '#e4e4e7',

                      color:
                        '#929298',
                    },
                },

              '& .MuiAlert-root': {
                borderRadius: 2,

                fontSize: '0.82rem',
              },
            }}
          >
            <ResetPasswordForm
              token={token}
              onSuccess={
                handleSuccess
              }
            />
          </Box>

          {/* Bottom section */}
          <Box
            sx={{
              px: {
                xs: 2.5,
                sm: 3.5,
              },

              py: 1.75,

              textAlign: 'center',

              borderTop:
                '1px solid #ededf0',

              backgroundColor:
                '#fafafa',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: '#8a8a90',

                fontSize: '0.7rem',

                fontWeight: 500,

                lineHeight: 1.5,
              }}
            >
              Choose a strong password
              that you haven&apos;t used
              before.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ResetPasswordPage;