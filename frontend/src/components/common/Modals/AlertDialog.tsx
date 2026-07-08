// src/components/common/Modals/AlertDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  title,
  message,
  onClose,
  buttonText = 'OK',
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          {buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};