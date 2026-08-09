// src/pages/RegisterPage.tsx

import {
  useNavigate,
  Navigate,
} from 'react-router-dom';

import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';

import {
  PersonAddAlt1Outlined as PersonAddIcon,
} from '@mui/icons-material';

import { RegisterForm } from '../components/auths/RegisterForm';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utilis/constants';

export const RegisterPage = () => {
  const navigate = useNavigate();

  const {
    user,
    isLoading,
  } = useAuth();

  // Prisni që auth të ngarkohet para se të kontrolloni rolin
  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

          backgroundColor: '#f5f5f6',
        }}
      >
        <CircularProgress
          size={34}
          thickness={4}
          sx={{
            color: '#202024',
          }}
        />
      </Box>
    );
  }

  // Vetëm Admin dhe Super Admin mund të krijojnë përdorues
  if (
    user?.role !== ROLES.ADMIN &&
    user?.role !== ROLES.SUPER_ADMIN
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const handleSuccess = (): void => {
    // Navigo te dashboard pas krijimit të suksesshëm
    navigate('/dashboard');
  };

  return (
    <Box
      sx={{
        width: '100%',

        minHeight: {
          xs: 'auto',
          md: 'calc(100dvh - 72px)',
        },

        display: 'flex',

        alignItems: {
          xs: 'flex-start',
          md: 'center',
        },

        justifyContent: 'center',

        boxSizing: 'border-box',

        backgroundColor: '#ffffff',

        py: {
          xs: 2,
          sm: 3,
          md: 4,
        },
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          width: '100%',

          px: {
            xs: 0,
            sm: 1,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',

            boxSizing: 'border-box',

            overflow: 'hidden',

            backgroundColor: '#ffffff',

            border: '1px solid #d7d7db',

            borderRadius: {
              xs: 2,
              sm: 3,
            },

            boxShadow: {
              xs: 'none',
              sm: '0 12px 36px rgba(0, 0, 0, 0.06)',
            },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: {
                xs: 2.25,
                sm: 3.5,
              },

              pt: {
                xs: 2.75,
                sm: 3.5,
              },

              pb: {
                xs: 2.25,
                sm: 2.75,
              },

              textAlign: 'center',

              backgroundColor: '#fafafa',

              borderBottom: '1px solid #e5e5e8',
            }}
          >
            {/* Icon */}
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

                mb: 2,

                display: 'flex',

                alignItems: 'center',

                justifyContent: 'center',

                borderRadius: '50%',

                backgroundColor: '#f1f1f3',

                border: '1px solid #dedee2',

                color: '#202024',
              }}
            >
              <PersonAddIcon
                sx={{
                  fontSize: {
                    xs: 27,
                    sm: 30,
                  },
                }}
              />
            </Box>

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

                letterSpacing: '-0.035em',
              }}
            >
              Register New User
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 0.75,

                mx: 'auto',

                maxWidth: 380,

                color: '#71717a',

                fontSize: {
                  xs: '0.8rem',
                  sm: '0.84rem',
                },

                fontWeight: 500,

                lineHeight: 1.6,
              }}
            >
              Create a new user account.
            </Typography>
          </Box>

          {/* Form */}
          <Box
            sx={{
              p: {
                xs: 2.25,
                sm: 3.5,
              },

              /*
               * Vetëm styling për RegisterForm.
               * Nuk ndryshon logjikën e RegisterForm.
               */

              '& .MuiTextField-root': {
                width: '100%',
              },

              '& .MuiFormControl-root': {
                width: '100%',
              },

              '& .MuiInputLabel-root': {
                color: '#66666b',

                fontWeight: 600,

                fontSize: '0.88rem',
              },

              '& .MuiInputLabel-root.Mui-focused': {
                color: '#202024',
              },

              '& .MuiOutlinedInput-root': {
                minHeight: 52,

                borderRadius: 2,

                backgroundColor: '#ffffff',

                color: '#18181b',

                transition:
                  'border-color 0.18s ease, box-shadow 0.18s ease',

                '& fieldset': {
                  borderColor: '#c9c9ce',
                },

                '&:hover fieldset': {
                  borderColor: '#9f9fa5',
                },

                '&.Mui-focused fieldset': {
                  borderColor: '#202024',

                  borderWidth: 1.5,
                },

                '&.Mui-focused': {
                  boxShadow:
                    '0 0 0 3px rgba(32, 32, 36, 0.055)',
                },

                '&.Mui-disabled': {
                  backgroundColor: '#f3f3f5',
                },

                '&.Mui-disabled fieldset': {
                  borderColor: '#dedee1',
                },
              },

              '& .MuiInputBase-input': {
                color: '#18181b',

                WebkitTextFillColor: '#18181b',

                fontSize: {
                  xs: '16px',
                  sm: '0.9rem',
                },

                fontWeight: 500,

                '&::placeholder': {
                  color: '#929297',

                  opacity: 1,
                },
              },

              '& .MuiSelect-select': {
                color: '#18181b',

                WebkitTextFillColor: '#18181b',

                fontSize: {
                  xs: '16px',
                  sm: '0.9rem',
                },

                fontWeight: 500,
              },

              '& .MuiInputAdornment-root .MuiSvgIcon-root': {
                color: '#6c6c71',
              },

              '& .MuiIconButton-root': {
                color: '#69696e',

                '&:hover': {
                  color: '#202024',

                  backgroundColor: '#eeeeF0',
                },
              },

              '& .MuiFormHelperText-root': {
                mx: 0.25,

                mt: 0.65,

                color: '#78787d',

                fontSize: '0.72rem',

                fontWeight: 500,
              },

              '& .MuiAlert-root': {
                borderRadius: 2,

                fontSize: '0.8rem',

                fontWeight: 600,
              },

              '& .MuiAlert-standardError': {
                backgroundColor: '#fff4f5',

                color: '#9b2831',

                border: '1px solid #efc9cc',

                '& .MuiAlert-icon': {
                  color: '#c9363f',
                },
              },

              '& .MuiAlert-standardSuccess': {
                backgroundColor: '#f1f8f3',

                color: '#2d6b3d',

                border: '1px solid #cfe4d4',

                '& .MuiAlert-icon': {
                  color: '#3e8a54',
                },
              },

              '& .MuiButton-contained': {
                minHeight: 48,

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
                  backgroundColor: '#111114',

                  color: '#ffffff',

                  transform: 'translateY(-1px)',

                  boxShadow:
                    '0 6px 16px rgba(0, 0, 0, 0.12)',
                },

                '&:active': {
                  transform: 'translateY(0)',
                },

                '&.Mui-disabled': {
                  backgroundColor: '#505055',

                  color: '#eeeeF0',

                  opacity: 1,

                  boxShadow: 'none',
                },
              },

              '& .MuiButton-outlined': {
                minHeight: 46,

                borderRadius: 2,

                borderColor: '#c9c9ce',

                color: '#27272a',

                backgroundColor: '#ffffff',

                fontWeight: 700,

                textTransform: 'none',

                '&:hover': {
                  borderColor: '#202024',

                  backgroundColor: '#f5f5f6',
                },
              },
            }}
          >
            <RegisterForm
              onSuccess={handleSuccess}
            />
          </Box>

          {/* Footer i card */}
          <Box
            sx={{
              px: {
                xs: 2.25,
                sm: 3.5,
              },

              py: 1.6,

              textAlign: 'center',

              backgroundColor: '#fafafa',

              borderTop: '1px solid #ededf0',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',

                color: '#8a8a90',

                fontSize: '0.7rem',

                fontWeight: 500,

                lineHeight: 1.5,
              }}
            >
              New users will be able to access the system
              according to their assigned role.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default RegisterPage;