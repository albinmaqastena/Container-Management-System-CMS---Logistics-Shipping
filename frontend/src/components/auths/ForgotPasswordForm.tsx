// src/components/auths/ForgotPasswordForm.tsx

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import axios from 'axios';

import {
  Alert,
  Box,
  Button,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';

import {
  EmailOutlined as EmailIcon,
} from '@mui/icons-material';

import { useAuth } from '../../hooks/useAuth';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export const ForgotPasswordForm = ({
  onSuccess,
}: ForgotPasswordFormProps) => {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(false);

  const successTimerRef =
    useRef<number | null>(null);

  // Pastro timer-in kur komponenti çmontohet
  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(
          successTimerRef.current,
        );

        successTimerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (
    event: FormEvent,
  ): Promise<void> => {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    // Pastro timer-in e vjetër nëse ekziston
    if (successTimerRef.current !== null) {
      window.clearTimeout(
        successTimerRef.current,
      );

      successTimerRef.current = null;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Email is required');
      return;
    }

    setLoading(true);

    try {
      await forgotPassword({
        email: normalizedEmail,
      });

      setSuccess(
        'If an account exists for this email, a password reset link has been sent.',
      );

      if (onSuccess) {
        successTimerRef.current =
          window.setTimeout(() => {
            onSuccess();
            successTimerRef.current = null;
          }, 1500);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Failed to send reset link',
        );
      } else {
        setError(
          'Failed to send reset link',
        );
      }
    } finally {
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

      '&.Mui-disabled': {
        backgroundColor: '#fafafa',
      },
    },

    '& input': {
      color: '#1a1a1a',
      WebkitTextFillColor: '#1a1a1a',

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
      sx={{
        width: '100%',
      }}
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

      {success && (
        <Alert
          severity="success"
          role="status"
          sx={{
            mb: 2.5,
            borderRadius: 2,
          }}
        >
          {success}
        </Alert>
      )}

      <Box>
        <Typography
          component="label"
          htmlFor="forgot-password-email"
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
          id="forgot-password-email"
          required
          fullWidth
          autoFocus
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          disabled={
            loading || Boolean(success)
          }
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
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

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={
          loading || Boolean(success)
        }
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
            boxShadow:
              '0 8px 20px rgba(0,0,0,0.14)',
            transform: 'translateY(-1px)',
          },

          '&.Mui-disabled': {
            backgroundColor: '#555555',
            color: '#dddddd',
          },
        }}
      >
        {loading
          ? 'Duke dërguar...'
          : success
            ? 'Linku u dërgua'
            : 'Dërgo linkun'}
      </Button>
    </Box>
  );
};

export default ForgotPasswordForm;