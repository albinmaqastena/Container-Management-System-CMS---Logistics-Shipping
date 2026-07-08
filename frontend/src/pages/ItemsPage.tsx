// src/pages/ItemsPage.tsx
import React, { useState, useEffect } from 'react';
import { useItems } from '../hooks/useItems';
import { useContainers } from '../hooks/useContainers';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { ItemList } from '../components/items/ItemList';
import { useDebounce } from '../hooks/useDebounce';

export const ItemsPage: React.FC = () => {
  const { items, loading, error, fetchItems, searchItems } = useItems();
  const { containers } = useContainers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      // ✅ Përditësuar: dërgo objekt me containerId
      searchItems(debouncedSearch, { containerId: selectedContainer || undefined })
        .finally(() => setIsSearching(false));
    } else {
      fetchItems(selectedContainer || undefined);
    }
  }, [debouncedSearch, selectedContainer, fetchItems, searchItems]);

  const handleContainerChange = (event: SelectChangeEvent) => {
    setSelectedContainer(event.target.value);
  };

  if (loading && !items.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Items
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Box sx={{ flex: 1, width: '100%' }}>
            <TextField
              fullWidth
              placeholder="Search items by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: isSearching && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, width: '100%' }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Container</InputLabel>
              <Select
                value={selectedContainer}
                onChange={handleContainerChange}
                label="Filter by Container"
              >
                <MenuItem value="">All Containers</MenuItem>
                {containers.map((container) => (
                  <MenuItem key={container.id} value={container.id}>
                    {container.name} ({container.containerCode})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      <ItemList
        items={items}
        loading={loading}
        emptyMessage={searchQuery ? 'No items match your search' : 'No items found'}
      />
    </Box>
  );
};