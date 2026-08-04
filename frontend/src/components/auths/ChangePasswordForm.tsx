// src/components/auths/ChangePasswordForm.tsx
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
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

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const ChangePasswordForm = ({ onSuccess }: ChangePasswordFormProps) => {
  const { changePassword } = useAuth();

  const [formData, setFormData] = useState<ChangePasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    // Pastro timer-in e vjetër nëse ekziston
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }

    // Validime
    if (!formData.currentPassword) {
      setError('Current password is required');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from the current password');
      return;
    }

    setLoading(true);

    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setSuccess('Password changed successfully!');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Vonesë e shkurtër për të lejuar që mesazhi i suksesit të shfaqet përpara se të mbyllet
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
              : 'Failed to change password',
        );
      } else {
        setError('Failed to change password');
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
        margin="normal"
        required
        fullWidth
        autoFocus
        name="currentPassword"
        label="Current Password"
        type={showCurrentPassword ? 'text' : 'password'}
        autoComplete="current-password"
        value={formData.currentPassword}
        onChange={handleChange}
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
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  onMouseDown={(event) => event.preventDefault()}
                  edge="end"
                >
                  {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
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
        name="newPassword"
        label="New Password"
        type={showNewPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={formData.newPassword}
        onChange={handleChange}
        disabled={loading || Boolean(success)}
        helperText="Minimum 8 characters"
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
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  onMouseDown={(event) => event.preventDefault()}
                  edge="end"
                >
                  {showNewPassword ? <VisibilityOff /> : <Visibility />}
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
        label="Confirm New Password"
        type={showNewPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={formData.confirmPassword}
        onChange={handleChange}
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
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={loading || Boolean(success)}
        sx={{ mt: 2 }}
      >
        {loading
  ? 'Changing...'
  : success
    ? 'Password Changed'
    : 'Change Password'}
      </Button>
    </Box>
  );
};

export default ChangePasswordForm;