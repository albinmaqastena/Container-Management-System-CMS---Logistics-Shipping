// src/components/items/ItemSearch.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useDebounce } from '../../hooks/useDebounce';
import { itemService } from '../../services/item.service';
import { Item } from '../../types';

interface ItemSearchProps {
  onSelect?: (item: Item) => void;
  containerId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const ItemSearch: React.FC<ItemSearchProps> = ({
  onSelect,
  containerId,
  placeholder = 'Search items...',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // ✅ itemService.search tani pret params objekt
        const response = await itemService.search(debouncedQuery, {
          containerId: containerId || undefined,
          limit: 10, // Kufizojmë rezultatet për dropdown
        });
        // ✅ Marrim vetëm të dhënat (data) nga response
        setResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, containerId]);

  const handleSelect = (item: Item) => {
    setQuery(item.name);
    setShowResults(false);
    if (onSelect) onSelect(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleBlur = () => {
    setTimeout(() => setShowResults(false), 200);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        fullWidth
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {loading && <CircularProgress size={20} />}
                {query && !loading && (
                  <IconButton size="small" onClick={handleClear}>
                    <ClearIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          },
        }}
      />

      {showResults && results.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            maxHeight: 300,
            overflow: 'auto',
            zIndex: 10,
            boxShadow: 3,
          }}
        >
          <List dense>
            {results.map((item) => (
              <ListItem
                key={item.id}
                component="button"
                onClick={() => handleSelect(item)}
                sx={{
                  '&:hover': { bgcolor: 'action.hover' },
                  textAlign: 'left',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <ListItemText
                  primary={item.name}
                  secondary={`${item.uniqueNumber} • ${item.totalVolume.toFixed(2)} m³`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {showResults && query && !loading && results.length === 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            p: 2,
            zIndex: 10,
            boxShadow: 3,
          }}
        >
          <Typography color="textSecondary" align="center">
            No items found
          </Typography>
        </Paper>
      )}
    </Box>
  );
};