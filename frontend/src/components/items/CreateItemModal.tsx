// src/components/items/CreateItemModal.tsx

import { useState, useRef, useEffect } from 'react';
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
  IconButton,
  CircularProgress,
} from '@mui/material';

import {
  CameraAlt as CameraIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import { useItems } from '../../hooks/useItems';
import { filesService } from '../../services/file.service';

interface CreateItemModalProps {
  open: boolean;
  onClose: () => void;
  containerId: string;
  onItemCreated?: () => void;
}

interface FormData {
  uniqueNumber: string;
  name: string;
  photo: string;
  packageQuantity: string;
  productsPerPackage: string;
  packagePrice: string;
  volume: string;
}

const initialFormData: FormData = {
  uniqueNumber: '',
  name: '',
  photo: '',
  packageQuantity: '',
  productsPerPackage: '',
  packagePrice: '',
  volume: '',
};

export const CreateItemModal = ({
  open,
  onClose,
  containerId,
  onItemCreated,
}: CreateItemModalProps) => {
  const { createItem } = useItems();

  const [formData, setFormData] =
    useState<FormData>(initialFormData);

  const [file, setFile] =
    useState<File | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [uploadLoading, setUploadLoading] =
    useState(false);

  const [uploadedFilePath, setUploadedFilePath] =
    useState<string | null>(null);

  // Kamera
  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [cameraStream, setCameraStream] =
    useState<MediaStream | null>(null);

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const isBusy =
    loading || uploadLoading;

  // Sinkronizo cameraStream me video element
  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      !cameraStream ||
      !cameraOpen
    ) {
      return;
    }

    video.srcObject = cameraStream;

    return () => {
      video.srcObject = null;
    };
  }, [cameraStream, cameraOpen]);

  // Pastro stream-in kur komponenti çmontohet
  useEffect(() => {
    return () => {
      cameraStream
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });
    };
  }, [cameraStream]);

  const resetForm = (): void => {
    setFormData(initialFormData);
    setFile(null);
    setError(null);
  };

  const cleanupUploadedFile =
    async (): Promise<void> => {
      if (!uploadedFilePath) return;

      try {
        await filesService.delete(
          uploadedFilePath,
        );

        setUploadedFilePath(null);
      } catch {
        // Nëse cleanup dështon, mos e humb referencën e file-it orphan.
        // UploadedFilePath mbetet i njëjtë për t'u përdorur në përpjekje të mëvonshme.
      }
    };

  const closeModal = (): void => {
    resetForm();
    onClose();
  };

  const closeWithCleanup =
    async (): Promise<void> => {
      await cleanupUploadedFile();
      closeModal();
    };

  const handleClose = (): void => {
    if (isBusy) return;

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

  // ============================================================
  // UPLOAD NGA FILE
  // ============================================================
  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) return;

    setUploadLoading(true);
    setError(null);

    try {
      // Pastro foton e vjetër para upload-it të ri
      if (uploadedFilePath) {
        await cleanupUploadedFile();
      }

      const uploaded =
        await filesService.upload(
          selectedFile,
        );

      setFile(selectedFile);

      setUploadedFilePath(
        uploaded.path,
      );

      setFormData((prev) => ({
        ...prev,
        photo: uploaded.url,
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to upload file';

      setError(message);
      setFile(null);

      setFormData((prev) => ({
        ...prev,
        photo: '',
      }));
    } finally {
      setUploadLoading(false);
    }
  };

  // ============================================================
  // KAMERA
  // ============================================================
  const requestCameraPermission =
    async (): Promise<boolean> => {
      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode:
                  'environment',
              },
              audio: false,
            },
          );

        setCameraStream(stream);

        return true;
      } catch {
        setError(
          'Camera permission is required to take photos. Please allow camera access.',
        );

        return false;
      }
    };

  const openCamera =
    async (): Promise<void> => {
      setError(null);

      if (cameraStream) {
        setCameraOpen(true);
        return;
      }

      const hasPermission =
        await requestCameraPermission();

      if (hasPermission) {
        setCameraOpen(true);
      }
    };

  const closeCamera = (): void => {
    if (cameraStream) {
      cameraStream
        .getTracks()
        .forEach((track) =>
          track.stop(),
        );

      setCameraStream(null);
    }

    setCameraOpen(false);
  };

  const capturePhoto =
    async (): Promise<void> => {
      if (
        !videoRef.current ||
        !canvasRef.current
      ) {
        return;
      }

      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      canvas.width =
        video.videoWidth || 640;

      canvas.height =
        video.videoHeight || 480;

      const ctx =
        canvas.getContext('2d');

      if (!ctx) return;

      ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // Konverto në Blob
      const blob =
        await new Promise<Blob | null>(
          (resolve) => {
            canvas.toBlob(
              (b) => resolve(b),
              'image/jpeg',
              0.9,
            );
          },
        );

      if (!blob) {
        setError(
          'Failed to capture photo',
        );

        return;
      }

      // Krijo File nga Blob
      const file = new File(
        [blob],
        `camera-capture-${Date.now()}.jpg`,
        {
          type: 'image/jpeg',
        },
      );

      // Ngarko foton
      setUploadLoading(true);
      setError(null);

      try {
        if (uploadedFilePath) {
          await cleanupUploadedFile();
        }

        const uploaded =
          await filesService.upload(
            file,
          );

        setFile(file);

        setUploadedFilePath(
          uploaded.path,
        );

        setFormData((prev) => ({
          ...prev,
          photo: uploaded.url,
        }));

        // Mbyll kamerën pas suksesit
        closeCamera();
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to upload photo';

        setError(message);
        setFile(null);

        setFormData((prev) => ({
          ...prev,
          photo: '',
        }));
      } finally {
        setUploadLoading(false);
      }
    };

  // ============================================================
  // SUBMIT
  // ============================================================
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    setError(null);

    if (!containerId?.trim()) {
      setError(
        'Container is required',
      );

      return;
    }

    const uniqueNumber =
      formData.uniqueNumber.trim();

    const name =
      formData.name.trim();

    const packageQuantity =
      Number(
        formData.packageQuantity,
      );

    const productsPerPackage =
      Number(
        formData.productsPerPackage,
      );

    const packagePrice =
      Number(
        formData.packagePrice,
      );

    const volume =
      Number(formData.volume);

    if (!uniqueNumber || !name) {
      setError(
        'Unique number and name are required',
      );

      return;
    }

    if (
      !Number.isInteger(
        packageQuantity,
      ) ||
      packageQuantity <= 0
    ) {
      setError(
        'Package quantity must be a positive integer',
      );

      return;
    }

    if (
      !Number.isInteger(
        productsPerPackage,
      ) ||
      productsPerPackage <= 0
    ) {
      setError(
        'Products per package must be a positive integer',
      );

      return;
    }

    if (
      !Number.isFinite(
        packagePrice,
      ) ||
      packagePrice < 0
    ) {
      setError(
        'Package price is invalid',
      );

      return;
    }

    if (
      !Number.isFinite(volume) ||
      volume <= 0
    ) {
      setError(
        'Volume must be greater than 0',
      );

      return;
    }

    setLoading(true);

    try {
      await createItem({
        uniqueNumber,
        name,
        photo:
          formData.photo ||
          undefined,
        packageQuantity,
        productsPerPackage,
        packagePrice,
        volume,
        containerId:
          containerId.trim(),
      });

      // Fotoja tani i përket item-it — mos e fshi.
      setUploadedFilePath(null);

      // Mbyll kamerën nëse është e hapur
      closeCamera();

      closeModal();

      onItemCreated?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create item';

      setError(message);

      // Fshi foton orphan nëse krijimi dështon
      await cleanupUploadedFile();

      setFormData((prev) => ({
        ...prev,
        photo: '',
      }));

      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const inputSx = {
    '& .MuiInputLabel-root': {
      color: '#55555a',
      fontWeight: 600,
    },

    '& .MuiInputLabel-root.Mui-focused':
      {
        color: '#18181b',
      },

    '& .MuiInputLabel-root.Mui-disabled':
      {
        color: '#8a8a90',
      },

    '& .MuiOutlinedInput-root': {
      borderRadius: 2,

      backgroundColor: '#ffffff',

      color: '#18181b',

      '& fieldset': {
        borderColor: '#c9c9ce',
      },

      '&:hover fieldset': {
        borderColor: '#99999f',
      },

      '&.Mui-focused fieldset': {
        borderColor: '#202024',
        borderWidth: 1.5,
      },

      '&.Mui-disabled': {
        backgroundColor: '#f2f2f4',
      },
    },

    '& .MuiOutlinedInput-input': {
      color: '#18181b',

      WebkitTextFillColor:
        '#18181b',

      fontSize: {
        xs: '16px',
        sm: '0.9rem',
      },

      '&::placeholder': {
        color: '#929297',
        opacity: 1,
      },
    },

    '& .MuiOutlinedInput-input.Mui-disabled':
      {
        color: '#85858a',

        WebkitTextFillColor:
          '#85858a',
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

            maxWidth: 620,

            maxHeight: {
              xs: 'calc(100dvh - 24px)',
              sm: 'calc(100dvh - 48px)',
            },

            borderRadius: {
              xs: 2,
              sm: 2.5,
            },

            backgroundColor:
              '#ffffff',

            border:
              '1px solid #cfcfd4',

            boxShadow:
              '0 16px 36px rgba(0,0,0,0.18)',

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

            py: {
              xs: 2,
              sm: 2.4,
            },

            color: '#151518',

            fontSize: {
              xs: '1.2rem',
              sm: '1.4rem',
            },

            fontWeight: 800,

            lineHeight: 1.25,

            letterSpacing:
              '-0.025em',

            backgroundColor:
              '#f3f3f5',

            borderBottom:
              '1px solid #d8d8dc',
          }}
        >
          Add Item to Container
        </DialogTitle>

        <DialogContent
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: {
              xs: 2.25,
              sm: 2.75,
            },

            backgroundColor:
              '#ffffff',
          }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                mt: 0,

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

              flexDirection:
                'column',

              gap: {
                xs: 1.75,
                sm: 2,
              },

              mt: 0.5,
            }}
          >
            <TextField
              name="uniqueNumber"
              label="Unique Number"
              fullWidth
              required
              value={
                formData.uniqueNumber
              }
              onChange={handleChange}
              disabled={isBusy}
              placeholder="e.g., ITEM-001"
              sx={inputSx}
            />

            <TextField
              name="name"
              label="Item Name"
              fullWidth
              required
              value={formData.name}
              onChange={handleChange}
              disabled={isBusy}
              placeholder="e.g., Electronic Components"
              sx={inputSx}
            />

            {/* Upload Photo / Camera */}
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
                variant="outlined"
                component="label"
                fullWidth
                disabled={isBusy}
                sx={{
                  minHeight: 48,

                  px: 2,

                  borderRadius: 2,

                  color: '#3f3f44',

                  borderColor:
                    '#c6c6cb',

                  backgroundColor:
                    '#ffffff',

                  fontSize: '0.82rem',

                  fontWeight: 700,

                  textTransform:
                    'none',

                  overflow: 'hidden',

                  whiteSpace: 'nowrap',

                  textOverflow:
                    'ellipsis',

                  '&:hover': {
                    color: '#202024',

                    borderColor:
                      '#9f9fa5',

                    backgroundColor:
                      '#f3f3f5',
                  },

                  '&.Mui-disabled': {
                    color: '#77777c',

                    backgroundColor:
                      '#eeeeF0',

                    borderColor:
                      '#ceced2',

                    opacity: 1,
                  },
                }}
              >
                {file
                  ? file.name
                  : 'Upload Photo'}

                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={
                    handleFileChange
                  }
                  disabled={isBusy}
                />
              </Button>

              <IconButton
                color="primary"
                onClick={openCamera}
                disabled={isBusy}
                aria-label="Open camera"
                sx={{
                  width: {
                    xs: '100%',
                    sm: 48,
                  },

                  height: 48,

                  flexShrink: 0,

                  borderRadius: 2,

                  color: '#444449',

                  border:
                    '1px solid #c6c6cb',

                  backgroundColor:
                    '#ffffff',

                  '&:hover': {
                    color: '#18181b',

                    backgroundColor:
                      '#f3f3f5',

                    borderColor:
                      '#9f9fa5',
                  },

                  '&.Mui-disabled': {
                    color: '#77777c',

                    backgroundColor:
                      '#eeeeF0',

                    borderColor:
                      '#ceced2',

                    opacity: 1,
                  },
                }}
              >
                <CameraIcon />
              </IconButton>
            </Box>

            {formData.photo && (
              <Box
                sx={{
                  position:
                    'relative',

                  display:
                    'inline-flex',

                  maxWidth: '100%',

                  alignSelf:
                    'center',

                  p: 1,

                  borderRadius: 2,

                  border:
                    '1px solid #d3d3d7',

                  backgroundColor:
                    '#f5f5f6',
                }}
              >
                <Box
                  component="img"
                  src={formData.photo}
                  alt={`Preview of ${
                    formData.name ||
                    'selected item'
                  }`}
                  sx={{
                    display: 'block',

                    maxHeight: {
                      xs: 150,
                      sm: 180,
                    },

                    maxWidth:
                      '100%',

                    objectFit:
                      'contain',

                    borderRadius:
                      1.5,

                    border:
                      '1px solid #d0d0d4',

                    backgroundColor:
                      '#ffffff',
                  }}
                />

                <IconButton
                  size="small"
                  aria-label="Remove photo"
                  sx={{
                    position:
                      'absolute',

                    top: -9,
                    right: -9,

                    width: 30,
                    height: 30,

                    color: '#444449',

                    backgroundColor:
                      '#ffffff',

                    border:
                      '1px solid #d0d0d4',

                    boxShadow:
                      '0 3px 8px rgba(0,0,0,0.12)',

                    '&:hover': {
                      color: '#b52f38',

                      backgroundColor:
                        '#fff2f3',
                    },
                  }}
                  onClick={() => {
                    setFormData(
                      (prev) => ({
                        ...prev,
                        photo: '',
                      }),
                    );

                    setFile(null);

                    void cleanupUploadedFile();
                  }}
                  disabled={isBusy}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Box
              sx={{
                display: 'grid',

                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },

                gap: {
                  xs: 1.75,
                  sm: 2,
                },
              }}
            >
              <TextField
                name="packageQuantity"
                label="Package Quantity"
                type="number"
                fullWidth
                required
                value={
                  formData.packageQuantity
                }
                onChange={handleChange}
                disabled={isBusy}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    step: 1,
                  },
                }}
                sx={inputSx}
              />

              <TextField
                name="productsPerPackage"
                label="Products/Package"
                type="number"
                fullWidth
                required
                value={
                  formData.productsPerPackage
                }
                onChange={handleChange}
                disabled={isBusy}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    step: 1,
                  },
                }}
                sx={inputSx}
              />

              <TextField
                name="packagePrice"
                label="Package Price ($)"
                type="number"
                fullWidth
                required
                value={
                  formData.packagePrice
                }
                onChange={handleChange}
                disabled={isBusy}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: 0.01,
                  },
                }}
                sx={inputSx}
              />

              <TextField
                name="volume"
                label="Volume per Package (m³)"
                type="number"
                fullWidth
                required
                value={
                  formData.volume
                }
                onChange={handleChange}
                disabled={isBusy}
                slotProps={{
                  htmlInput: {
                    min: 0.01,
                    step: 0.01,
                  },
                }}
                sx={inputSx}
              />
            </Box>
          </Box>
        </DialogContent>

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

            gap: 1,

            flexDirection: {
              xs: 'column-reverse',
              sm: 'row',
            },

            borderTop:
              '1px solid #d8d8dc',

            backgroundColor:
              '#f3f3f5',
          }}
        >
          <Button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            sx={{
              minWidth: 100,

              minHeight: 44,

              width: {
                xs: '100%',
                sm: 'auto',
              },

              px: 2.25,

              borderRadius: 2,

              color: '#3d3d42',

              border:
                '1px solid #c4c4c9',

              backgroundColor:
                '#ffffff',

              fontSize:
                '0.84rem',

              fontWeight: 700,

              textTransform:
                'none',

              '&:hover': {
                color: '#202024',

                backgroundColor:
                  '#eeeeF0',

                borderColor:
                  '#9f9fa5',
              },

              '&.Mui-disabled': {
                color: '#77777c',

                backgroundColor:
                  '#eeeeF0',

                borderColor:
                  '#ceced2',

                opacity: 1,
              },
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={isBusy}
            sx={{
              minWidth: 130,

              minHeight: 44,

              width: {
                xs: '100%',
                sm: 'auto',
              },

              px: 2.5,

              borderRadius: 2,

              backgroundColor:
                '#202024',

              color: '#ffffff',

              fontSize:
                '0.84rem',

              fontWeight: 700,

              textTransform:
                'none',

              boxShadow: 'none',

              '&:hover': {
                backgroundColor:
                  '#111114',

                color: '#ffffff',

                boxShadow: 'none',
              },

              '&.Mui-disabled': {
                backgroundColor:
                  '#515156',

                color: '#eeeeF0',

                opacity: 1,
              },
            }}
          >
            {loading
              ? 'Adding...'
              : 'Add Item'}
          </Button>
        </DialogActions>
      </Box>

      {/* Camera overlay */}
      <Dialog
        open={cameraOpen}
        onClose={() => {
          if (!isBusy) {
            closeCamera();
          }
        }}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor:
                'rgba(10,10,12,0.65)',
            },
          },

          paper: {
            sx: {
              mx: {
                xs: 1.25,
                sm: 2.5,
              },

              borderRadius: {
                xs: 2,
                sm: 2.5,
              },

              backgroundColor:
                '#ffffff',

              border:
                '1px solid #cfcfd4',

              boxShadow:
                '0 16px 36px rgba(0,0,0,0.20)',

              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            position: 'relative',

            px: {
              xs: 2.25,
              sm: 3,
            },

            py: {
              xs: 1.75,
              sm: 2,
            },

            color: '#17171a',

            fontSize: {
              xs: '1.1rem',
              sm: '1.2rem',
            },

            fontWeight: 800,

            backgroundColor:
              '#f3f3f5',

            borderBottom:
              '1px solid #d8d8dc',
          }}
        >
          Take Photo

          <IconButton
            aria-label="Close camera"
            sx={{
              position:
                'absolute',

              right: 12,
              top: '50%',

              transform:
                'translateY(-50%)',

              width: 36,
              height: 36,

              color: '#444449',

              borderRadius: 2,

              '&:hover': {
                color: '#18181b',

                backgroundColor:
                  '#e7e7ea',
              },

              '&.Mui-disabled': {
                color: '#99999e',

                opacity: 1,
              },
            }}
            onClick={closeCamera}
            disabled={isBusy}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
            },

            backgroundColor:
              '#ffffff',
          }}
        >
          <Box
            sx={{
              position: 'relative',

              width: '100%',

              aspectRatio: '4/3',

              overflow: 'hidden',

              borderRadius: 2,

              border:
                '1px solid #2d2d31',

              backgroundColor:
                '#000000',

              boxShadow:
                '0 6px 18px rgba(0,0,0,0.15)',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 8,
                background: '#000',
              }}
            />

            <canvas
              ref={canvasRef}
              style={{
                display: 'none',
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',

              flexDirection: {
                xs: 'column',
                sm: 'row',
              },

              justifyContent:
                'center',

              mt: 2,

              gap: 1,
            }}
          >
            <Button
              type="button"
              variant="contained"
              onClick={capturePhoto}
              disabled={
                isBusy ||
                !cameraStream
              }
              startIcon={
                isBusy ? (
                  <CircularProgress
                    size={18}
                    color="inherit"
                  />
                ) : undefined
              }
              sx={{
                minHeight: 44,

                px: 2.5,

                borderRadius: 2,

                backgroundColor:
                  '#202024',

                color: '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight: 700,

                textTransform:
                  'none',

                boxShadow: 'none',

                '&:hover': {
                  backgroundColor:
                    '#111114',

                  color: '#ffffff',

                  boxShadow:
                    'none',
                },

                '&.Mui-disabled': {
                  backgroundColor:
                    '#515156',

                  color: '#eeeeF0',

                  opacity: 1,
                },
              }}
            >
              Capture
            </Button>

            <Button
              type="button"
              variant="outlined"
              onClick={closeCamera}
              disabled={isBusy}
              sx={{
                minHeight: 44,

                px: 2.25,

                borderRadius: 2,

                color: '#3d3d42',

                borderColor:
                  '#c4c4c9',

                backgroundColor:
                  '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight: 700,

                textTransform:
                  'none',

                '&:hover': {
                  color: '#202024',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#9f9fa5',
                },

                '&.Mui-disabled': {
                  color: '#77777c',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#ceced2',

                  opacity: 1,
                },
              }}
            >
              Cancel
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};