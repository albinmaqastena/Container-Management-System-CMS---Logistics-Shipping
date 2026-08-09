// src/components/common/Modals/AlertDialog.tsx

import type { DialogProps } from '@mui/material';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from '@mui/material';

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export const AlertDialog = ({
  open,
  title,
  message,
  onClose,
  buttonText = 'OK',
}: AlertDialogProps) => {
  const handleClose: NonNullable<DialogProps['onClose']> = (
    _,
    reason,
  ): void => {
    if (reason === 'backdropClick') {
      return;
    }

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
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
            maxWidth: 440,

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
          id="alert-dialog-title"
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

      <DialogContent
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
          id="alert-dialog-description"
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

          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          autoFocus
          disableElevation
          sx={{
            minWidth: 100,

            minHeight: 44,

            px: 2.5,

            borderRadius: 2.25,

            backgroundColor: '#202020',

            color: '#ffffff',

            fontSize: '0.88rem',

            fontWeight: 600,

            textTransform: 'none',

            boxShadow: 'none',

            transition:
              'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

            '&:hover': {
              backgroundColor: '#111111',

              transform: 'translateY(-1px)',

              boxShadow:
                '0 7px 18px rgba(0,0,0,0.13)',
            },

            '&:active': {
              transform: 'translateY(0)',
              boxShadow: 'none',
            },
          }}
        >
          {buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};