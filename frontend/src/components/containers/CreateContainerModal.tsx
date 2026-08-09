// src/components/containers/CreateContainerModal.tsx

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { DialogProps } from '@mui/material';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
} from '@mui/material';

import { useContainers } from '../../hooks/useContainers';

interface CreateContainerModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  customName: string;
  totalVolume: string;
  description: string;
}

const initialFormData: FormData = {
  customName: '',
  totalVolume: '',
  description: '',
};

export const CreateContainerModal = ({
  open,
  onClose,
}: CreateContainerModalProps) => {
  const [formData, setFormData] =
    useState(initialFormData);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const { createContainer } =
    useContainers();

  const resetForm = (): void => {
    setFormData(initialFormData);
    setError(null);
  };

  const closeModal = (): void => {
    resetForm();
    onClose();
  };

  const handleClose = (): void => {
    if (loading) return;

    closeModal();
  };

  const handleDialogClose: NonNullable<
    DialogProps['onClose']
  > = (
    _,
    reason,
  ): void => {
    if (
      loading ||
      reason === 'backdropClick'
    ) {
      return;
    }

    closeModal();
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const { name, value } =
      event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent,
  ): Promise<void> => {
    event.preventDefault();

    setError(null);

    const customName =
      formData.customName.trim();

    const totalVolume =
      Number(formData.totalVolume);

    const description =
      formData.description.trim();

    if (!customName) {
      setError(
        'Container name is required',
      );

      return;
    }

    if (
      !Number.isFinite(totalVolume) ||
      totalVolume <= 0
    ) {
      setError(
        'Total volume must be greater than 0',
      );

      return;
    }

    setLoading(true);

    try {
      await createContainer({
        customName,
        totalVolume,
        description:
          description || undefined,
      });

      closeModal();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create container';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiInputLabel-root': {
      color: '#55555a',
      fontWeight: 600,
    },

    '& .MuiInputLabel-root.Mui-focused': {
      color: '#18181b',
    },

    '& .MuiInputLabel-root.Mui-disabled': {
      color: '#8d8d92',
    },

    '& .MuiOutlinedInput-root': {
      borderRadius: 2,

      backgroundColor: '#ffffff',

      color: '#18181b',

      '& fieldset': {
        borderColor: '#c8c8cd',
      },

      '&:hover fieldset': {
        borderColor: '#98989e',
      },

      '&.Mui-focused fieldset': {
        borderColor: '#18181b',
        borderWidth: 1.5,
      },

      '&.Mui-disabled': {
        backgroundColor: '#f3f3f4',
      },
    },

    '& .MuiOutlinedInput-input': {
      color: '#18181b',
      WebkitTextFillColor: '#18181b',
    },

    '& .MuiOutlinedInput-input.Mui-disabled': {
      color: '#85858a',
      WebkitTextFillColor: '#85858a',
    },

    '& textarea': {
      color: '#18181b',
      WebkitTextFillColor: '#18181b',
    },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-container-dialog-title"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor:
              'rgba(17,17,20,0.52)',
          },
        },

        paper: {
          sx: {
            mx: {
              xs: 1.25,
              sm: 2.5,
            },

            width: '100%',
            maxWidth: 560,

            borderRadius: {
              xs: 2,
              sm: 2.5,
            },

            backgroundColor: '#ffffff',

            border:
              '1px solid #cfcfd4',

            boxShadow:
              '0 14px 32px rgba(0,0,0,0.16)',

            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <Box
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            pt: {
              xs: 2.25,
              sm: 2.75,
            },

            pb: 1.5,

            backgroundColor: '#f3f3f5',

            borderBottom:
              '1px solid #d5d5d9',
          }}
        >
          <DialogTitle
            id="create-container-dialog-title"
            sx={{
              p: 0,

              color: '#111114',

              fontSize: {
                xs: '1.2rem',
                sm: '1.4rem',
              },

              fontWeight: 800,

              lineHeight: 1.25,

              letterSpacing:
                '-0.025em',
            }}
          >
            Create New Container
          </DialogTitle>

          <Typography
            sx={{
              mt: 0.6,

              color: '#4a4a4f',

              fontSize: {
                xs: '0.8rem',
                sm: '0.85rem',
              },

              fontWeight: 500,

              lineHeight: 1.5,
            }}
          >
            Add the basic information for your new container.
          </Typography>
        </Box>

        {/* Content */}
        <DialogContent
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: {
              xs: 2.25,
              sm: 2.5,
            },

            backgroundColor: '#ffffff',
          }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,

                borderRadius: 2,

                color: '#8b1f27',

                backgroundColor:
                  '#fff2f3',

                border:
                  '1px solid #efc9cc',

                boxShadow: 'none',
              }}
            >
              {error}
            </Alert>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <TextField
              name="customName"
              label="Container Name"
              fullWidth
              required
              value={formData.customName}
              onChange={handleChange}
              disabled={loading}
              sx={{
                ...inputSx,

                '& .MuiOutlinedInput-root': {
                  ...inputSx[
                    '& .MuiOutlinedInput-root'
                  ],

                  minHeight: 52,
                },
              }}
            />

            <TextField
              name="totalVolume"
              label="Total Volume (m³)"
              type="number"
              fullWidth
              required
              value={formData.totalVolume}
              onChange={handleChange}
              disabled={loading}
              slotProps={{
                htmlInput: {
                  min: 0.01,
                  step: 0.01,
                },
              }}
              sx={{
                ...inputSx,

                '& .MuiOutlinedInput-root': {
                  ...inputSx[
                    '& .MuiOutlinedInput-root'
                  ],

                  minHeight: 52,
                },
              }}
            />

            <TextField
              name="description"
              label="Description"
              fullWidth
              multiline
              minRows={3}
              value={formData.description}
              onChange={handleChange}
              disabled={loading}
              sx={inputSx}
            />

            <Box
              sx={{
                px: 1.5,
                py: 1.25,

                borderRadius: 2,

                backgroundColor: '#e9e9ec',

                border:
                  '1px solid #cfcfd4',
              }}
            >
              <Typography
                sx={{
                  color: '#3f3f44',

                  fontSize: {
                    xs: '0.76rem',
                    sm: '0.8rem',
                  },

                  fontWeight: 600,

                  lineHeight: 1.5,
                }}
              >
                Container code will be generated automatically.
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        {/* Actions */}
        <DialogActions
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: {
              xs: 1.5,
              sm: 1.75,
            },

            borderTop:
              '1px solid #d5d5d9',

            backgroundColor: '#f3f3f5',

            gap: 1,

            justifyContent: 'flex-end',

            flexWrap: {
              xs: 'wrap',
              sm: 'nowrap',
            },
          }}
        >
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            variant="outlined"
            sx={{
              minWidth: 100,
              minHeight: 44,

              px: 2.25,

              borderRadius: 2,

              borderColor: '#bfc0c5',

              color: '#303034',

              backgroundColor: '#ffffff',

              fontSize: '0.86rem',

              fontWeight: 700,

              boxShadow: 'none',

              '&:hover': {
                borderColor: '#96969c',

                color: '#18181b',

                backgroundColor:
                  '#ededf0',

                boxShadow: 'none',
              },

              '&.Mui-disabled': {
                color: '#96969b',

                borderColor: '#d6d6d9',

                backgroundColor:
                  '#f4f4f5',
              },
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              minWidth: 130,
              minHeight: 44,

              px: 2.5,

              borderRadius: 2,

              backgroundColor: '#202024',

              color: '#ffffff',

              fontSize: '0.86rem',

              fontWeight: 700,

              boxShadow: 'none',

              '&:hover': {
                backgroundColor: '#111114',

                color: '#ffffff',

                boxShadow: 'none',
              },

              '&.Mui-disabled': {
                backgroundColor:
                  '#5d5d62',

                color: '#e7e7e9',
              },
            }}
          >
            {loading
              ? 'Creating...'
              : 'Create Container'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default CreateContainerModal;