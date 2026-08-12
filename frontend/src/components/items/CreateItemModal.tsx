// src/components/items/CreateItemModal.tsx

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ChangeEvent,
  FormEvent,
} from 'react';

import type {
  DialogProps,
} from '@mui/material';

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

import { useItems } from '../../hooks/useItems';
import { filesService } from '../../services/file.service';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

const initialFormData: FormData = {
  uniqueNumber: '',
  name: '',
  photo: '',
  packageQuantity: '',
  productsPerPackage: '',
  packagePrice: '',
  volume: '',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const CreateItemModal = ({
  open,
  onClose,
  containerId,
  onItemCreated,
}: CreateItemModalProps) => {
  const { createItem } = useItems();

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  const [formData, setFormData] =
    useState<FormData>(
      initialFormData,
    );

  const [file, setFile] =
    useState<File | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [
    uploadLoading,
    setUploadLoading,
  ] = useState(false);

  const [
    uploadedFilePath,
    setUploadedFilePath,
  ] = useState<string | null>(
    null,
  );

  const [
    photoPreviewUrl,
    setPhotoPreviewUrl,
  ] = useState<string | null>(
    null,
  );

  // ==========================================================================
  // CAMERA STATE
  // ==========================================================================

  const [
    cameraOpen,
    setCameraOpen,
  ] = useState(false);

  const [
    cameraStream,
    setCameraStream,
  ] = useState<MediaStream | null>(
    null,
  );

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);

  const [
    cameraLoading,
    setCameraLoading,
  ] = useState(false);

  const videoRef =
    useRef<HTMLVideoElement>(
      null,
    );

  const canvasRef =
    useRef<HTMLCanvasElement>(
      null,
    );

  const isBusy =
    loading ||
    uploadLoading;

  // ==========================================================================
  // CAMERA PREVIEW
  // ==========================================================================

  useEffect(() => {
    if (
      !cameraOpen ||
      !cameraStream
    ) {
      return;
    }

    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    let cancelled = false;

    const startPreview =
      async (): Promise<void> => {
        try {
          setCameraReady(false);

          video.srcObject =
            cameraStream;

          video.muted = true;
          video.playsInline =
            true;

          /*
           * Nëse metadata ende nuk është ngarkuar,
           * presim derisa browser-i të njohë dimensionet
           * reale të stream-it.
           */
          if (
            video.readyState < 1
          ) {
            await new Promise<void>(
              (
                resolve,
                reject,
              ) => {
                const handleLoadedMetadata =
                  (): void => {
                    cleanup();
                    resolve();
                  };

                const handleError =
                  (): void => {
                    cleanup();

                    reject(
                      new Error(
                        'Video metadata could not be loaded',
                      ),
                    );
                  };

                const cleanup =
                  (): void => {
                    video.removeEventListener(
                      'loadedmetadata',
                      handleLoadedMetadata,
                    );

                    video.removeEventListener(
                      'error',
                      handleError,
                    );
                  };

                video.addEventListener(
                  'loadedmetadata',
                  handleLoadedMetadata,
                );

                video.addEventListener(
                  'error',
                  handleError,
                );
              },
            );
          }

          if (cancelled) {
            return;
          }

          await video.play();

          if (cancelled) {
            return;
          }

          if (
            video.videoWidth >
              0 &&
            video.videoHeight >
              0
          ) {
            setCameraReady(
              true,
            );
          }
        } catch (
          previewError: unknown
        ) {
          console.error(
            'Camera preview error:',
            previewError,
          );

          if (!cancelled) {
            setCameraReady(
              false,
            );

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

      video.srcObject =
        null;
    };
  }, [
    cameraOpen,
    cameraStream,
  ]);

  // ==========================================================================
  // STOP CAMERA ON COMPONENT UNMOUNT
  // ==========================================================================

  useEffect(() => {
    return () => {
      cameraStream
        ?.getTracks()
        .forEach(
          (track) => {
            track.stop();
          },
        );
    };
  }, [cameraStream]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const resetForm =
    (): void => {
      setFormData(
        initialFormData,
      );

      setFile(null);
      setPhotoPreviewUrl(null);
      setError(null);
    };

  const cleanupUploadedFile =
    async (): Promise<void> => {
      if (
        !uploadedFilePath
      ) {
        return;
      }

      try {
        await filesService.delete(
          uploadedFilePath,
        );

        setUploadedFilePath(
          null,
        );
      } catch (
        cleanupError: unknown
      ) {
        console.error(
          'Failed to remove uploaded file:',
          cleanupError,
        );
      }
    };

  // ==========================================================================
  // CAMERA CLOSE
  // ==========================================================================

  const closeCamera =
    (): void => {
      const video =
        videoRef.current;

      if (video) {
        try {
          video.pause();
        } catch {
          // Ignore.
        }

        video.srcObject =
          null;
      }

      if (cameraStream) {
        cameraStream
          .getTracks()
          .forEach(
            (track) => {
              track.stop();
            },
          );
      }

      setCameraStream(null);
      setCameraReady(false);
      setCameraLoading(false);
      setCameraOpen(false);
    };

  // ==========================================================================
  // MODAL CLOSE
  // ==========================================================================

  const closeModal =
    (): void => {
      closeCamera();
      resetForm();
      onClose();
    };

  const closeWithCleanup =
    async (): Promise<void> => {
      await cleanupUploadedFile();

      closeModal();
    };

  const handleClose =
    (): void => {
      if (isBusy) {
        return;
      }

      void closeWithCleanup();
    };

  const handleDialogClose:
    NonNullable<
      DialogProps['onClose']
    > = (
      _,
      reason,
    ): void => {
      if (
        isBusy ||
        reason ===
          'backdropClick'
      ) {
        return;
      }

      void closeWithCleanup();
    };

  // ==========================================================================
  // INPUT CHANGE
  // ==========================================================================

  const handleChange = (
    event:
      ChangeEvent<HTMLInputElement>,
  ): void => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    );
  };

  // ==========================================================================
  // FILE UPLOAD
  // ==========================================================================

  const handleFileChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
      const selectedFile =
        event.target
          .files?.[0];

      /*
       * Lejojmë të zgjedhet përsëri
       * i njëjti file më vonë.
       */
      event.target.value =
        '';

      if (!selectedFile) {
        return;
      }

      setUploadLoading(
        true,
      );

      setError(null);

      try {
        if (
          uploadedFilePath
        ) {
          await cleanupUploadedFile();
        }

        const uploaded =
          await filesService.upload(
            selectedFile,
          );

        setFile(
          selectedFile,
        );

        setUploadedFilePath(
          uploaded.path,
        );

        // Store only the permanent S3 object key in the form.
        // This is what will be sent to the backend and stored in DB.
        setFormData(
          (previous) => ({
            ...previous,
            photo:
              uploaded.path,
          }),
        );

        // Use the temporary presigned URL only for immediate preview.
        setPhotoPreviewUrl(
          uploaded.url,
        );
      } catch (
        uploadError: unknown
      ) {
        const message =
          uploadError instanceof
          Error
            ? uploadError.message
            : 'Failed to upload photo';

        setError(
          message,
        );

        setFile(null);
        setPhotoPreviewUrl(null);

        setFormData(
          (previous) => ({
            ...previous,
            photo: '',
          }),
        );
      } finally {
        setUploadLoading(
          false,
        );
      }
    };

  // ==========================================================================
  // REQUEST CAMERA
  // ==========================================================================

  const requestCameraPermission =
    async (): Promise<boolean> => {
      setCameraLoading(
        true,
      );

      setCameraReady(
        false,
      );

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
          await navigator
            .mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    'environment',
                },

                width: {
                  ideal:
                    1920,
                },

                height: {
                  ideal:
                    1080,
                },
              },

              audio: false,
            });

        const videoTrack =
          stream
            .getVideoTracks()
            .at(0);

        if (!videoTrack) {
          stream
            .getTracks()
            .forEach(
              (track) => {
                track.stop();
              },
            );

          setError(
            'No camera was found on this device.',
          );

          return false;
        }

        console.log(
          'Camera track:',
          {
            label:
              videoTrack.label,

            enabled:
              videoTrack.enabled,

            muted:
              videoTrack.muted,

            readyState:
              videoTrack.readyState,

            settings:
              videoTrack.getSettings(),
          },
        );

        setCameraStream(
          stream,
        );

        return true;
      } catch (
        cameraError: unknown
      ) {
        console.error(
          'Camera access error:',
          cameraError,
        );

        let message =
          'Could not access the camera.';

        if (
          cameraError instanceof
          DOMException
        ) {
          switch (
            cameraError.name
          ) {
            case 'NotAllowedError':
            case 'SecurityError':
              message =
                'Camera permission was denied. Allow camera access in your browser settings and try again.';
              break;

            case 'NotFoundError':
              message =
                'No camera was found on this device.';
              break;

            case 'NotReadableError':
              message =
                'The camera could not be started. It may already be used by another application.';
              break;

            case 'OverconstrainedError':
              message =
                'The requested camera configuration is not supported by this device.';
              break;

            case 'AbortError':
              message =
                'Camera startup was interrupted. Please try again.';
              break;

            default:
              message =
                cameraError.message ||
                message;
          }
        }

        setError(
          message,
        );

        return false;
      } finally {
        setCameraLoading(
          false,
        );
      }
    };

  // ==========================================================================
  // OPEN CAMERA
  // ==========================================================================

  const openCamera =
    async (): Promise<void> => {
      if (
        isBusy ||
        cameraLoading
      ) {
        return;
      }

      setError(null);
      setCameraReady(
        false,
      );

      /*
       * Hap dialogun PARA se të kërkojmë kamerën.
       * Kështu elementi <video> montohet në DOM
       * përpara lidhjes së MediaStream.
       */
      setCameraOpen(
        true,
      );

      if (
        cameraStream
      ) {
        return;
      }

      const hasPermission =
        await requestCameraPermission();

      if (!hasPermission) {
        setCameraOpen(
          false,
        );
      }
    };

  // ==========================================================================
  // CAPTURE PHOTO
  // ==========================================================================

  const capturePhoto =
    async (): Promise<void> => {
      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      if (
        !video ||
        !canvas
      ) {
        setError(
          'Camera preview is not available.',
        );

        return;
      }

      if (
        !cameraStream ||
        !cameraReady
      ) {
        setError(
          'Camera is not ready yet. Please wait a moment.',
        );

        return;
      }

      if (
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        setCameraReady(
          false,
        );

        setError(
          'Camera preview is not ready yet.',
        );

        return;
      }

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const context =
        canvas.getContext(
          '2d',
        );

      if (!context) {
        setError(
          'Could not prepare the captured image.',
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
            type:
              'image/jpeg',
          },
        );

      setUploadLoading(
        true,
      );

      setError(null);

      try {
        if (
          uploadedFilePath
        ) {
          await cleanupUploadedFile();
        }

        const uploaded =
          await filesService.upload(
            capturedFile,
          );

        setFile(
          capturedFile,
        );

        setUploadedFilePath(
          uploaded.path,
        );

        // Store only the permanent S3 object key in the form.
        setFormData(
          (previous) => ({
            ...previous,
            photo:
              uploaded.path,
          }),
        );

        // Use the temporary presigned URL only for preview.
        setPhotoPreviewUrl(
          uploaded.url,
        );

        closeCamera();
      } catch (
        uploadError: unknown
      ) {
        const message =
          uploadError instanceof
          Error
            ? uploadError.message
            : 'Failed to upload photo';

        setError(
          message,
        );

        setFile(null);
        setPhotoPreviewUrl(null);

        setFormData(
          (previous) => ({
            ...previous,
            photo: '',
          }),
        );
      } finally {
        setUploadLoading(
          false,
        );
      }
    };

  // ==========================================================================
  // REMOVE PHOTO
  // ==========================================================================

  const removePhoto =
    async (): Promise<void> => {
      if (isBusy) {
        return;
      }

      await cleanupUploadedFile();

      setFile(null);

      setFormData(
        (previous) => ({
          ...previous,
          photo: '',
        }),
      );
    };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      setError(null);

      if (
        !containerId?.trim()
      ) {
        setError(
          'Container is required.',
        );

        return;
      }

      const uniqueNumber =
        formData
          .uniqueNumber
          .trim();

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
        Number(
          formData.volume,
        );

      if (
        !uniqueNumber ||
        !name
      ) {
        setError(
          'Unique number and item name are required.',
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

      if (
        !Number.isFinite(
          volume,
        ) ||
        volume <= 0
      ) {
        setError(
          'Volume must be greater than 0.',
        );

        return;
      }

      setLoading(
        true,
      );

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

        /*
         * Upload-i tani është pjesë e item-it,
         * prandaj nuk duhet fshirë gjatë close.
         */
        setUploadedFilePath(
          null,
        );

        closeCamera();

        resetForm();

        onClose();

        onItemCreated?.();
      } catch (
        createError: unknown
      ) {
        const message =
          createError instanceof
          Error
            ? createError.message
            : 'Failed to create item';

        setError(
          message,
        );

        await cleanupUploadedFile();

        setFormData(
          (previous) => ({
            ...previous,
            photo: '',
          }),
        );

        setFile(null);
        setPhotoPreviewUrl(null);
      } finally {
        setLoading(
          false,
        );
      }
    };

  // ==========================================================================
  // INPUT STYLE
  // ==========================================================================

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
      minHeight: 52,

      borderRadius: 2,

      backgroundColor:
        '#ffffff',

      color: '#18181b',

      '& fieldset': {
        borderColor:
          '#c9c9ce',
      },

      '&:hover fieldset': {
        borderColor:
          '#99999f',
      },

      '&.Mui-focused fieldset':
        {
          borderColor:
            '#202024',

          borderWidth: 1.5,
        },

      '&.Mui-disabled': {
        backgroundColor:
          '#f2f2f4',
      },
    },

    '& .MuiOutlinedInput-input':
      {
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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <>
      {/* ==================================================================== */}
      {/* CREATE ITEM DIALOG */}
      {/* ==================================================================== */}

      <Dialog
        open={open}
        onClose={handleDialogClose}
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
          {/* ================================================================ */}
          {/* HEADER */}
          {/* ================================================================ */}

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
            Add Item

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
              Enter item information and optionally attach a photo.
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

          {/* ================================================================ */}
          {/* CONTENT */}
          {/* ================================================================ */}

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

              backgroundColor:
                '#ffffff',
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

                  boxShadow:
                    'none',
                }}
              >
                {error}
              </Alert>
            )}

            <Box
              sx={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap: {
                  xs: 2,
                  sm: 2.25,
                },
              }}
            >
              {/* ============================================================ */}
              {/* GENERAL INFORMATION */}
              {/* ============================================================ */}

              <Box>
                <Typography
                  sx={{
                    mb: 1.25,

                    color:
                      '#333338',

                    fontSize:
                      '0.78rem',

                    fontWeight:
                      800,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '0.05em',
                  }}
                >
                  General information
                </Typography>

                <Box
                  sx={{
                    display:
                      'grid',

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
                    name="uniqueNumber"
                    label="Unique Number"
                    fullWidth
                    required
                    value={
                      formData.uniqueNumber
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    placeholder="e.g. ITEM-001"
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="name"
                    label="Item Name"
                    fullWidth
                    required
                    value={
                      formData.name
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    placeholder="e.g. Electronic Components"
                    sx={
                      inputSx
                    }
                  />
                </Box>
              </Box>

              {/* ============================================================ */}
              {/* PHOTO */}
              {/* ============================================================ */}

              <Box>
                <Typography
                  sx={{
                    mb: 1.25,

                    color:
                      '#333338',

                    fontSize:
                      '0.78rem',

                    fontWeight:
                      800,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '0.05em',
                  }}
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
                      '1px solid #ddddE1',

                    borderRadius:
                      2.5,

                    backgroundColor:
                      '#f8f8f9',
                  }}
                >
                  <Box
                    sx={{
                      display:
                        'flex',

                      flexDirection:
                        {
                          xs: 'column',
                          sm: 'row',
                        },

                      alignItems:
                        {
                          xs: 'stretch',
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
                                size={
                                  18
                                }
                                color="inherit"
                              />
                            )
                          : (
                              <UploadIcon />
                            )
                      }
                      sx={{
                        flex: 1,

                        minHeight:
                          48,

                        justifyContent:
                          'center',

                        minWidth: 0,

                        borderRadius:
                          2,

                        color:
                          '#3f3f44',

                        borderColor:
                          '#c6c6cb',

                        backgroundColor:
                          '#ffffff',

                        fontSize:
                          '0.82rem',

                        fontWeight:
                          700,

                        textTransform:
                          'none',

                        overflow:
                          'hidden',

                        whiteSpace:
                          'nowrap',

                        textOverflow:
                          'ellipsis',

                        '&:hover':
                          {
                            color:
                              '#202024',

                            borderColor:
                              '#9f9fa5',

                            backgroundColor:
                              '#f3f3f5',
                          },
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          minWidth:
                            0,

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
                            : 'Choose Photo'}
                      </Box>

                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                          handleFileChange
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
                                size={
                                  18
                                }
                                color="inherit"
                              />
                            )
                          : (
                              <CameraIcon />
                            )
                      }
                      sx={{
                        minHeight:
                          48,

                        width: {
                          xs: '100%',
                          sm: 'auto',
                        },

                        minWidth: {
                          sm: 160,
                        },

                        px: 2,

                        borderRadius:
                          2,

                        color:
                          '#3f3f44',

                        borderColor:
                          '#c6c6cb',

                        backgroundColor:
                          '#ffffff',

                        fontSize:
                          '0.82rem',

                        fontWeight:
                          700,

                        textTransform:
                          'none',

                        '&:hover':
                          {
                            color:
                              '#202024',

                            borderColor:
                              '#9f9fa5',

                            backgroundColor:
                              '#f3f3f5',
                          },
                      }}
                    >
                      {cameraLoading
                        ? 'Opening...'
                        : 'Take Photo'}
                    </Button>
                  </Box>

                  {/* ======================================================== */}
                  {/* PHOTO PREVIEW */}
                  {/* ======================================================== */}

                  {photoPreviewUrl && (
                    <Box
                      sx={{
                        position:
                          'relative',

                        mt: 2,

                        width:
                          '100%',

                        maxWidth:
                          420,

                        mx: 'auto',

                        p: 1,

                        borderRadius:
                          2,

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
                          'selected item'
                        }`}
                        sx={{
                          display:
                            'block',

                          width:
                            '100%',

                          maxHeight:
                            {
                              xs: 220,
                              sm: 280,
                            },

                          objectFit:
                            'contain',

                          borderRadius:
                            1.5,

                          backgroundColor:
                            '#ffffff',
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
                          right:
                            -10,

                          width: 32,
                          height:
                            32,

                          color:
                            '#444449',

                          backgroundColor:
                            '#ffffff',

                          border:
                            '1px solid #d0d0d4',

                          boxShadow:
                            '0 3px 8px rgba(0,0,0,0.14)',

                          '&:hover':
                            {
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

              {/* ============================================================ */}
              {/* QUANTITY & PRICE */}
              {/* ============================================================ */}

              <Box>
                <Typography
                  sx={{
                    mb: 1.25,

                    color:
                      '#333338',

                    fontSize:
                      '0.78rem',

                    fontWeight:
                      800,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '0.05em',
                  }}
                >
                  Quantity & pricing
                </Typography>

                <Box
                  sx={{
                    display:
                      'grid',

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
                    fullWidth
                    required
                    value={
                      formData.packageQuantity
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    slotProps={{
                      htmlInput:
                        {
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
                    fullWidth
                    required
                    value={
                      formData.productsPerPackage
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    slotProps={{
                      htmlInput:
                        {
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
                    label="Package Price ($)"
                    type="number"
                    fullWidth
                    required
                    value={
                      formData.packagePrice
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    slotProps={{
                      htmlInput:
                        {
                          min: 0,
                          step:
                            0.01,
                        },
                    }}
                    sx={
                      inputSx
                    }
                  />

                  <TextField
                    name="volume"
                    label="Volume (m³)"
                    type="number"
                    fullWidth
                    required
                    value={
                      formData.volume
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      isBusy
                    }
                    slotProps={{
                      htmlInput:
                        {
                          min:
                            0.01,

                          step:
                            0.01,
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

          {/* ================================================================ */}
          {/* ACTIONS */}
          {/* ================================================================ */}

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
                minWidth:
                  110,

                minHeight:
                  46,

                width: {
                  xs: '100%',
                  sm: 'auto',
                },

                px: 2.25,

                borderRadius:
                  2,

                color:
                  '#3d3d42',

                border:
                  '1px solid #c4c4c9',

                backgroundColor:
                  '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight:
                  700,

                textTransform:
                  'none',

                '&:hover': {
                  color:
                    '#202024',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#9f9fa5',
                },
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
                        size={
                          18
                        }
                        color="inherit"
                      />
                    )
                  : undefined
              }
              sx={{
                minWidth:
                  140,

                minHeight:
                  46,

                width: {
                  xs: '100%',
                  sm: 'auto',
                },

                px: 2.5,

                borderRadius:
                  2,

                backgroundColor:
                  '#202024',

                color:
                  '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight:
                  700,

                textTransform:
                  'none',

                boxShadow:
                  'none',

                '&:hover': {
                  backgroundColor:
                    '#111114',

                  boxShadow:
                    'none',
                },

                '&.Mui-disabled':
                  {
                    backgroundColor:
                      '#515156',

                    color:
                      '#eeeeF0',
                  },
              }}
            >
              {loading
                ? 'Adding...'
                : 'Add Item'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ==================================================================== */}
      {/* CAMERA DIALOG */}
      {/* ==================================================================== */}

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

              maxWidth:
                820,

              height: {
                xs: '100dvh',
                sm: 'auto',
              },

              maxHeight: {
                xs: '100dvh',
                sm:
                  'calc(100dvh - 32px)',
              },

              borderRadius:
                {
                  xs: 0,
                  sm: 3,
                },

              backgroundColor:
                '#ffffff',

              overflow:
                'hidden',
            },
          },
        }}
      >
        {/* ================================================================ */}
        {/* CAMERA HEADER */}
        {/* ================================================================ */}

        <DialogTitle
          sx={{
            position:
              'relative',

            px: {
              xs: 2,
              sm: 3,
            },

            pr: {
              xs: 7,
              sm: 7,
            },

            py: {
              xs: 1.5,
              sm: 1.9,
            },

            color:
              '#17171a',

            fontSize: {
              xs: '1.05rem',
              sm: '1.2rem',
            },

            fontWeight:
              800,

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

              fontWeight:
                500,
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

              width: 38,
              height: 38,

              color:
                '#444449',

              '&:hover': {
                color:
                  '#18181b',

                backgroundColor:
                  '#e7e7ea',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* ================================================================ */}
        {/* CAMERA CONTENT */}
        {/* ================================================================ */}

        <DialogContent
          sx={{
            display:
              'flex',

            flexDirection:
              'column',

            p: {
              xs: 1,
              sm: 2,
            },

            backgroundColor:
              '#ffffff',

            overflowY:
              'auto',
          }}
        >
          <Box
            sx={{
              position:
                'relative',

              width: '100%',

              aspectRatio:
                {
                  xs: '3 / 4',
                  sm: '4 / 3',
                  md: '16 / 9',
                },

              maxHeight: {
                xs: '68dvh',
                sm: 540,
              },

              mx: 'auto',

              overflow:
                'hidden',

              borderRadius:
                {
                  xs: 1.5,
                  sm: 2.5,
                },

              border:
                '1px solid #2d2d31',

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
              onLoadedMetadata={(
                event,
              ) => {
                const video =
                  event.currentTarget;

                if (
                  video.videoWidth >
                    0 &&
                  video.videoHeight >
                    0
                ) {
                  setCameraReady(
                    true,
                  );
                }
              }}
              onCanPlay={() => {
                setCameraReady(
                  true,
                );
              }}
              onPlaying={() => {
                setCameraReady(
                  true,
                );
              }}
              style={{
                display:
                  'block',

                width:
                  '100%',

                height:
                  '100%',

                objectFit:
                  'cover',

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

                  zIndex: 2,

                  display:
                    'flex',

                  flexDirection:
                    'column',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  gap: 1.5,

                  px: 3,

                  textAlign:
                    'center',

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

                <Typography
                  sx={{
                    color:
                      '#eeeeF0',

                    fontSize:
                      '0.82rem',

                    fontWeight:
                      600,
                  }}
                >
                  Starting camera...
                </Typography>
              </Box>
            )}

            <canvas
              ref={
                canvasRef
              }
              style={{
                display:
                  'none',
              }}
            />
          </Box>

          {/* ================================================================ */}
          {/* CAMERA ACTIONS */}
          {/* ================================================================ */}

          <Box
            sx={{
              display:
                'flex',

              flexDirection:
                {
                  xs: 'column',
                  sm: 'row',
                },

              justifyContent:
                'center',

              alignItems:
                'stretch',

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
                        size={
                          18
                        }
                        color="inherit"
                      />
                    )
                  : (
                      <CameraIcon />
                    )
              }
              sx={{
                minHeight:
                  48,

                minWidth: {
                  sm: 180,
                },

                px: 2.5,

                borderRadius:
                  2,

                backgroundColor:
                  '#202024',

                color:
                  '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight:
                  700,

                textTransform:
                  'none',

                boxShadow:
                  'none',

                '&:hover': {
                  backgroundColor:
                    '#111114',

                  boxShadow:
                    'none',
                },
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
                minHeight:
                  48,

                minWidth: {
                  sm: 130,
                },

                px: 2.25,

                borderRadius:
                  2,

                color:
                  '#3d3d42',

                borderColor:
                  '#c4c4c9',

                backgroundColor:
                  '#ffffff',

                fontSize:
                  '0.84rem',

                fontWeight:
                  700,

                textTransform:
                  'none',

                '&:hover': {
                  color:
                    '#202024',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#9f9fa5',
                },
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

export default CreateItemModal;