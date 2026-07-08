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
import { useItems } from '../../hooks/useItems';
import { fileService } from '../../services/file.service';

interface CreateItemModalProps {
  open: boolean;
  onClose: () => void;
  containerId: string;
  onItemCreated?: () => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  open,
  onClose,
  containerId,
  onItemCreated,
}) => {
  const { createItem } = useItems();
  const [formData, setFormData] = useState({
    uniqueNumber: '',
    name: '',
    photo: '',
    packageQuantity: '',
    productsPerPackage: '',
    packagePrice: '',
    volume: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      try {
        const uploaded = await fileService.upload(selectedFile);
        setFormData((prev) => ({ ...prev, photo: uploaded.url }));
      } catch (err) {
        setError('Failed to upload file');
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.uniqueNumber || !formData.name || !formData.packageQuantity ||
        !formData.productsPerPackage || !formData.packagePrice || !formData.volume) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createItem({
        uniqueNumber: formData.uniqueNumber,
        name: formData.name,
        photo: formData.photo || undefined,
        packageQuantity: parseInt(formData.packageQuantity),
        productsPerPackage: parseInt(formData.productsPerPackage),
        packagePrice: parseFloat(formData.packagePrice),
        volume: parseFloat(formData.volume),
        containerId,
      });
      onClose();
      setFormData({
        uniqueNumber: '',
        name: '',
        photo: '',
        packageQuantity: '',
        productsPerPackage: '',
        packagePrice: '',
        volume: '',
      });
      setFile(null);
      if (onItemCreated) onItemCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({
      uniqueNumber: '',
      name: '',
      photo: '',
      packageQuantity: '',
      productsPerPackage: '',
      packagePrice: '',
      volume: '',
    });
    setFile(null);
    setError('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Item to Container</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            name="uniqueNumber"
            label="Unique Number"
            fullWidth
            required
            value={formData.uniqueNumber}
            onChange={handleChange}
            placeholder="e.g., ITEM-001"
          />
          <TextField
            name="name"
            label="Item Name"
            fullWidth
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Electronic Components"
          />
          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ py: 1.5 }}
          >
            {file ? file.name : 'Upload Photo'}
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleFileChange}
            />
          </Button>
          {formData.photo && (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={formData.photo}
                alt="Preview"
                style={{ maxHeight: 100, borderRadius: 4 }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <TextField
              name="packageQuantity"
              label="Package Quantity"
              type="number"
              fullWidth
              required
              value={formData.packageQuantity}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ flex: '1 1 calc(50% - 8px)', minWidth: '200px' }}
            />
            <TextField
              name="productsPerPackage"
              label="Products/Package"
              type="number"
              fullWidth
              required
              value={formData.productsPerPackage}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ flex: '1 1 calc(50% - 8px)', minWidth: '200px' }}
            />
            <TextField
              name="packagePrice"
              label="Package Price ($)"
              type="number"
              fullWidth
              required
              value={formData.packagePrice}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              sx={{ flex: '1 1 calc(50% - 8px)', minWidth: '200px' }}
            />
            <TextField
              name="volume"
              label="Volume per Package (m³)"
              type="number"
              fullWidth
              required
              value={formData.volume}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              sx={{ flex: '1 1 calc(50% - 8px)', minWidth: '200px' }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Adding...' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};