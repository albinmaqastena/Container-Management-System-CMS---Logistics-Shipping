// src/components/containers/CreateContainerModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
} from '@mui/material';
import { useContainers } from '../../contexts/ContainerContext';

interface CreateContainerModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateContainerModal: React.FC<CreateContainerModalProps> = ({
  open,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    customName: '',
    totalVolume: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { createContainer } = useContainers();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.customName.trim() || !formData.totalVolume) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createContainer({
        customName: formData.customName.trim(),
        totalVolume: parseFloat(formData.totalVolume),
        description: formData.description.trim() || undefined,
      });
      onClose();
      setFormData({ customName: '', totalVolume: '', description: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({ customName: '', totalVolume: '', description: '' });
    setError('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Container</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          name="customName"
          label="Container Name"
          fullWidth
          required
          value={formData.customName}
          onChange={handleChange}
          placeholder="e.g., Alpha Container"
        />
        <TextField
          margin="dense"
          name="totalVolume"
          label="Total Volume (m³)"
          type="number"
          fullWidth
          required
          value={formData.totalVolume}
          onChange={handleChange}
          slotProps={{
            htmlInput: { min: 0, step: 0.01 },
          }}
        />
        <TextField
          margin="dense"
          name="description"
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={formData.description}
          onChange={handleChange}
          placeholder="Optional description"
        />
        <Box sx={{ mt: 1 }}>
          <Alert severity="info">
            Container code will be auto-generated based on timestamp and name
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Creating...' : 'Create Container'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};