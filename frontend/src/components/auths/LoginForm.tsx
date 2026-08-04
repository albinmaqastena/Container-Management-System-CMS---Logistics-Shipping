// src/components/auths/LoginForm.tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import {
  Box,
  Button,
  TextField,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';

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

  // Merr location-in e plotë nga state (pathname, search, hash)
  const locationState = location.state as LoginLocationState | null;
  const fromLocation = locationState?.from;

  // Siguria: kontrollo vetëm pathname-in për të shmangur redirect në /login
  const isSafeLocation =
    fromLocation &&
    fromLocation.pathname.startsWith('/') &&
    !fromLocation.pathname.startsWith('//') &&
    fromLocation.pathname !== '/login';

  const safeFrom = isSafeLocation
    ? `${fromLocation.pathname}${fromLocation.search}${fromLocation.hash}`
    : '/dashboard';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail || password.length === 0) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      await login({
        email: normalizedEmail.toLowerCase(),
        password,
      });
      navigate(safeFrom, { replace: true });
    } catch (error: unknown) {
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
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-busy={loading}
      sx={{ width: '100%' }}
    >
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        margin="normal"
        required
        fullWidth
        autoFocus
        label="Email Address"
        type="email"
        autoComplete="email"
        disabled={loading}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Email color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        margin="normal"
        required
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        disabled={loading}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  onMouseDown={(event) => event.preventDefault()}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ mt: 3, mb: 2 }}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </Box>
  );
};

export default LoginForm;