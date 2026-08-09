// src/pages/CreateContainerPage.tsx

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';

import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

import { toast } from 'react-toastify';

import { useContainers } from '../hooks/useContainers';

import { ConfirmDialog } from '../components/common/Modals/ConfirmDialog';

export const CreateContainerPage = () => {
  const navigate = useNavigate();
  const { createContainer } = useContainers();

  const [formData, setFormData] = useState({
    customName: '',
    totalVolume: '',
    description: '',
  });

  const [errors, setErrors] = useState<{
    customName?: string;
    totalVolume?: string;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelDestination, setCancelDestination] = useState('/containers');

  const hasChanges =
    Boolean(formData.customName.trim()) ||
    Boolean(formData.totalVolume.trim()) ||
    Boolean(formData.description.trim());

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ): void => {
    const { name, value } = event.target;

    setFormData((prev) => ({
        ...prev,
        [name]: value,
    }));

    if (errors[name as keyof typeof errors]) {
        setErrors((prev) => ({
        ...prev,
        [name]: undefined,
        }));
    }
    };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    const name = formData.customName.trim();

    if (!name) {
      newErrors.customName = 'Container name is required';
    } else if (name.length < 2) {
      newErrors.customName =
        'Container name must be at least 2 characters';
    } else if (name.length > 100) {
      newErrors.customName =
        'Container name must be less than 100 characters';
    }

    const volume = Number(formData.totalVolume);

    if (!formData.totalVolume) {
      newErrors.totalVolume = 'Total volume is required';
    } else if (!Number.isFinite(volume) || volume <= 0) {
      newErrors.totalVolume =
        'Total volume must be a positive number';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (
    event: FormEvent,
  ): Promise<void> => {
    event.preventDefault();

    if (!validate()) {
      toast.warning('Please fix the errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      const container = await createContainer({
        customName: formData.customName.trim(),
        totalVolume: Number(formData.totalVolume),
        description: formData.description.trim() || undefined,
      });

      toast.success(
        `Container "${container.name}" created successfully!`,
      );

      navigate(`/containers/${container.id}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create container';

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const requestNavigation = (
    destination: string,
  ): void => {
    if (hasChanges) {
      setCancelDestination(destination);
      setCancelDialogOpen(true);
      return;
    }

    navigate(destination);
  };

  const handleConfirmCancel = (): void => {
    setCancelDialogOpen(false);
    navigate(cancelDestination);
  };

  const handleCancelDialogClose = (): void => {
    setCancelDialogOpen(false);
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 900,
        mx: 'auto',

        px: {
          xs: 0,
          sm: 0.5,
          md: 1,
        },

        pb: {
          xs: 3,
          sm: 4,
        },
      }}
    >
      {/* Breadcrumbs */}
      <Breadcrumbs
        sx={{
          mb: {
            xs: 2,
            sm: 2.5,
          },

          color: '#76767b',

          '& .MuiBreadcrumbs-separator': {
            color: '#b1b1b5',
          },
        }}
      >
        <Link
          component="button"
          variant="body2"
          onClick={() => requestNavigation('/dashboard')}
          sx={{
            color: '#68686d',
            fontWeight: 600,
            textDecoration: 'none',

            '&:hover': {
              color: '#202024',
              textDecoration: 'none',
            },
          }}
        >
          Dashboard
        </Link>

        <Link
          component="button"
          variant="body2"
          onClick={() => requestNavigation('/containers')}
          sx={{
            color: '#68686d',
            fontWeight: 600,
            textDecoration: 'none',

            '&:hover': {
              color: '#202024',
              textDecoration: 'none',
            },
          }}
        >
          Containers
        </Link>

        <Typography
          variant="body2"
          sx={{
            color: '#202024',
            fontWeight: 700,
          }}
        >
          Create Container
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          alignItems: {
            xs: 'flex-start',
            sm: 'center',
          },

          gap: {
            xs: 1.5,
            sm: 2,
          },

          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => requestNavigation('/containers')}
          disabled={submitting}
          sx={{
            minHeight: 42,

            px: 1.5,

            borderRadius: 2,

            color: '#343438',

            backgroundColor: '#ffffff',

            border: '1px solid #d1d1d5',

            fontSize: '0.84rem',

            fontWeight: 700,

            textTransform: 'none',

            '&:hover': {
              color: '#18181b',

              backgroundColor: '#f2f2f4',

              borderColor: '#b5b5ba',
            },

            '&.Mui-disabled': {
              color: '#747479',

              backgroundColor: '#eeeeF0',

              borderColor: '#ceced2',

              opacity: 1,
            },
          }}
        >
          Back
        </Button>

        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              color: '#17171a',

              fontSize: {
                xs: '1.5rem',
                sm: '1.75rem',
                md: '1.95rem',
              },

              fontWeight: 800,

              lineHeight: 1.2,

              letterSpacing: '-0.03em',
            }}
          >
            Create New Container
          </Typography>
        </Box>
      </Box>

      {/* Main Form Card */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',

          p: {
            xs: 2.25,
            sm: 3,
            md: 4,
          },

          borderRadius: {
            xs: 2.5,
            sm: 3,
          },

          backgroundColor: '#ffffff',

          border: '1px solid #d7d7db',

          boxShadow:
            '0 7px 24px rgba(0,0,0,0.065)',
        }}
      >
        <form onSubmit={handleSubmit}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',

              gap: {
                xs: 2.5,
                sm: 3,
              },
            }}
          >
            <TextField
              name="customName"
              label="Container Name"
              value={formData.customName}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., Alpha Container, Main Storage, etc."
              error={!!errors.customName}
              helperText={
                errors.customName ||
                'Choose a unique name for your container'
              }
              disabled={submitting}
              sx={{
                '& .MuiInputLabel-root': {
                  color: '#5f5f64',
                  fontWeight: 600,
                },

                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#202024',
                },

                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.25,

                  backgroundColor: '#ffffff',

                  color: '#202024',

                  '& fieldset': {
                    borderColor: '#cdCDD2',
                  },

                  '&:hover fieldset': {
                    borderColor: '#9f9fa5',
                  },

                  '&.Mui-focused fieldset': {
                    borderColor: '#202024',
                    borderWidth: 1.5,
                  },

                  '&.Mui-disabled': {
                    backgroundColor: '#f3f3f5',
                  },
                },

                '& .MuiInputBase-input': {
                  color: '#202024',
                  WebkitTextFillColor: '#202024',

                  fontSize: {
                    xs: '16px',
                    sm: '0.92rem',
                  },

                  '&::placeholder': {
                    color: '#929297',
                    opacity: 1,
                  },
                },

                '& .MuiFormHelperText-root': {
                  color: errors.customName
                    ? undefined
                    : '#707075',

                  fontSize: '0.75rem',
                },
              }}
            />

            <TextField
              name="totalVolume"
              label="Total Volume (m³)"
              type="number"
              value={formData.totalVolume}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., 1000"
              error={!!errors.totalVolume}
              helperText={
                errors.totalVolume ||
                'Enter the total capacity of the container'
              }
              slotProps={{
                htmlInput: {
                  min: 0.01,
                  step: 0.01,
                },
              }}
              disabled={submitting}
              sx={{
                '& .MuiInputLabel-root': {
                  color: '#5f5f64',
                  fontWeight: 600,
                },

                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#202024',
                },

                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.25,

                  backgroundColor: '#ffffff',

                  color: '#202024',

                  '& fieldset': {
                    borderColor: '#cdCDD2',
                  },

                  '&:hover fieldset': {
                    borderColor: '#9f9fa5',
                  },

                  '&.Mui-focused fieldset': {
                    borderColor: '#202024',
                    borderWidth: 1.5,
                  },

                  '&.Mui-disabled': {
                    backgroundColor: '#f3f3f5',
                  },
                },

                '& .MuiInputBase-input': {
                  color: '#202024',
                  WebkitTextFillColor: '#202024',

                  fontSize: {
                    xs: '16px',
                    sm: '0.92rem',
                  },

                  '&::placeholder': {
                    color: '#929297',
                    opacity: 1,
                  },
                },

                '& .MuiFormHelperText-root': {
                  color: errors.totalVolume
                    ? undefined
                    : '#707075',

                  fontSize: '0.75rem',
                },
              }}
            />

            <TextField
              name="description"
              label="Description (Optional)"
              value={formData.description}
              onChange={handleChange}
              fullWidth
              multiline
              rows={4}
              placeholder="Describe the purpose of this container..."
              disabled={submitting}
              sx={{
                '& .MuiInputLabel-root': {
                  color: '#5f5f64',
                  fontWeight: 600,
                },

                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#202024',
                },

                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.25,

                  backgroundColor: '#ffffff',

                  color: '#202024',

                  '& fieldset': {
                    borderColor: '#cdCDD2',
                  },

                  '&:hover fieldset': {
                    borderColor: '#9f9fa5',
                  },

                  '&.Mui-focused fieldset': {
                    borderColor: '#202024',
                    borderWidth: 1.5,
                  },

                  '&.Mui-disabled': {
                    backgroundColor: '#f3f3f5',
                  },
                },

                '& textarea': {
                  color: '#202024',
                  WebkitTextFillColor: '#202024',

                  fontSize: {
                    xs: '16px',
                    sm: '0.92rem',
                  },

                  '&::placeholder': {
                    color: '#929297',
                    opacity: 1,
                  },
                },
              }}
            />

            {/* Container Code Info */}
            <Paper
              variant="outlined"
              sx={{
                p: {
                  xs: 1.75,
                  sm: 2,
                },

                borderRadius: 2.25,

                backgroundColor: '#eeeeF0',

                borderColor: '#cdCDD2',

                boxShadow: 'none',
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{
                  color: '#343438',

                  fontWeight: 800,

                  fontSize: '0.77rem',

                  textTransform: 'uppercase',

                  letterSpacing: '0.04em',
                }}
              >
                Container Code
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: '#55555a',

                  fontSize: {
                    xs: '0.8rem',
                    sm: '0.84rem',
                  },

                  fontWeight: 500,

                  lineHeight: 1.55,
                }}
              >
                The container code will be generated automatically.
              </Typography>
            </Paper>

            {/* Actions */}
            <Box
              sx={{
                display: 'flex',

                flexDirection: {
                  xs: 'column-reverse',
                  sm: 'row',
                },

                gap: {
                  xs: 1,
                  sm: 1.25,
                },

                justifyContent: 'flex-end',

                mt: {
                  xs: 0.5,
                  sm: 1,
                },

                pt: {
                  xs: 2,
                  sm: 2.5,
                },

                borderTop: '1px solid #e4e4e7',
              }}
            >
              <Button
                variant="outlined"
                onClick={() =>
                  requestNavigation('/containers')
                }
                disabled={submitting}
                startIcon={<CancelIcon />}
                sx={{
                  minHeight: 46,

                  px: 2.25,

                  borderRadius: 2,

                  color: '#3d3d42',

                  borderColor: '#c6c6cb',

                  backgroundColor: '#ffffff',

                  fontSize: '0.84rem',

                  fontWeight: 700,

                  textTransform: 'none',

                  '&:hover': {
                    color: '#202024',

                    borderColor: '#a3a3a8',

                    backgroundColor: '#f2f2f4',
                  },

                  '&.Mui-disabled': {
                    color: '#77777c',

                    borderColor: '#ceced2',

                    backgroundColor: '#eeeeF0',

                    opacity: 1,
                  },
                }}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={<SaveIcon />}
                sx={{
                  minWidth: 150,

                  minHeight: 46,

                  px: 2.5,

                  borderRadius: 2,

                  backgroundColor: '#202024',

                  color: '#ffffff',

                  fontSize: '0.84rem',

                  fontWeight: 700,

                  textTransform: 'none',

                  boxShadow: 'none',

                  '&:hover': {
                    backgroundColor: '#111114',

                    color: '#ffffff',

                    boxShadow:
                      '0 5px 14px rgba(0,0,0,0.12)',
                  },

                  '&.Mui-disabled': {
                    backgroundColor: '#505055',

                    color: '#f2f2f3',

                    opacity: 1,

                    boxShadow: 'none',
                  },
                }}
              >
                {submitting
                  ? 'Creating...'
                  : 'Create Container'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>

      <ConfirmDialog
        open={cancelDialogOpen}
        title="Cancel Container Creation"
        message="Are you sure you want to cancel? Your changes will be lost."
        confirmLabel="Yes, Cancel"
        cancelLabel="Continue Editing"
        onConfirm={handleConfirmCancel}
        onCancel={handleCancelDialogClose}
        confirmColor="warning"
      />
    </Box>
  );
};

export default CreateContainerPage;