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

import type { Item } from '../../types';
import { useItems } from '../../hooks/useItems';

interface EditItemModalProps {
  open: boolean;
  onClose: () => void;
  item: Item;
}

interface FormData {
  name: string;
  packageQuantity: string;
  productsPerPackage: string;
  packagePrice: string;
  volume: string;
}

export const EditItemModal = ({
  open,
  onClose,
  item,
}: EditItemModalProps) => {
  const { updateItem } = useItems();

  const [formData, setFormData] = useState<FormData>({
    name: item.name ?? '',
    packageQuantity: String(item.packageQuantity ?? ''),
    productsPerPackage: String(item.productsPerPackage ?? ''),
    packagePrice: String(item.packagePrice ?? ''),
    volume: String(item.volume ?? ''),
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      name: item.name ?? '',
      packageQuantity: String(item.packageQuantity ?? ''),
      productsPerPackage: String(item.productsPerPackage ?? ''),
      packagePrice: String(item.packagePrice ?? ''),
      volume: String(item.volume ?? ''),
    });

    setError(null);
  }, [open, item]);

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
    const packageQuantity = Number(formData.packageQuantity);
    const productsPerPackage = Number(formData.productsPerPackage);
    const packagePrice = Number(formData.packagePrice);
    const volume = Number(formData.volume);

    if (!name) {
      setError('Item name is required');
      return;
    }

    if (
      !Number.isInteger(packageQuantity) ||
      packageQuantity <= 0
    ) {
      setError('Package quantity must be greater than 0');
      return;
    }

    if (
      !Number.isInteger(productsPerPackage) ||
      productsPerPackage <= 0
    ) {
      setError('Products per package must be greater than 0');
      return;
    }

    if (
      !Number.isFinite(packagePrice) ||
      packagePrice < 0
    ) {
      setError('Package price must be 0 or greater');
      return;
    }

    if (
      !Number.isFinite(volume) ||
      volume < 0
    ) {
      setError('Volume must be 0 or greater');
      return;
    }

    setLoading(true);

    try {
      await updateItem(item.id, {
        name,
        packageQuantity,
        productsPerPackage,
        packagePrice,
        volume,
      });

      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update item';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputSx = {
    '& .MuiInputLabel-root': {
      color: '#626267',
      fontWeight: 600,
    },

    '& .MuiInputLabel-root.Mui-focused': {
      color: '#202024',
    },

    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: '#ffffff',

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
    },

    '& .MuiInputBase-input': {
      color: '#18181b',

      fontSize: {
        xs: '16px',
        sm: '0.9rem',
      },

      fontWeight: 500,
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
            mx: {
              xs: 1,
              sm: 2,
            },

            borderRadius: {
              xs: 1.5,
              sm: 2,
            },

            border: '1px solid #d2d2d6',

            backgroundColor: '#ffffff',

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
        <DialogTitle
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: 2,

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

              letterSpacing: '-0.025em',
            }}
          >
            Edit Item
          </Typography>

          <Typography
            component="div"
            sx={{
              mt: 0.4,

              color: '#717176',

              fontSize: '0.78rem',
            }}
          >
            Update item information.
          </Typography>
        </DialogTitle>

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
          }}
        >
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
            {error && (
              <Alert
                severity="error"
                sx={{
                  borderRadius: 2,

                  backgroundColor: '#fff4f5',

                  color: '#9b2831',

                  border: '1px solid #efc9cc',
                }}
              >
                {error}
              </Alert>
            )}

            <Box
              sx={{
                p: 1.5,

                borderRadius: 1.75,

                backgroundColor: '#f6f6f7',

                border: '1px solid #dedee2',
              }}
            >
              <Typography
                sx={{
                  color: '#77777c',

                  fontSize: '0.67rem',

                  fontWeight: 700,

                  textTransform: 'uppercase',
                }}
              >
                Item Code
              </Typography>

              <Typography
                sx={{
                  mt: 0.3,

                  color: '#202024',

                  fontSize: '0.86rem',

                  fontWeight: 800,
                }}
              >
                {item.uniqueNumber}
              </Typography>
            </Box>

            <TextField
              name="name"
              label="Item Name"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
              fullWidth
              sx={inputSx}
            />

            <TextField
              name="packageQuantity"
              label="Package Quantity"
              type="number"
              value={formData.packageQuantity}
              onChange={handleChange}
              disabled={loading}
              required
              fullWidth
              sx={inputSx}
            />

            <TextField
              name="productsPerPackage"
              label="Products Per Package"
              type="number"
              value={formData.productsPerPackage}
              onChange={handleChange}
              disabled={loading}
              required
              fullWidth
              sx={inputSx}
            />

            <TextField
              name="packagePrice"
              label="Price Per Package"
              type="number"
              value={formData.packagePrice}
              onChange={handleChange}
              disabled={loading}
              required
              fullWidth
              sx={inputSx}
            />

            <TextField
              name="volume"
              label="Volume Per Package (m³)"
              type="number"
              value={formData.volume}
              onChange={handleChange}
              disabled={loading}
              required
              fullWidth
              sx={inputSx}
            />
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: {
              xs: 2,
              sm: 3,
            },

            py: 1.5,

            gap: 1,

            borderTop: '1px solid #dcdce0',

            backgroundColor: '#f5f5f6',
          }}
        >
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            sx={{
              color: '#3d3d42',

              backgroundColor: '#ffffff',

              border: '1px solid #c9c9ce',

              borderRadius: 2,

              fontWeight: 700,

              textTransform: 'none',
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: '#202024',

              color: '#ffffff',

              borderRadius: 2,

              fontWeight: 700,

              textTransform: 'none',

              boxShadow: 'none',

              '&:hover': {
                backgroundColor: '#111114',
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

export default EditItemModal;