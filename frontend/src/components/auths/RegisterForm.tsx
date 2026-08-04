// src/components/auths/RegisterForm.tsx
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utilis/constants';
import type { UserRole } from '../../types';
import {
  Box,
  Button,
  TextField,
  Alert,
  InputAdornment,
  IconButton,
  MenuItem,
} from '@mui/material';
import { Visibility, VisibilityOff, Person, Email, Lock } from '@mui/icons-material';

interface RegisterFormProps {
  onSuccess?: () => void;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const { register, user } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ROLES.USER,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin =
    user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]:
        name === 'role'
          ? (value as UserRole)
          : value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    const username = formData.username.trim();
    const email = formData.email.trim().toLowerCase();

    if (!username || !email) {
      setError('Username and email are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register({
        username,
        email,
        password: formData.password,
        role: formData.role,
      });

      onSuccess?.();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Registration failed',
        );
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Alert severity="error" role="alert">
        You don't have permission to register new users.
      </Alert>
    );
  }

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
        name="username"
        label="Username"
        autoComplete="username"
        value={formData.username}
        onChange={handleChange}
        disabled={loading}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Person color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        margin="normal"
        required
        fullWidth
        name="email"
        label="Email Address"
        type="email"
        autoComplete="email"
        value={formData.email}
        onChange={handleChange}
        disabled={loading}
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
        name="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={formData.password}
        onChange={handleChange}
        disabled={loading}
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

      <TextField
        margin="normal"
        required
        fullWidth
        name="confirmPassword"
        label="Confirm Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={formData.confirmPassword}
        onChange={handleChange}
        disabled={loading}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        margin="normal"
        select
        fullWidth
        name="role"
        label="Role"
        value={formData.role}
        onChange={handleChange}
        disabled={loading}
      >
        <MenuItem value={ROLES.USER}>User</MenuItem>
        {user?.role === ROLES.SUPER_ADMIN && (
          <MenuItem value={ROLES.ADMIN}>Admin</MenuItem>
        )}
        {user?.role === ROLES.SUPER_ADMIN && (
          <MenuItem value={ROLES.SUPER_ADMIN}>Super Admin</MenuItem>
        )}
      </TextField>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ mt: 3 }}
      >
        {loading ? 'Creating...' : 'Create User'}
      </Button>
    </Box>
  );
};

export default RegisterForm;