// src/components/auths/LoginForm.tsx

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import axios from 'axios';

import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';

import {
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  VisibilityOutlined as VisibilityIcon,
  VisibilityOffOutlined as VisibilityOffIcon,
} from '@mui/icons-material';

import { useAuth } from '../../hooks/useAuth';

interface LoginLocationState {
  from?: Location;
}

export const LoginForm = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locationState = location.state as LoginLocationState | null;
  const fromLocation = locationState?.from;

  const isSafeLocation =
    fromLocation &&
    fromLocation.pathname.startsWith('/') &&
    !fromLocation.pathname.startsWith('//') &&
    fromLocation.pathname !== '/login';

  const safeFrom = isSafeLocation
    ? `${fromLocation.pathname}${fromLocation.search}${fromLocation.hash}`
    : '/dashboard';

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
    event.preventDefault();

    console.log('LOGIN SUBMIT FIRED');

    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail || password.length === 0) {
        setError('Email and password are required');
        return;
    }

    setLoading(true);

    try {
        console.log('CALLING LOGIN', normalizedEmail);

        await login({
        email: normalizedEmail.toLowerCase(),
        password,
        });

        console.log('LOGIN SUCCESS');

        navigate(safeFrom, { replace: true });
    } catch (error: unknown) {
        console.error('LOGIN ERROR', error);

        if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;

        setError(
            Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
                ? message
                : 'Login failed',
        );
        } else {
        setError('Login failed');
        }
    } finally {
        console.log('LOGIN FINALLY');
        setLoading(false);
    }
    };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      minHeight: 56,
      borderRadius: 2.5,
      backgroundColor: '#fff',
      color: '#1a1a1a',

      '& fieldset': {
        borderColor: '#dddddd',
      },

      '&:hover fieldset': {
        borderColor: '#999999',
      },

      '&.Mui-focused fieldset': {
        borderColor: '#1f1f1f',
        borderWidth: 1.5,
      },
    },

    '& input': {
      color: '#1a1a1a',
      WebkitTextFillColor: '#1a1a1a',

      // 16px në mobile shmang auto-zoom në iOS Safari
      fontSize: {
        xs: '16px',
        sm: '0.95rem',
      },

      '&::placeholder': {
        color: '#999999',
        opacity: 1,
      },
    },
  } as const;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-busy={loading}
      sx={{ width: '100%' }}
    >
      {error && (
        <Alert
          severity="error"
          role="alert"
          sx={{
            mb: 2.5,
            borderRadius: 2,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Email */}
      <Box sx={{ mb: 2 }}>
        <Typography
          component="label"
          htmlFor="login-email"
          sx={{
            display: 'block',
            mb: 0.8,
            color: '#1b1b1b',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          Email
        </Typography>

        <TextField
          id="login-email"
          required
          fullWidth
          autoFocus
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          disabled={loading}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          sx={inputSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon
                    sx={{
                      color: '#777777',
                      fontSize: 21,
                    }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Password */}
      <Box>
        <Typography
          component="label"
          htmlFor="login-password"
          sx={{
            display: 'block',
            mb: 0.8,
            color: '#1b1b1b',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          Fjalëkalimi
        </Typography>

        <TextField
          id="login-password"
          required
          fullWidth
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Fjalëkalimi juaj"
          disabled={loading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          sx={inputSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon
                    sx={{
                      color: '#777777',
                      fontSize: 21,
                    }}
                  />
                </InputAdornment>
              ),

              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    disabled={loading}
                    edge="end"
                    sx={{
                      color: '#777777',

                      '&:hover': {
                        backgroundColor: '#f3f3f3',
                      },
                    }}
                  >
                    {showPassword ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={loading}
        sx={{
          mt: 3,
          height: 56,
          borderRadius: 2.25,
          backgroundColor: '#202020',
          color: '#ffffff',
          fontSize: '0.96rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'all 0.2s ease',

          '&:hover': {
            backgroundColor: '#0f0f0f',
            boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
            transform: 'translateY(-1px)',
          },

          '&.Mui-disabled': {
            backgroundColor: '#555555',
            color: '#dddddd',
          },
        }}
      >
        {loading ? 'Duke u kyçur...' : 'Kyçu'}
      </Button>
    </Box>
  );
};

export default LoginForm;