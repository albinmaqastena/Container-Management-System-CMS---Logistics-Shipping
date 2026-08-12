// src/components/items/EditItemModal.tsx

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  ChangeEvent,
  FormEvent,
} from 'react';
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
  IconButton,
  TextField,
  Typography,
} from '@mui/material';

import {
  CameraAlt as CameraIcon,
  Close as CloseIcon,
  CloudUploadOutlined as UploadIcon,
} from '@mui/icons-material';

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

  const [formData, setFormData] =
    useState<FormData>({
      name: item.name ?? '',
      photo: item.photo ?? null,
      packageQuantity: String(
        item.packageQuantity ?? '',
      ),
      productsPerPackage: String(
        item.productsPerPackage ?? '',
      ),
      packagePrice: String(
        item.packagePrice ?? '',
      ),
      volume: String(
        item.volume ?? '',
      ),
    });

  const [file, setFile] =
    useState<File | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [uploadLoading, setUploadLoading] =
    useState(false);

  const [
    uploadedFilePath,
    setUploadedFilePath,
  ] = useState<string | null>(null);

  const [
    photoPreviewUrl,
    setPhotoPreviewUrl,
  ] = useState<string | null>(null);

  const [
    photoChanged,
    setPhotoChanged,
  ] = useState(false);

  // Camera state - same interaction style as CreateItemModal
  const [cameraOpen, setCameraOpen] =
    useState(false);
  const [
    cameraStream,
    setCameraStream,
  ] = useState<MediaStream | null>(null);
  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);
  const [
    cameraLoading,
    setCameraLoading,
  ] = useState(false);

  const videoRef =
    useRef<HTMLVideoElement>(null);
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const isBusy =
    loading || uploadLoading;

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormData({
      name: item.name ?? '',
      photo: item.photo ?? null,
      packageQuantity: String(
        item.packageQuantity ?? '',
      ),
      productsPerPackage: String(
        item.productsPerPackage ?? '',
      ),
      packagePrice: String(
        item.packagePrice ?? '',
      ),
      volume: String(
        item.volume ?? '',
      ),
    });

    setPhotoPreviewUrl(
      item.photoUrl ?? null,
    );
    setUploadedFilePath(null);
    setPhotoChanged(false);
    setFile(null);
    setError(null);
  }, [open, item]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;

    const startPreview =
      async (): Promise<void> => {
        try {
          setCameraReady(false);
          video.srcObject = cameraStream;
          video.muted = true;
          video.playsInline = true;

          if (video.readyState < 1) {
            await new Promise<void>(
              (resolve, reject) => {
                const onLoaded =
                  (): void => {
                    cleanup();
                    resolve();
                  };

                const onError =
                  (): void => {
                    cleanup();
                    reject(
                      new Error(
                        'Camera preview could not be loaded',
                      ),
                    );
                  };

                const cleanup =
                  (): void => {
                    video.removeEventListener(
                      'loadedmetadata',
                      onLoaded,
                    );
                    video.removeEventListener(
                      'error',
                      onError,
                    );
                  };

                video.addEventListener(
                  'loadedmetadata',
                  onLoaded,
                );
                video.addEventListener(
                  'error',
                  onError,
                );
              },
            );
          }

          if (cancelled) {
            return;
          }

          await video.play();

          if (
            !cancelled &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            setCameraReady(true);
          }
        } catch (cameraError) {
          console.error(
            'Camera preview error:',
            cameraError,
          );

          if (!cancelled) {
            setError(
              'Camera is available, but the preview could not be started.',
            );
          }
        }
      };

    void startPreview();

    return () => {
      cancelled = true;

      try {
        video.pause();
      } catch {
        // Ignore cleanup errors.
      }

      video.srcObject = null;
    };
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });
    };
  }, [cameraStream]);

  const cleanupUploadedFile =
    async (): Promise<void> => {
      if (!uploadedFilePath) {
        return;
      }

      try {
        await filesService.delete(
          uploadedFilePath,
        );
        setUploadedFilePath(null);
      } catch (cleanupError) {
        console.error(
          'Failed to remove temporary uploaded file:',
          cleanupError,
        );
      }
    };

  const closeCamera = (): void => {
    const video = videoRef.current;

    if (video) {
      try {
        video.pause();
      } catch {
        // Ignore.
      }

      video.srcObject = null;
    }

    cameraStream
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    setCameraStream(null);
    setCameraReady(false);
    setCameraLoading(false);
    setCameraOpen(false);
  };

  const closeWithCleanup =
    async (): Promise<void> => {
      await cleanupUploadedFile();
      closeCamera();
      setFile(null);
      onClose();
    };

  const handleClose = (): void => {
    if (isBusy) {
      return;
    }

    void closeWithCleanup();
  };

  const handleDialogClose:
    NonNullable<
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
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handlePhotoChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
      const selectedFile =
        event.target.files?.[0];

      event.target.value = '';

      if (!selectedFile) {
        return;
      }

      setUploadLoading(true);
      setError(null);

      try {
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

        // Permanent S3 key for DB.
        setFormData((current) => ({
          ...current,
          photo: uploaded.path,
        }));

        // Temporary presigned URL for preview.
        setPhotoPreviewUrl(
          uploaded.url,
        );
        setPhotoChanged(true);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload photo',
        );
      } finally {
        setUploadLoading(false);
      }
    };

  const requestCameraPermission =
    async (): Promise<boolean> => {
      setCameraLoading(true);
      setCameraReady(false);

      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          setError(
            'Camera access is not supported by this browser.',
          );
          return false;
        }

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal: 'environment',
                },
                width: {
                  ideal: 1920,
                },
                height: {
                  ideal: 1080,
                },
              },
              audio: false,
            });

        if (
          stream.getVideoTracks().length ===
          0
        ) {
          stream
            .getTracks()
            .forEach((track) => {
              track.stop();
            });

          setError(
            'No camera was found on this device.',
          );
          return false;
        }

        setCameraStream(stream);
        return true;
      } catch (cameraError) {
        let message =
          'Could not access the camera.';

        if (
          cameraError instanceof
          DOMException
        ) {
          switch (cameraError.name) {
            case 'NotAllowedError':
            case 'SecurityError':
              message =
                'Camera permission was denied. Allow camera access and try again.';
              break;

            case 'NotFoundError':
              message =
                'No camera was found on this device.';
              break;

            case 'NotReadableError':
              message =
                'The camera may already be in use by another application.';
              break;

            default:
              message =
                cameraError.message ||
                message;
          }
        }

        setError(message);
        return false;
      } finally {
        setCameraLoading(false);
      }
    };

  const openCamera =
    async (): Promise<void> => {
      if (
        isBusy ||
        cameraLoading
      ) {
        return;
      }

      setError(null);
      setCameraOpen(true);

      if (cameraStream) {
        return;
      }

      const allowed =
        await requestCameraPermission();

      if (!allowed) {
        setCameraOpen(false);
      }
    };

  const capturePhoto =
    async (): Promise<void> => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !video ||
        !canvas ||
        !cameraReady ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        setError(
          'Camera is not ready yet.',
        );
        return;
      }

      canvas.width =
        video.videoWidth;
      canvas.height =
        video.videoHeight;

      const context =
        canvas.getContext('2d');

      if (!context) {
        setError(
          'Could not prepare captured image.',
        );
        return;
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const blob =
        await new Promise<Blob | null>(
          (resolve) => {
            canvas.toBlob(
              resolve,
              'image/jpeg',
              0.9,
            );
          },
        );

      if (!blob) {
        setError(
          'Failed to capture photo.',
        );
        return;
      }

      const capturedFile =
        new File(
          [blob],
          `camera-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          },
        );

      setUploadLoading(true);
      setError(null);

      try {
        if (uploadedFilePath) {
          await cleanupUploadedFile();
        }

        const uploaded =
          await filesService.upload(
            capturedFile,
          );

        setFile(capturedFile);
        setUploadedFilePath(
          uploaded.path,
        );

        setFormData((current) => ({
          ...current,
          photo: uploaded.path,
        }));

        setPhotoPreviewUrl(
          uploaded.url,
        );
        setPhotoChanged(true);
        closeCamera();
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload captured photo',
        );
      } finally {
        setUploadLoading(false);
      }
    };

  const removePhoto =
    async (): Promise<void> => {
      if (isBusy) {
        return;
      }

      if (uploadedFilePath) {
        await cleanupUploadedFile();
      }

      setFile(null);

      setFormData((current) => ({
        ...current,
        photo: null,
      }));

      setPhotoPreviewUrl(null);
      setPhotoChanged(true);
    };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();
      setError(null);

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

      if (!name) {
        setError(
          'Item name is required.',
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
          'Package quantity must be a positive integer.',
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
          'Products per package must be a positive integer.',
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
          'Package price is invalid.',
        );
        return;
      }

      const volumeDecimalPlaces =
        formData.volume.includes('.')
            ? formData.volume.split('.')[1]?.length ?? 0
            : 0;

        if (
        !Number.isFinite(volume) ||
        volume < 0.0000000001
        ) {
        setError(
            'Volume must be at least 0.0000000001.',
        );

        return;
        }

        if (volumeDecimalPlaces > 10) {
        setError(
            'Volume must have at most 10 decimal places.',
        );

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
          ...(photoChanged
            ? {
                photo:
                  formData.photo,
              }
            : {}),
        });

        // New upload is now committed to the item.
        setUploadedFilePath(null);
        closeCamera();
        onClose();
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : 'Failed to update item',
        );
      } finally {
        setLoading(false);
      }
    };

  const sectionTitleSx = {
  mb: 1.5,
  color: '#111827',
  fontSize: {
    xs: '0.9rem',
    sm: '0.95rem',
  },
  fontWeight: 800,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const;

  const inputSx = {
  // LABEL NORMAL
  '& .MuiInputLabel-root': {
    color: '#4b5563',
    fontWeight: 600,
  },

  // LABEL FOCUSED
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#111827',
  },

  // LABEL DISABLED
  '& .MuiInputLabel-root.Mui-disabled': {
    color: '#4b5563',
    opacity: 1,
  },

  // INPUT CONTAINER
  '& .MuiOutlinedInput-root': {
    minHeight: 52,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    color: '#111827',

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

    // DISABLED INPUT CONTAINER
    '&.Mui-disabled': {
      backgroundColor: '#f3f4f6',
      opacity: 1,

      '& fieldset': {
        borderColor: '#d1d5db',
      },
    },
  },

  // NORMAL INPUT TEXT
  '& .MuiOutlinedInput-input': {
    color: '#111827',
    WebkitTextFillColor: '#111827',

    fontSize: {
      xs: '16px',
      sm: '0.9rem',
    },

    fontWeight: 500,
  },

  // DISABLED INPUT TEXT
  '& .MuiOutlinedInput-input.Mui-disabled': {
    color: '#374151',
    WebkitTextFillColor: '#374151',
    opacity: 1,
    fontWeight: 600,
  },

  // HELPER TEXT
  '& .MuiFormHelperText-root': {
    color: '#6b7280',
    marginLeft: 0.5,
    marginTop: 0.75,
    fontSize: '0.75rem',
  },

  // HELPER TEXT DISABLED
  '& .MuiFormHelperText-root.Mui-disabled': {
    color: '#6b7280',
    opacity: 1,
  },
} as const;

  return (
    <>
      <Dialog
        open={open}
        onClose={
          handleDialogClose
        }
        fullWidth
        maxWidth="md"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor:
                'rgba(17,17,20,0.56)',
              backdropFilter:
                'blur(2px)',
            },
          },
          paper: {
            sx: {
              m: {
                xs: 0,
                sm: 2,
                md: 3,
              },
              width: {
                xs: '100%',
                sm:
                  'calc(100% - 32px)',
                md:
                  'calc(100% - 48px)',
              },
              maxWidth: {
                xs: '100%',
                sm: 720,
                md: 860,
              },
              height: {
                xs: '100dvh',
                sm: 'auto',
              },
              maxHeight: {
                xs: '100dvh',
                sm:
                  'calc(100dvh - 32px)',
                md:
                  'calc(100dvh - 48px)',
              },
              borderRadius: {
                xs: 0,
                sm: 2.5,
                md: 3,
              },
              overflow:
                'hidden',
              backgroundColor:
                '#ffffff',
              border: {
                xs: 'none',
                sm:
                  '1px solid #cfcfd4',
              },
              boxShadow:
                '0 20px 50px rgba(0,0,0,0.22)',
            },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={
            handleSubmit
          }
          aria-busy={
            isBusy
          }
          sx={{
            display: 'flex',
            flexDirection:
              'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <DialogTitle
            sx={{
              position:
                'relative',
              flexShrink: 0,
              px: {
                xs: 2,
                sm: 3,
              },
              pr: {
                xs: 6,
                sm: 7,
              },
              py: {
                xs: 1.75,
                sm: 2.25,
              },
              color:
                '#151518',
              fontSize: {
                xs: '1.15rem',
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
            Edit Item

            <Typography
              component="div"
              sx={{
                mt: 0.35,
                color:
                  '#717177',
                fontSize: {
                  xs: '0.72rem',
                  sm: '0.8rem',
                },
                fontWeight: 500,
                letterSpacing:
                  'normal',
              }}
            >
              Update item information and optionally replace the photo.
            </Typography>

            <IconButton
              type="button"
              aria-label="Close"
              disabled={
                isBusy
              }
              onClick={
                handleClose
              }
              sx={{
                position:
                  'absolute',
                top: '50%',
                right: {
                  xs: 10,
                  sm: 14,
                },
                transform:
                  'translateY(-50%)',
                width: 38,
                height: 38,
                color:
                  '#49494e',
                '&:hover': {
                  backgroundColor:
                    '#e6e6e9',
                  color:
                    '#18181b',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY:
                'auto',
              px: {
                xs: 2,
                sm: 3,
              },
              py: {
                xs: 2,
                sm: 2.75,
              },
            }}
          >
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2.25,
                  borderRadius: 2,
                  color:
                    '#8b1f27',
                  backgroundColor:
                    '#fff2f3',
                  border:
                    '1px solid #efc9cc',
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
                  xs: 2,
                  sm: 2.25,
                },
              }}
            >
              {/* GENERAL INFORMATION */}
              <Box>
                <Typography
                  sx={
                    sectionTitleSx
                  }
                >
                  General information
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns:
                      {
                        xs: '1fr',
                        md:
                          'repeat(2, minmax(0, 1fr))',
                      },
                    gap: {
                      xs: 1.75,
                      sm: 2,
                    },
                  }}
                >
                  <TextField
                    label="Unique Number"
                    value={
                      item.uniqueNumber
                    }
                    disabled
                    fullWidth
                    helperText="Unique number is kept unchanged."
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="name"
                    label="Item Name"
                    value={
                      formData.name
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    required
                    fullWidth
                    placeholder="e.g. Electronic Components"
                    sx={
                      inputSx
                    }
                  />
                </Box>
              </Box>

              {/* PHOTO */}
              <Box>
                <Typography
                  sx={
                    sectionTitleSx
                  }
                >
                  Item photo
                </Typography>

                <Box
                  sx={{
                    p: {
                      xs: 1.5,
                      sm: 2,
                    },
                    border:
                      '1px solid #dddde1',
                    borderRadius:
                      2.5,
                    backgroundColor:
                      '#f8f8f9',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection:
                        {
                          xs: 'column',
                          sm: 'row',
                        },
                      alignItems:
                        {
                          xs:
                            'stretch',
                          sm: 'center',
                        },
                      gap: 1.25,
                    }}
                  >
                    <Button
                      variant="outlined"
                      component="label"
                      disabled={
                        isBusy
                      }
                      startIcon={
                        uploadLoading
                          ? (
                              <CircularProgress
                                size={18}
                                color="inherit"
                              />
                            )
                          : (
                              <UploadIcon />
                            )
                      }
                      sx={{
                        flex: 1,
                        minHeight: 48,
                        minWidth: 0,
                        borderRadius: 2,
                        color:
                          '#3f3f44',
                        borderColor:
                          '#c6c6cb',
                        backgroundColor:
                          '#ffffff',
                        fontWeight: 700,
                        textTransform:
                          'none',
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          minWidth: 0,
                          overflow:
                            'hidden',
                          textOverflow:
                            'ellipsis',
                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        {uploadLoading
                          ? 'Uploading...'
                          : file
                            ? file.name
                            : photoPreviewUrl
                              ? 'Change Photo'
                              : 'Choose Photo'}
                      </Box>

                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                          handlePhotoChange
                        }
                        disabled={
                          isBusy
                        }
                      />
                    </Button>

                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => {
                        void openCamera();
                      }}
                      disabled={
                        isBusy ||
                        cameraLoading
                      }
                      startIcon={
                        cameraLoading
                          ? (
                              <CircularProgress
                                size={18}
                                color="inherit"
                              />
                            )
                          : (
                              <CameraIcon />
                            )
                      }
                      sx={{
                        minHeight: 48,
                        width: {
                          xs: '100%',
                          sm: 'auto',
                        },
                        minWidth: {
                          sm: 160,
                        },
                        borderRadius: 2,
                        color:
                          '#3f3f44',
                        borderColor:
                          '#c6c6cb',
                        backgroundColor:
                          '#ffffff',
                        fontWeight: 700,
                        textTransform:
                          'none',
                      }}
                    >
                      {cameraLoading
                        ? 'Opening...'
                        : 'Take Photo'}
                    </Button>
                  </Box>

                  {photoPreviewUrl && (
                    <Box
                      sx={{
                        position:
                          'relative',
                        mt: 2,
                        width: '100%',
                        maxWidth: 420,
                        mx: 'auto',
                        p: 1,
                        borderRadius: 2,
                        border:
                          '1px solid #d3d3d7',
                        backgroundColor:
                          '#ffffff',
                      }}
                    >
                      <Box
                        component="img"
                        src={
                          photoPreviewUrl
                        }
                        alt={`Preview of ${
                          formData.name ||
                          item.uniqueNumber
                        }`}
                        sx={{
                          display: 'block',
                          width: '100%',
                          maxHeight: {
                            xs: 220,
                            sm: 280,
                          },
                          objectFit:
                            'contain',
                          borderRadius: 1.5,
                        }}
                      />

                      <IconButton
                        size="small"
                        aria-label="Remove photo"
                        onClick={() => {
                          void removePhoto();
                        }}
                        disabled={
                          isBusy
                        }
                        sx={{
                          position:
                            'absolute',
                          top: -10,
                          right: -10,
                          width: 32,
                          height: 32,
                          color:
                            '#444449',
                          backgroundColor:
                            '#ffffff',
                          border:
                            '1px solid #d0d0d4',
                          boxShadow:
                            '0 3px 8px rgba(0,0,0,0.14)',
                          '&:hover': {
                            color:
                              '#b52f38',
                            backgroundColor:
                              '#fff2f3',
                          },
                        }}
                      >
                        <CloseIcon
                          fontSize="small"
                        />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* QUANTITY & PRICING */}
              <Box>
                <Typography
                  sx={
                    sectionTitleSx
                  }
                >
                  Quantity & pricing
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns:
                      {
                        xs: '1fr',
                        sm:
                          'repeat(2, minmax(0, 1fr))',
                        lg:
                          'repeat(4, minmax(0, 1fr))',
                      },
                    gap: {
                      xs: 1.5,
                      sm: 2,
                    },
                  }}
                >
                  <TextField
                    name="packageQuantity"
                    label="Package Quantity"
                    type="number"
                    value={
                      formData.packageQuantity
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    required
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        min: 1,
                        step: 1,
                      },
                    }}
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="productsPerPackage"
                    label="Products / Package"
                    type="number"
                    value={
                      formData.productsPerPackage
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    required
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        min: 1,
                        step: 1,
                      },
                    }}
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="packagePrice"
                    label="Package Price"
                    type="number"
                    value={
                      formData.packagePrice
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    required
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        step: 0.01,
                      },
                    }}
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="volume"
                    label="Volume / Package (m³)"
                    type="number"
                    value={
                      formData.volume
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    required
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        min:
                          0.0000000001,
                        step:
                          0.0000000001,
                      },
                    }}
                    sx={
                      inputSx
                    }
                  />
                </Box>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions
            sx={{
              flexShrink: 0,
              px: {
                xs: 2,
                sm: 3,
              },
              py: {
                xs: 1.5,
                sm: 1.75,
              },
              gap: 1,
              flexDirection:
                {
                  xs:
                    'column-reverse',
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
              onClick={
                handleClose
              }
              disabled={
                isBusy
              }
              sx={{
                minHeight: 46,
                minWidth: 110,
                width: {
                  xs: '100%',
                  sm: 'auto',
                },
                border:
                  '1px solid #c4c4c9',
                borderRadius: 2,
                color:
                  '#3d3d42',
                backgroundColor:
                  '#ffffff',
                fontWeight: 700,
                textTransform:
                  'none',
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={
                isBusy
              }
              startIcon={
                loading
                  ? (
                      <CircularProgress
                        size={18}
                        color="inherit"
                      />
                    )
                  : undefined
              }
              sx={{
                minHeight: 46,
                minWidth: 140,
                width: {
                  xs: '100%',
                  sm: 'auto',
                },
                borderRadius: 2,
                backgroundColor:
                  '#202024',
                color:
                  '#ffffff',
                fontWeight: 700,
                textTransform:
                  'none',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor:
                    '#111114',
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

      {/* CAMERA DIALOG */}
      <Dialog
        open={
          cameraOpen
        }
        onClose={() => {
          if (!isBusy) {
            closeCamera();
          }
        }}
        fullWidth
        maxWidth="md"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor:
                'rgba(5,5,7,0.78)',
              backdropFilter:
                'blur(3px)',
            },
          },
          paper: {
            sx: {
              m: {
                xs: 0,
                sm: 2,
              },
              width: {
                xs: '100%',
                sm:
                  'calc(100% - 32px)',
              },
              maxWidth: 820,
              height: {
                xs: '100dvh',
                sm: 'auto',
              },
              maxHeight: {
                xs: '100dvh',
                sm:
                  'calc(100dvh - 32px)',
              },
              borderRadius: {
                xs: 0,
                sm: 3,
              },
              overflow:
                'hidden',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            position:
              'relative',
            px: {
              xs: 2,
              sm: 3,
            },
            pr: 7,
            py: {
              xs: 1.5,
              sm: 1.9,
            },
            fontWeight: 800,
            backgroundColor:
              '#f3f3f5',
            borderBottom:
              '1px solid #d8d8dc',
          }}
        >
          Take Photo

          <Typography
            component="div"
            sx={{
              mt: 0.25,
              color:
                '#717177',
              fontSize:
                '0.75rem',
            }}
          >
            Position the item inside the camera frame.
          </Typography>

          <IconButton
            aria-label="Close camera"
            onClick={
              closeCamera
            }
            disabled={
              isBusy
            }
            sx={{
              position:
                'absolute',
              right: 12,
              top: '50%',
              transform:
                'translateY(-50%)',
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            p: {
              xs: 1,
              sm: 2,
            },
          }}
        >
          <Box
            sx={{
              position:
                'relative',
              width: '100%',
              aspectRatio: {
                xs: '3 / 4',
                sm: '4 / 3',
                md: '16 / 9',
              },
              maxHeight: {
                xs: '68dvh',
                sm: 540,
              },
              overflow:
                'hidden',
              borderRadius: {
                xs: 1.5,
                sm: 2.5,
              },
              backgroundColor:
                '#09090b',
            }}
          >
            <video
              ref={
                videoRef
              }
              autoPlay
              muted
              playsInline
              onCanPlay={() => {
                setCameraReady(true);
              }}
              onPlaying={() => {
                setCameraReady(true);
              }}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor:
                  '#09090b',
              }}
            />

            {!cameraReady && (
              <Box
                sx={{
                  position:
                    'absolute',
                  inset: 0,
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  gap: 1.5,
                  color:
                    '#ffffff',
                  backgroundColor:
                    '#09090b',
                }}
              >
                <CircularProgress
                  size={36}
                  color="inherit"
                />
                <Typography>
                  Starting camera...
                </Typography>
              </Box>
            )}

            <canvas
              ref={
                canvasRef
              }
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
              onClick={() => {
                void capturePhoto();
              }}
              disabled={
                isBusy ||
                !cameraStream ||
                !cameraReady
              }
              startIcon={
                uploadLoading
                  ? (
                      <CircularProgress
                        size={18}
                        color="inherit"
                      />
                    )
                  : (
                      <CameraIcon />
                    )
              }
              sx={{
                minHeight: 48,
                minWidth: {
                  sm: 180,
                },
                borderRadius: 2,
                backgroundColor:
                  '#202024',
                fontWeight: 700,
                textTransform:
                  'none',
              }}
            >
              {uploadLoading
                ? 'Saving...'
                : 'Capture Photo'}
            </Button>

            <Button
              type="button"
              variant="outlined"
              onClick={
                closeCamera
              }
              disabled={
                isBusy
              }
              sx={{
                minHeight: 48,
                minWidth: {
                  sm: 130,
                },
                borderRadius: 2,
                fontWeight: 700,
                textTransform:
                  'none',
              }}
            >
              Cancel
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditItemModal;