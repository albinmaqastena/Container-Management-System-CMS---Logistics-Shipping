// src/components/auths/ForgotPasswordForm.tsx
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
} from '@mui/material';
import { Email } from '@mui/icons-material';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export const ForgotPasswordForm = ({ onSuccess }: ForgotPasswordFormProps) => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
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

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Email is required');
      return;
    }

    setLoading(true);

    try {
      await forgotPassword({ email: normalizedEmail });
      setSuccess('If an account exists for this email, a password reset link has been sent.');

      if (onSuccess) {
        successTimerRef.current = window.setTimeout(() => {
          onSuccess();
          successTimerRef.current = null;
        }, 1500);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Failed to send reset link',
        );
      } else {
        setError('Failed to send reset link');
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
        label="Email Address"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading || Boolean(success)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Email color="action" />
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
  ? 'Sending...'
  : success
    ? 'Reset Link Sent'
    : 'Send Reset Link'}
      </Button>
    </Box>
  );
};

export default ForgotPasswordForm;