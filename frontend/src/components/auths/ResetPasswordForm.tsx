// src/components/auths/ResetPasswordForm.tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
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
import { Lock, Visibility, VisibilityOff } from '@mui/icons-material';

interface ResetPasswordFormProps {
  token: string;
  onSuccess?: () => void;
}

export const ResetPasswordForm = ({
  token,
  onSuccess,
}: ResetPasswordFormProps) => {
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const successTimerRef = useRef<number | null>(null);

  // Pastro timer-in kur komponenti çmontohet
  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    // Pastro timer-in e vjetër nëse ekziston
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }

    // Kontrollo token-in
    if (!token.trim()) {
      setError('The password reset token is missing or invalid');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await resetPassword({
        token: token.trim(),
        newPassword: password,
      });

      setSuccess('Password reset successfully!');

      if (onSuccess) {
        successTimerRef.current = window.setTimeout(() => {
          onSuccess();
          successTimerRef.current = null;
        }, 2000);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Failed to reset password',
        );
      } else {
        setError('Failed to reset password');
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

      {success && (
        <Alert severity="success" role="status" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <TextField
        fullWidth
        autoFocus
        label="New Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading || Boolean(success)}
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
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Confirm Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        disabled={loading || Boolean(success)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={loading || Boolean(success)}
      >
        {loading
  ? 'Resetting...'
  : success
    ? 'Password Reset'
    : 'Reset Password'}
      </Button>
    </Box>
  );
};

export default ResetPasswordForm;