import type { DialogProps } from '@mui/material';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning';
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  confirmColor = 'primary',
}: ConfirmDialogProps) => {
  const handleClose: NonNullable<DialogProps['onClose']> = (
    _,
    reason,
  ): void => {
    if (
      loading ||
      reason === 'backdropClick' ||
      reason === 'escapeKeyDown'
    ) {
      return;
    }

    onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(3px)',
          },
        },
        paper: {
          sx: {
            mx: {
              xs: 2,
              sm: 3,
            },

            width: '100%',
            maxWidth: 460,

            borderRadius: {
              xs: 3,
              sm: 3.5,
            },

            backgroundColor: '#ffffff',

            border:
              '1px solid rgba(0,0,0,0.07)',

            boxShadow:
              '0 24px 60px rgba(0,0,0,0.16)',

            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: {
            xs: 2.5,
            sm: 3,
          },

          pt: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <DialogTitle
          id="confirm-dialog-title"
          sx={{
            p: 0,

            color: '#181818',

            fontSize: {
              xs: '1.2rem',
              sm: '1.35rem',
            },

            fontWeight: 700,

            lineHeight: 1.3,

            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </DialogTitle>
      </Box>

      {/* Content */}
      <DialogContent
        aria-busy={loading}
        sx={{
          px: {
            xs: 2.5,
            sm: 3,
          },

          pt: {
            xs: 1.25,
            sm: 1.5,
          },

          pb: {
            xs: 2,
            sm: 2.25,
          },
        }}
      >
        <DialogContentText
          id="confirm-dialog-description"
          sx={{
            color: '#707075',

            fontSize: {
              xs: '0.88rem',
              sm: '0.92rem',
            },

            lineHeight: 1.65,
          }}
        >
          {message}
        </DialogContentText>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          px: {
            xs: 2.5,
            sm: 3,
          },

          pb: {
            xs: 2.5,
            sm: 3,
          },

          pt: 0,

          gap: 1,

          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outlined"
          sx={{
            minWidth: 100,

            minHeight: 44,

            px: 2.5,

            borderRadius: 2.25,

            borderColor: '#d8d8dc',

            color: '#55555a',

            backgroundColor: '#ffffff',

            fontSize: '0.88rem',

            fontWeight: 600,

            textTransform: 'none',

            boxShadow: 'none',

            transition:
              'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',

            '&:hover': {
              borderColor: '#b8b8bd',

              backgroundColor: '#f7f7f8',

              color: '#55555a',

              transform: 'translateY(-1px)',
            },

            '&.Mui-disabled': {
              color: '#aaaaae',

              borderColor: '#e4e4e6',

              backgroundColor: '#fafafa',
            },
          }}
        >
          {cancelLabel}
        </Button>

        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          autoFocus
          startIcon={
            loading ? (
              <CircularProgress
                size={18}
                thickness={5}
                color="inherit"
              />
            ) : undefined
          }
          sx={{
            minWidth: 110,

            minHeight: 44,

            px: 2.5,

            borderRadius: 2.25,

            fontSize: '0.88rem',

            fontWeight: 600,

            textTransform: 'none',

            boxShadow: 'none',

            transition:
              'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

            '&:hover': {
              transform: 'translateY(-1px)',

              boxShadow:
                '0 7px 18px rgba(0,0,0,0.13)',
            },

            '&:active': {
              transform: 'translateY(0)',

              boxShadow: 'none',
            },

            '&.Mui-disabled': {
              opacity: 0.65,
            },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};