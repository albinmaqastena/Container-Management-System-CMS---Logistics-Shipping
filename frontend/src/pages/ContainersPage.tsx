// src/pages/ContainersPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContainers } from '../contexts/ContainerContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Fab,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ContainerList } from '../components/containers/ContainerList';
import { CreateContainerModal } from '../components/containers/CreateContainerModal';
import { useDebounce } from '../hooks/useDebounce';
import { Container } from '../types'; // ✅ Shto importin e Container

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

export const ContainersPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Container[]>([]); // ✅ Përdor Container[]
  
  const debouncedSearch = useDebounce(searchQuery, 500);
  const { 
    activeContainers, 
    archivedContainers, 
    loading, 
    error, 
    fetchActiveContainers,
    fetchArchivedContainers,
    searchContainers,
    clearError,
  } = useContainers();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    fetchActiveContainers();
    fetchArchivedContainers();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearch.trim()) {
        setIsSearching(true);
        try {
          // ✅ searchContainers kthen PaginatedResponse<Container>
          const results = await searchContainers(debouncedSearch);
          // ✅ Marrim vetëm array-in e containers
          setSearchResults(results.data);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    performSearch();
  }, [debouncedSearch, searchContainers]); // ✅ Shto varësinë

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    fetchActiveContainers();
    fetchArchivedContainers();
  };

  const displayContainers = () => {
    if (searchQuery.trim() && searchResults.length > 0) {
      return searchResults;
    }
    return tabValue === 0 ? activeContainers : archivedContainers;
  };

  const containers = displayContainers();

  if (loading && !searchQuery) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Containers</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
            >
              Create Container
            </Button>
          )}
        </Box>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search containers by name or code..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
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

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Active
              <Chip label={activeContainers.length} size="small" color="success" />
            </Box>
          } 
        />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Archived
              <Chip label={archivedContainers.length} size="small" color="default" />
            </Box>
          } 
        />
      </Tabs>

      {/* Tab Panels - ✅ Përdor ContainerList */}
      <TabPanel value={tabValue} index={0}>
        <ContainerList
          containers={containers}
          isArchived={false}
          emptyMessage={searchQuery.trim() ? 'No containers match your search' : 'No active containers found'}
        />
        {isAdmin && !searchQuery.trim() && containers.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
            >
              Create your first container
            </Button>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ContainerList
          containers={containers}
          isArchived={true}
          emptyMessage={searchQuery.trim() ? 'No containers match your search' : 'No archived containers found'}
        />
      </TabPanel>

      {/* FAB for mobile */}
      {isAdmin && (
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: { xs: 'flex', md: 'none' },
          }}
          onClick={() => setIsModalOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create Container Modal */}
      <CreateContainerModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Box>
  );
};