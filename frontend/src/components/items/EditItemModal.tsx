import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { DialogProps } from '@mui/material';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';

import type { Item } from '../../types';
import { useItems } from '../../hooks/useItems';
import { filesService } from '../../services/file.service';

interface EditItemModalProps {
  open: boolean;
  onClose: () => void;
  item: Item;
}

interface FormData {
  name: string;
  photo: string | null;
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
    photo: item.photo ?? null,
    packageQuantity: String(item.packageQuantity ?? ''),
    productsPerPackage: String(item.productsPerPackage ?? ''),
    packagePrice: String(item.packagePrice ?? ''),
    volume: String(item.volume ?? ''),
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  /**
   * Path of a newly uploaded file that is not yet committed to the item.
   * If the user cancels, we delete only this temporary upload.
   */
  const [uploadedFilePath, setUploadedFilePath] =
    useState<string | null>(null);

  /**
   * Temporary presigned URL used only for displaying the image.
   * Never store this value in the database.
   */
  const [photoPreviewUrl, setPhotoPreviewUrl] =
    useState<string | null>(null);

  /**
   * Tracks whether the photo field must be included in updateItem().
   * false -> leave existing photo unchanged
   * true  -> send either the new S3 object key or null
   */
  const [photoChanged, setPhotoChanged] = useState(false);

  const isBusy = loading || uploadLoading;

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      name: item.name ?? '',
      photo: item.photo ?? null,
      packageQuantity: String(item.packageQuantity ?? ''),
      productsPerPackage: String(item.productsPerPackage ?? ''),
      packagePrice: String(item.packagePrice ?? ''),
      volume: String(item.volume ?? ''),
    });

    const itemWithPhotoUrl = item as Item & {
      photoUrl?: string | null;
    };

    setPhotoPreviewUrl(
      itemWithPhotoUrl.photoUrl ?? null,
    );

    setUploadedFilePath(null);
    setPhotoChanged(false);
    setError(null);
  }, [open, item]);

  const cleanupUploadedFile = async (): Promise<void> => {
    if (!uploadedFilePath) {
      return;
    }

    try {
      await filesService.delete(uploadedFilePath);
      setUploadedFilePath(null);
    } catch (cleanupError: unknown) {
      console.error(
        'Failed to remove temporary uploaded file:',
        cleanupError,
      );
    }
  };

  const handlePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const selectedFile = event.target.files?.[0];

    // Allow selecting the same file again later.
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    setUploadLoading(true);
    setError(null);

    try {
      // If the user already uploaded a replacement in this edit session,
      // remove that temporary object before uploading another one.
      if (uploadedFilePath) {
        await cleanupUploadedFile();
      }

      const uploaded =
        await filesService.upload(selectedFile);

      setUploadedFilePath(uploaded.path);

      // Permanent value that will be stored in the database.
      setFormData((current) => ({
        ...current,
        photo: uploaded.path,
      }));

      // Temporary presigned URL used only for preview.
      setPhotoPreviewUrl(uploaded.url);

      setPhotoChanged(true);
    } catch (uploadError: unknown) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to upload photo';

      setError(message);
    } finally {
      setUploadLoading(false);
    }
  };

  const removePhoto = async (): Promise<void> => {
    if (isBusy) {
      return;
    }

    /**
     * If this is a newly uploaded replacement that has not been saved yet,
     * remove that temporary object immediately.
     *
     * We do NOT delete the original photo here. The backend ItemsService
     * deletes the old photo only after a successful DB transaction.
     */
    if (uploadedFilePath) {
      await cleanupUploadedFile();
    }

    setFormData((current) => ({
      ...current,
      photo: null,
    }));

    setPhotoPreviewUrl(null);
    setPhotoChanged(true);
  };

  const closeWithCleanup = async (): Promise<void> => {
    if (uploadedFilePath) {
      await cleanupUploadedFile();
    }

    onClose();
  };

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
    if (isBusy) {
      return;
    }

    void closeWithCleanup();
  };

  const handleDialogClose: NonNullable<
    DialogProps['onClose']
  > = (_, reason): void => {
    if (
      isBusy ||
      reason === 'backdropClick'
    ) {
      return;
    }

    void closeWithCleanup();
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

        /**
         * Only send photo when the user actually changed it.
         * If photoChanged is true:
         * - string => new permanent S3 object key
         * - null   => remove existing photo
         */
        ...(photoChanged
          ? { photo: formData.photo }
          : {}),
      });

      /**
       * The new upload now belongs to the item.
       * Prevent cancel-cleanup from deleting it.
       */
      setUploadedFilePath(null);

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
        aria-busy={isBusy}
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

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.75,
                backgroundColor: '#f8f8f9',
                border: '1px solid #dedee2',
              }}
            >
              <Typography
                sx={{
                  mb: 1,
                  color: '#77777c',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Item Photo
              </Typography>

              {photoPreviewUrl && (
                <Box
                  component="img"
                  src={photoPreviewUrl}
                  alt={`Preview of ${formData.name || item.uniqueNumber}`}
                  sx={{
                    display: 'block',
                    width: '100%',
                    maxHeight: 260,
                    mb: 1.25,
                    objectFit: 'contain',
                    borderRadius: 1.5,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0e3',
                  }}
                />
              )}

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: {
                    xs: 'column',
                    sm: 'row',
                  },
                  gap: 1,
                }}
              >
                <Button
                  component="label"
                  variant="outlined"
                  disabled={isBusy}
                  sx={{
                    flex: 1,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                  }}
                >
                  {uploadLoading ? (
                    <>
                      <CircularProgress
                        size={18}
                        color="inherit"
                        sx={{ mr: 1 }}
                      />
                      Uploading...
                    </>
                  ) : photoPreviewUrl ? (
                    'Change Photo'
                  ) : (
                    'Upload Photo'
                  )}

                  <input
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      void handlePhotoChange(event);
                    }}
                    disabled={isBusy}
                  />
                </Button>

                {photoPreviewUrl && (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      void removePhoto();
                    }}
                    disabled={isBusy}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 700,
                    }}
                  >
                    Remove Photo
                  </Button>
                )}
              </Box>
            </Box>

            <TextField
              name="name"
              label="Item Name"
              value={formData.name}
              onChange={handleChange}
              disabled={isBusy}
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
              disabled={isBusy}
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
              disabled={isBusy}
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
              disabled={isBusy}
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
              disabled={isBusy}
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
            disabled={isBusy}
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
            disabled={isBusy}
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