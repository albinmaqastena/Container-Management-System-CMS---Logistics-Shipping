// src/pages/ContainerDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContainers } from '../contexts/ContainerContext';
import { useItems } from '../contexts/ItemContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Container } from '../types';
import { CreateItemModal } from '../components/items/CreateItemModal';
import { ItemCard } from '../components/items/ItemCard';
import { toast } from 'react-toastify';

export const ContainerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getContainer, updateContainerStatus, softDeleteContainer, loading } = useContainers();
  const { items, fetchItems, softDeleteItem, loading: itemsLoading } = useItems(); // ✅ përdor softDeleteItem

  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState('');
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<any[]>([]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (id) {
      loadContainer();
    }
  }, [id]);

  useEffect(() => {
    if (items.length > 0) {
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.uniqueNumber.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems([]);
    }
  }, [searchQuery, items]);

  const loadContainer = async () => {
    try {
      setError('');
      const data = await getContainer(id!);
      setContainer(data);
      await fetchItems(id); // fetchItems pret containerId opsional
    } catch (err: any) {
      setError(err.message || 'Failed to load container');
    }
  };

  const handleStatusChange = async () => {
    if (!container) return;
    const newStatus = container.status === 'active' ? 'archived' : 'active';
    try {
      const updated = await updateContainerStatus(container.id, newStatus);
      setContainer(updated);
      toast.success(`Container ${newStatus === 'active' ? 'activated' : 'archived'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!container) return;
    if (window.confirm('Are you sure you want to delete this container?')) {
      try {
        await softDeleteContainer(container.id);
        toast.success('Container deleted');
        navigate('/containers');
      } catch (error) {
        toast.error('Failed to delete container');
      }
    }
  };

  // ✅ Përdor softDeleteItem për fshirjen e item-it
  const handleItemDeleted = async (itemId: string) => {
    try {
      await softDeleteItem(itemId);
      // Përditëso listën lokale
      setFilteredItems((prev) => prev.filter((item) => item.id !== itemId));
      // Riload container për të përditësuar volume
      await loadContainer();
      toast.success('Item deleted');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  if (loading || !container) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const usagePercentage = (container.usedVolume / container.totalVolume) * 100;
  const availableVolume = container.totalVolume - container.usedVolume;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/containers')}>
          Back
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={loadContainer} title="Refresh">
            <RefreshIcon />
          </IconButton>
          {isAdmin && (
            <>
              <IconButton
                color={container.status === 'active' ? 'default' : 'primary'}
                onClick={handleStatusChange}
                title={container.status === 'active' ? 'Archive' : 'Activate'}
              >
                {container.status === 'active' ? <ArchiveIcon /> : <UnarchiveIcon />}
              </IconButton>
              <IconButton
                color="error"
                onClick={handleDelete}
                title="Delete"
              >
                <DeleteIcon />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Container Info - Përdor Box me flex në vend të Grid */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" gutterBottom>
              {container.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Code: {container.containerCode}
            </Typography>
            {container.description && (
              <Typography variant="body1" sx={{ mt: 1 }}>
                {container.description}
              </Typography>
            )}
            <Box sx={{ mt: 2 }}>
              <Chip
                label={container.status}
                color={container.status === 'active' ? 'success' : 'default'}
                size="medium"
              />
              <Chip
                label={`${container.items?.length || 0} items`}
                color="primary"
                size="medium"
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>
          <Box sx={{ flex: '0 0 300px' }}>
            <Typography variant="body2" color="textSecondary">
              Volume Usage
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2">
                {container.usedVolume.toFixed(2)} / {container.totalVolume.toFixed(2)} m³
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {usagePercentage.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(usagePercentage, 100)}
              sx={{ mt: 1, height: 8, borderRadius: 4 }}
              color={usagePercentage > 90 ? 'error' : usagePercentage > 70 ? 'warning' : 'primary'}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Available: {availableVolume.toFixed(2)} m³
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Items Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5">Items</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search items..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsCreateItemModalOpen(true)}
              >
                Add Item
              </Button>
            )}
          </Box>
        </Box>

        {itemsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="textSecondary">
              {searchQuery ? 'No items match your search' : 'No items in this container yet'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {filteredItems.map((item) => (
              <Box key={item.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.33% - 16px)' } }}>
                <ItemCard 
                  item={item} 
                  onDelete={handleItemDeleted}
                />
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Create Item Modal */}
      <CreateItemModal
        open={isCreateItemModalOpen}
        onClose={() => setIsCreateItemModalOpen(false)}
        containerId={container.id}
        onItemCreated={() => {
          loadContainer();
        }}
      />
    </Box>
  );
};