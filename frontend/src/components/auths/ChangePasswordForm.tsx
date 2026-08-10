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

import {
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export const ChangePasswordForm = ({
  onSuccess,
}: ChangePasswordFormProps) => {
  const { changePassword } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] = useState<string | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const successTimerRef =
    useRef<number | null>(null);

  // Pastro timer-in kur komponenti çmontohet
  useEffect(() => {
    return () => {
      if (
        successTimerRef.current !== null
      ) {
        window.clearTimeout(
          successTimerRef.current,
        );

        successTimerRef.current = null;
      }
    };
  }, []);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const {
      name,
      value,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent,
  ): Promise<void> => {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    // Pastro timer-in e vjetër nëse ekziston
    if (
      successTimerRef.current !== null
    ) {
      window.clearTimeout(
        successTimerRef.current,
      );

      successTimerRef.current = null;
    }

    // Validime
    if (!formData.currentPassword) {
      setError(
        'Current password is required',
      );

      return;
    }

    if (
      formData.newPassword !==
      formData.confirmPassword
    ) {
      setError(
        'Passwords do not match',
      );

      return;
    }

    if (
      formData.newPassword.length < 8
    ) {
      setError(
        'Password must be at least 8 characters',
      );

      return;
    }

    if (
      formData.currentPassword ===
      formData.newPassword
    ) {
      setError(
        'New password must be different from the current password',
      );

      return;
    }

    setLoading(true);

    try {
      await changePassword({
        currentPassword:
          formData.currentPassword,

        newPassword:
          formData.newPassword,
      });

      setSuccess(
        'Password changed successfully!',
      );

      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Vonesë e shkurtër për të lejuar që mesazhi i suksesit të shfaqet përpara se të mbyllet
      if (onSuccess) {
        successTimerRef.current =
          window.setTimeout(() => {
            onSuccess();

            successTimerRef.current =
              null;
          }, 1500);
      }
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error)
      ) {
        const message =
          error.response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message ===
                'string'
              ? message
              : 'Failed to change password',
        );
      } else {
        setError(
          'Failed to change password',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiInputLabel-root': {
      color: '#66666b',

      fontWeight: 600,

      fontSize: '0.88rem',
    },

    '& .MuiInputLabel-root.Mui-focused': {
      color: '#202024',
    },

    '& .MuiInputLabel-root.Mui-disabled': {
      color: '#8b8b91',
    },

    '& .MuiOutlinedInput-root': {
      minHeight: 52,

      borderRadius: 2.25,

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
          '0 0 0 3px rgba(32,32,36,0.055)',
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

    '& .MuiInputBase-input.Mui-disabled': {
      WebkitTextFillColor: '#85858a',
    },

    '& .MuiFormHelperText-root': {
      mx: 0.25,

      mt: 0.65,

      color: '#78787d',

      fontSize: '0.72rem',

      fontWeight: 500,
    },

    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
      color: '#6c6c71',

      fontSize: 20,
    },
  } as const;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-busy={loading}
      sx={{
        width: '100%',

        display: 'flex',

        flexDirection: 'column',

        gap: 0.5,
      }}
    >
      {error && (
        <Alert
          severity="error"
          role="alert"
          sx={{
            mb: 1.5,

            borderRadius: 2,

            backgroundColor: '#fff4f5',

            color: '#9b2831',

            border:
              '1px solid #efc9cc',

            fontSize: '0.8rem',

            fontWeight: 600,

            '& .MuiAlert-icon': {
              color: '#c9363f',
            },
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
            mb: 1.5,

            borderRadius: 2,

            backgroundColor: '#f1f8f3',

            color: '#2d6b3d',

            border:
              '1px solid #cfe4d4',

            fontSize: '0.8rem',

            fontWeight: 600,

            '& .MuiAlert-icon': {
              color: '#3e8a54',
            },
          }}
        >
          {success}
        </Alert>
      )}

      {/* Current Password */}
      <TextField
        margin="normal"
        required
        fullWidth
        autoFocus
        name="currentPassword"
        label="Current Password"
        type={
          showCurrentPassword
            ? 'text'
            : 'password'
        }
        autoComplete="current-password"
        value={
          formData.currentPassword
        }
        onChange={handleChange}
        disabled={
          loading ||
          Boolean(success)
        }
        sx={inputSx}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock />
              </InputAdornment>
            ),

            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  aria-label={
                    showCurrentPassword
                      ? 'Hide current password'
                      : 'Show current password'
                  }
                  onClick={() =>
                    setShowCurrentPassword(
                      (prev) => !prev,
                    )
                  }
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  edge="end"
                  sx={{
                    width: 36,
                    height: 36,

                    borderRadius: 1.75,

                    color: '#69696e',

                    transition:
                      'background-color 0.18s ease, color 0.18s ease',

                    '&:hover': {
                      color: '#202024',

                      backgroundColor:
                        '#eeeeF0',
                    },

                    '&.Mui-disabled': {
                      color: '#99999e',
                    },
                  }}
                >
                  {showCurrentPassword ? (
                    <VisibilityOff
                      sx={{
                        fontSize: 19,
                      }}
                    />
                  ) : (
                    <Visibility
                      sx={{
                        fontSize: 19,
                      }}
                    />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      {/* New Password */}
      <TextField
        margin="normal"
        required
        fullWidth
        name="newPassword"
        label="New Password"
        type={
          showNewPassword
            ? 'text'
            : 'password'
        }
        autoComplete="new-password"
        value={formData.newPassword}
        onChange={handleChange}
        disabled={
          loading ||
          Boolean(success)
        }
        helperText="Minimum 8 characters"
        sx={inputSx}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock />
              </InputAdornment>
            ),

            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  aria-label={
                    showNewPassword
                      ? 'Hide new password'
                      : 'Show new password'
                  }
                  onClick={() =>
                    setShowNewPassword(
                      (prev) => !prev,
                    )
                  }
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  edge="end"
                  sx={{
                    width: 36,
                    height: 36,

                    borderRadius: 1.75,

                    color: '#69696e',

                    '&:hover': {
                      color: '#202024',

                      backgroundColor:
                        '#eeeeF0',
                    },

                    '&.Mui-disabled': {
                      color: '#99999e',
                    },
                  }}
                >
                  {showNewPassword ? (
                    <VisibilityOff
                      sx={{
                        fontSize: 19,
                      }}
                    />
                  ) : (
                    <Visibility
                      sx={{
                        fontSize: 19,
                      }}
                    />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Confirm Password */}
      <TextField
        margin="normal"
        required
        fullWidth
        name="confirmPassword"
        label="Confirm New Password"
        type={
          showNewPassword
            ? 'text'
            : 'password'
        }
        autoComplete="new-password"
        value={
          formData.confirmPassword
        }
        onChange={handleChange}
        disabled={
          loading ||
          Boolean(success)
        }
        sx={inputSx}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Lock />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Submit */}
      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={
          loading ||
          Boolean(success)
        }
        sx={{
          mt: 2,

          minHeight: 48,

          borderRadius: 2.25,

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

            transform:
              'translateY(-1px)',

            boxShadow:
              '0 6px 16px rgba(0,0,0,0.12)',
          },

          '&:active': {
            transform:
              'translateY(0)',
          },

          '&.Mui-disabled': {
            backgroundColor: '#505055',

            color: '#eeeeF0',

            opacity: 1,

            boxShadow: 'none',
          },
        }}
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