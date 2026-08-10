// src/components/containers/EditContainerModal.tsx

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { DialogProps } from '@mui/material';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';

import type { Container } from '../../types';
import { useContainers } from '../../hooks/useContainers';

interface EditContainerModalProps {
  open: boolean;
  onClose: () => void;
  container: Container;
}

interface FormData {
  name: string;
  totalVolume: string;
  description: string;
}

export const EditContainerModal = ({
  open,
  onClose,
  container,
}: EditContainerModalProps) => {
  const { updateContainer } = useContainers();

  const [formData, setFormData] = useState<FormData>({
    name: container.name ?? '',
    totalVolume: String(container.totalVolume ?? ''),
    description: container.description ?? '',
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      name: container.name ?? '',
      totalVolume: String(container.totalVolume ?? ''),
      description: container.description ?? '',
    });

    setError(null);
  }, [open, container]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleClose = (): void => {
    if (loading) {
      return;
    }

    onClose();
  };

  const handleDialogClose: NonNullable<
    DialogProps['onClose']
  > = (_, reason): void => {
    if (
      loading ||
      reason === 'backdropClick'
    ) {
      return;
    }

    onClose();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    setError(null);

    const name = formData.name.trim();
    const description = formData.description.trim();
    const totalVolume = Number(formData.totalVolume);

    if (!name) {
      setError('Container name is required');
      return;
    }

    if (
      !Number.isFinite(totalVolume) ||
      totalVolume <= 0
    ) {
      setError('Total volume must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      await updateContainer(
        container.id,
        {
          name,
          totalVolume,
          description: description || undefined,
        },
      );

      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update container';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiInputLabel-root': {
      color: '#626267',
      fontSize: '0.86rem',
      fontWeight: 600,
    },

    '& .MuiInputLabel-root.Mui-focused': {
      color: '#202024',
    },

    '& .MuiInputLabel-root.Mui-disabled': {
      color: '#8c8c91',
    },

    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: '#ffffff',
      color: '#18181b',

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
    },

    '& .MuiInputBase-input.Mui-disabled': {
      WebkitTextFillColor: '#85858a',
    },

    '& .MuiInputBase-inputMultiline': {
      lineHeight: 1.65,
    },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(17,17,20,0.48)',
          },
        },

        paper: {
          sx: {
            width: '100%',

            mx: {
              xs: 1,
              sm: 2,
            },

            maxHeight: {
              xs: 'calc(100dvh - 20px)',
              sm: 'calc(100dvh - 48px)',
            },

            borderRadius: {
              xs: 1.5,
              sm: 2,
            },

            backgroundColor: '#ffffff',

            border: '1px solid #d2d2d6',

            boxShadow:
              '0 12px 30px rgba(0,0,0,0.14)',

            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        aria-busy={loading}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: {
              xs: 2,
              sm: 2.25,
            },

            backgroundColor: '#f5f5f6',

            borderBottom: '1px solid #dcdce0',
          }}
        >
          <Typography
            component="div"
            sx={{
              color: '#17171a',

              fontSize: {
                xs: '1.15rem',
                sm: '1.3rem',
              },

              fontWeight: 800,

              lineHeight: 1.25,

              letterSpacing: '-0.025em',
            }}
          >
            Edit Container
          </Typography>

          <Typography
            component="div"
            sx={{
              mt: 0.4,

              color: '#717176',

              fontSize: {
                xs: '0.74rem',
                sm: '0.78rem',
              },

              fontWeight: 500,

              lineHeight: 1.5,
            }}
          >
            Update container information and capacity.
          </Typography>
        </DialogTitle>

        {/* Content */}
        <DialogContent
          sx={{
            px: {
              xs: 2,
              sm: 3,
            },

            pt: {
              xs: 3,
              sm: 3.5,
            },

            pb: {
              xs: 2.5,
              sm: 3,
            },

            backgroundColor: '#ffffff',
          }}
        >
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
            {error && (
              <Alert
                severity="error"
                sx={{
                  borderRadius: 2,

                  backgroundColor: '#fff4f5',

                  color: '#9b2831',

                  border: '1px solid #efc9cc',

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

            {/* Static container information */}
            <Box
              sx={{
                p: {
                  xs: 1.5,
                  sm: 1.75,
                },

                display: 'flex',

                flexDirection: {
                  xs: 'column',
                  sm: 'row',
                },

                alignItems: {
                  xs: 'flex-start',
                  sm: 'center',
                },

                justifyContent: 'space-between',

                gap: {
                  xs: 1,
                  sm: 1.5,
                },

                borderRadius: 1.75,

                backgroundColor: '#f6f6f7',

                border: '1px solid #dedee2',

                marginTop: '5px',
              }}
            >
              <Box
                sx={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <Typography
                  sx={{
                    color: '#77777c',

                    fontSize: '0.67rem',

                    fontWeight: 700,

                    textTransform: 'uppercase',

                    letterSpacing: '0.04em',
                  }}
                >
                  Container
                </Typography>

                <Typography
                  sx={{
                    mt: 0.35,

                    color: '#202024',

                    fontSize: '0.86rem',

                    fontWeight: 800,

                    overflow: 'hidden',

                    textOverflow: 'ellipsis',

                    whiteSpace: 'nowrap',
                  }}
                >
                  {container.name}
                </Typography>
              </Box>

              <Box
                sx={{
                  flexShrink: 0,

                  px: 1.25,
                  py: 0.65,

                  borderRadius: 1.5,

                  backgroundColor: '#ffffff',

                  border: '1px solid #d5d5d9',
                }}
              >
                <Typography
                  sx={{
                    color: '#505055',

                    fontSize: '0.7rem',

                    fontWeight: 700,

                    letterSpacing: '0.02em',

                    whiteSpace: 'nowrap',
                  }}
                >
                  {container.containerCode}
                </Typography>
              </Box>
            </Box>

            {/* Form Fields */}
            <Box
              sx={{
                display: 'flex',

                flexDirection: 'column',

                gap: {
                  xs: 2.25,
                  sm: 2.5,
                },
              }}
            >
              <TextField
                name="name"
                label="Container Name"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                required
                fullWidth
                sx={inputSx}
              />

              <TextField
                name="totalVolume"
                label="Total Volume (m³)"
                type="number"
                value={formData.totalVolume}
                onChange={handleChange}
                disabled={loading}
                required
                fullWidth
                slotProps={{
                  htmlInput: {
                    min: 0.01,
                    step: 0.01,
                  },
                }}
                sx={inputSx}
              />

              <TextField
                name="description"
                label="Description"
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
                fullWidth
                multiline
                rows={4}
                sx={inputSx}
              />
            </Box>
          </Box>
        </DialogContent>

        {/* Actions */}
        <DialogActions
          sx={{
            px: {
              xs: 2,
              sm: 3,
            },

            py: {
              xs: 1.5,
              sm: 1.75,
            },

            gap: 1,

            flexDirection: {
              xs: 'column-reverse',
              sm: 'row',
            },

            borderTop: '1px solid #dcdce0',

            backgroundColor: '#f5f5f6',
          }}
        >
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            sx={{
              width: {
                xs: '100%',
                sm: 'auto',
              },

              minWidth: 100,

              minHeight: 44,

              px: 2.25,

              borderRadius: 2,

              color: '#3d3d42',

              backgroundColor: '#ffffff',

              border: '1px solid #c9c9ce',

              fontSize: '0.84rem',

              fontWeight: 700,

              textTransform: 'none',

              boxShadow: 'none',

              transition:
                'background-color 0.15s ease, border-color 0.15s ease',

              '&:hover': {
                backgroundColor: '#eeeeF0',

                borderColor: '#9f9fa5',

                color: '#202024',
              },

              '&.Mui-disabled': {
                color: '#8a8a90',

                backgroundColor: '#f0f0f2',

                borderColor: '#d7d7db',

                opacity: 1,
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
              width: {
                xs: '100%',
                sm: 'auto',
              },

              minHeight: 44,

              minWidth: 140,

              px: 2.5,

              borderRadius: 2,

              backgroundColor: '#202024',

              color: '#ffffff',

              fontSize: '0.84rem',

              fontWeight: 700,

              textTransform: 'none',

              boxShadow: 'none',

              transition:
                'background-color 0.15s ease',

              '&:hover': {
                backgroundColor: '#111114',

                color: '#ffffff',

                boxShadow: 'none',
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
              ? 'Saving...'
              : 'Save Changes'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default EditContainerModal;