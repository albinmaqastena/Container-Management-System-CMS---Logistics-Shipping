// src/pages/ContainersPage.tsx

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Fab,
  Chip,
} from '@mui/material';

import {
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useContainers } from '../hooks/useContainers';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utilis/constants';
import { ContainerStatus } from '../types';
import type { Container } from '../types';

import { ContainerList } from '../components/containers/ContainerList';
import { CreateContainerModal } from '../components/containers/CreateContainerModal';

import { SearchBar } from '../components/common/UI/SearchBar';
import { useDebounce } from '../hooks/useDebounce';

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({
  children,
  value,
  index,
}: TabPanelProps) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    sx={{
      width: '100%',

      pt: {
        xs: 2.25,
        sm: 2.75,
        md: 3,
      },
    }}
  >
    {value === index && children}
  </Box>
);

export const ContainersPage = () => {
  const [tabValue, setTabValue] = useState(0);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [isSearching, setIsSearching] =
    useState(false);

  const [searchResults, setSearchResults] =
    useState<Container[]>([]);

  const [searchError, setSearchError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const debouncedSearch = useDebounce(
    searchQuery,
    500,
  );

  const {
    activeContainers,
    archivedContainers,
    isLoading,
    error,
    fetchActiveContainers,
    fetchArchivedContainers,
    searchContainers,
    clearError,
  } = useContainers();

  const { user } = useAuth();

  const isAdmin =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.SUPER_ADMIN;

  // Initial load
  useEffect(() => {
    const loadContainers =
      async (): Promise<void> => {
        try {
          await Promise.all([
            fetchActiveContainers(),
            fetchArchivedContainers(),
          ]);
        } catch {
          // Error handled by context/hook
        }
      };

    void loadContainers();
  }, [
    fetchActiveContainers,
    fetchArchivedContainers,
  ]);

  // Search with race condition protection
  useEffect(() => {
    let active = true;

    const performSearch =
      async (): Promise<void> => {
        const query =
          debouncedSearch.trim();

        if (!query) {
          setSearchResults([]);
          setIsSearching(false);
          setSearchError(null);

          return;
        }

        setIsSearching(true);
        setSearchError(null);

        try {
          const response =
            await searchContainers(query);

          if (!active) return;

          const status =
            tabValue === 0
              ? ContainerStatus.ACTIVE
              : ContainerStatus.ARCHIVED;

          setSearchResults(
            response.data.filter(
              (container) =>
                container.status === status,
            ),
          );
        } catch (err) {
          if (!active) return;

          setSearchResults([]);

          setSearchError(
            err instanceof Error
              ? err.message
              : 'Search failed. Please try again.',
          );
        } finally {
          if (active) {
            setIsSearching(false);
          }
        }
      };

    void performSearch();

    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    tabValue,
    searchContainers,
  ]);

  // Display containers based on search and tab
  const containers = useMemo(() => {
    const query = searchQuery.trim();

    if (query) {
      return searchResults;
    }

    return tabValue === 0
      ? activeContainers
      : archivedContainers;
  }, [
    searchQuery,
    searchResults,
    tabValue,
    activeContainers,
    archivedContainers,
  ]);

  const handleTabChange = (
    _: SyntheticEvent,
    newValue: number,
  ) => {
    setTabValue(newValue);
  };

  const handleRefresh =
    async (): Promise<void> => {
      if (refreshing) return;

      setRefreshing(true);

      try {
        await Promise.all([
          fetchActiveContainers(),
          fetchArchivedContainers(),
        ]);
      } catch {
        // Error handled by context/hook
      } finally {
        setRefreshing(false);
      }
    };

  const handleSearchChange = (
    value: string,
  ): void => {
    setSearchQuery(value);
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(
      value.trim().length > 0,
    );
  };

  if (isLoading && !searchQuery) {
    return (
      <Box
        sx={{
          minHeight: {
            xs: 320,
            sm: 420,
          },

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress
          size={38}
          thickness={4}
          sx={{
            color: '#202024',
          }}
        />
      </Box>
    );
  }

  const hasSearchQuery =
    searchQuery.trim().length > 0;

  const isSearchEmpty =
    hasSearchQuery &&
    !isSearching &&
    !searchError &&
    searchResults.length === 0;

  return (
    <Box
      sx={{
        width: '100%',

        px: {
          xs: 0,
          sm: 0.5,
          md: 1,
        },

        pb: {
          xs: 3,
          md: 4,
        },
      }}
    >
      {/* =================================
          HEADER
      ================================== */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          justifyContent: 'space-between',

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          gap: {
            xs: 2,
            sm: 3,
          },

          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              color: '#161619',

              fontSize: {
                xs: '1.45rem',
                sm: '1.65rem',
                md: '1.8rem',
              },

              fontWeight: 800,

              lineHeight: 1.2,

              letterSpacing:
                '-0.03em',
            }}
          >
            Containers
          </Typography>

          <Typography
            sx={{
              mt: 0.5,

              color: '#77777c',

              fontSize: {
                xs: '0.8rem',
                sm: '0.86rem',
              },

              fontWeight: 400,
            }}
          >
            Manage and monitor your
            containers
          </Typography>
        </Box>

        {/* Header Actions */}
        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            justifyContent: {
              xs: 'stretch',
              sm: 'flex-end',
            },

            gap: 1.25,

            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="outlined"
            startIcon={
                refreshing ? (
                <CircularProgress
                    size={16}
                    color="inherit"
                />
                ) : (
                <RefreshIcon />
                )
            }
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
                minHeight: 44,

                px: 2,

                borderRadius: 2.25,

                color: '#2d2d31',

                borderColor: '#c9c9ce',

                backgroundColor: '#ffffff',

                fontSize: '0.84rem',

                fontWeight: 700,

                flex: {
                xs: 1,
                sm: 'initial',
                },

                whiteSpace: 'nowrap',

                boxShadow:
                '0 2px 6px rgba(0,0,0,0.04)',

                transition:
                'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                '&:hover': {
                color: '#1b1b1f',

                borderColor: '#9f9fa5',

                backgroundColor: '#f4f4f5',

                transform: 'translateY(-1px)',

                boxShadow:
                    '0 5px 12px rgba(0,0,0,0.08)',
                },

                '&.Mui-disabled': {
                color: '#4a4a4f',

                borderColor: '#bfc0c5',

                backgroundColor: '#ededf0',

                opacity: 1,

                boxShadow: 'none',
                },

                '&.Mui-disabled .MuiButton-startIcon': {
                color: '#4a4a4f',
                },
            }}
            >
            {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </Button>

          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                setIsModalOpen(true)
              }
              sx={{
                minHeight: 44,

                px: {
                  xs: 2,
                  sm: 2.25,
                },

                borderRadius: 2.25,

                backgroundColor:
                  '#202024',

                color: '#ffffff',

                fontSize: '0.84rem',

                fontWeight: 700,

                flex: {
                  xs: 1,
                  sm: 'initial',
                },

                whiteSpace: 'nowrap',

                boxShadow:
                  '0 5px 14px rgba(0,0,0,0.12)',

                transition:
                  'transform 0.18s ease, box-shadow 0.18s ease',

                '&:hover': {
                  backgroundColor:
                    '#202024',

                  color: '#ffffff',

                  transform:
                    'translateY(-1px)',

                  boxShadow:
                    '0 8px 18px rgba(0,0,0,0.16)',
                },
              }}
            >
              Create Container
            </Button>
          )}
        </Box>
      </Box>

      {/* =================================
          SEARCH
      ================================== */}
      <Box
        sx={{
          position: 'relative',

          mb: {
            xs: 2,
            sm: 2.5,
          },
        }}
      >
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search containers by name or code..."
          disabled={
            isLoading || refreshing
          }
        />

        {isSearching && (
          <CircularProgress
            size={19}
            thickness={4}
            sx={{
              position: 'absolute',

              right: {
                xs: 48,
                sm: 54,
              },

              top: '50%',

              transform:
                'translateY(-50%)',

              color: '#55555a',
            }}
          />
        )}
      </Box>

      {/* =================================
          ERRORS
      ================================== */}
      {(error || searchError) && (
        <Alert
          severity="error"
          onClose={() => {
            clearError();
            setSearchError(null);
          }}
          sx={{
            mb: 2.5,

            borderRadius: 2.25,

            border:
              '1px solid rgba(195,50,60,0.16)',

            boxShadow:
              '0 4px 12px rgba(0,0,0,0.035)',
          }}
        >
          {searchError || error}
        </Alert>
      )}

      {/* =================================
          TABS
      ================================== */}
      <Box
        sx={{
          display: 'flex',

          alignItems: 'center',

          borderBottom:
            '1px solid #dedee1',

          overflowX: 'auto',

          overflowY: 'hidden',

          WebkitOverflowScrolling:
            'touch',

          '&::-webkit-scrollbar': {
            display: 'none',
          },

          scrollbarWidth: 'none',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            minHeight: 48,

            '& .MuiTabs-indicator': {
              height: 2,

              borderRadius: 999,

              backgroundColor:
                '#202024',
            },

            '& .MuiTab-root': {
              minHeight: 48,

              minWidth: 'auto',

              px: {
                xs: 1.25,
                sm: 1.75,
              },

              mr: {
                xs: 1,
                sm: 1.5,
              },

              color: '#77777c',

              fontSize: {
                xs: '0.8rem',
                sm: '0.84rem',
              },

              fontWeight: 600,

              textTransform: 'none',

              transition:
                'color 0.18s ease',

              '&:hover': {
                color: '#333337',

                backgroundColor:
                  'transparent',
              },

              '&.Mui-selected': {
                color: '#18181b',

                fontWeight: 700,
              },
            },
          }}
        >
          <Tab
            label={
              <Box
                sx={{
                  display: 'flex',

                  alignItems: 'center',

                  gap: 0.9,
                }}
              >
                Active

                <Chip
                  label={
                    activeContainers.length
                  }
                  size="small"
                  color="success"
                  sx={{
                    minWidth: 25,

                    height: 23,

                    borderRadius: 1.5,

                    fontSize: '0.67rem',

                    fontWeight: 700,

                    '& .MuiChip-label': {
                      px: 0.85,
                    },
                  }}
                />
              </Box>
            }
          />

          <Tab
            label={
              <Box
                sx={{
                  display: 'flex',

                  alignItems: 'center',

                  gap: 0.9,
                }}
              >
                Archived

                <Chip
                  label={
                    archivedContainers.length
                  }
                  size="small"
                  color="default"
                  sx={{
                    minWidth: 25,

                    height: 23,

                    borderRadius: 1.5,

                    fontSize: '0.67rem',

                    fontWeight: 700,

                    backgroundColor:
                      '#e4e4e7',

                    color: '#444448',

                    '& .MuiChip-label': {
                      px: 0.85,
                    },
                  }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* =================================
          ACTIVE TAB
      ================================== */}
      <TabPanel
        value={tabValue}
        index={0}
      >
        {isSearching &&
        hasSearchQuery ? (
          <Box
            sx={{
              minHeight: 220,

              display: 'flex',

              flexDirection: 'column',

              alignItems: 'center',

              justifyContent: 'center',

              gap: 1.5,
            }}
          >
            <CircularProgress
              size={30}
              thickness={4}
              sx={{
                color: '#202024',
              }}
            />

            <Typography
              sx={{
                color: '#77777c',

                fontSize: '0.82rem',

                fontWeight: 500,
              }}
            >
              Searching containers...
            </Typography>
          </Box>
        ) : (
          <ContainerList
            containers={containers}
            emptyMessage={
              isSearchEmpty
                ? 'No containers match your search'
                : 'No active containers found'
            }
          />
        )}

        {isAdmin &&
          !hasSearchQuery &&
          containers.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',

                mt: 2,
              }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() =>
                  setIsModalOpen(true)
                }
                sx={{
                  minHeight: 44,

                  px: 2.5,

                  borderRadius: 2.25,

                  backgroundColor:
                    '#202024',

                  color: '#ffffff',

                  fontWeight: 600,

                  '&:hover': {
                    backgroundColor:
                      '#202024',

                    color: '#ffffff',

                    transform:
                      'translateY(-1px)',
                  },
                }}
              >
                Create your first
                container
              </Button>
            </Box>
          )}
      </TabPanel>

      {/* =================================
          ARCHIVED TAB
      ================================== */}
      <TabPanel
        value={tabValue}
        index={1}
      >
        {isSearching &&
        hasSearchQuery ? (
          <Box
            sx={{
              minHeight: 220,

              display: 'flex',

              flexDirection: 'column',

              alignItems: 'center',

              justifyContent: 'center',

              gap: 1.5,
            }}
          >
            <CircularProgress
              size={30}
              thickness={4}
              sx={{
                color: '#202024',
              }}
            />

            <Typography
              sx={{
                color: '#77777c',

                fontSize: '0.82rem',

                fontWeight: 500,
              }}
            >
              Searching containers...
            </Typography>
          </Box>
        ) : (
          <ContainerList
            containers={containers}
            emptyMessage={
              isSearchEmpty
                ? 'No containers match your search'
                : 'No archived containers found'
            }
          />
        )}
      </TabPanel>

      {/* =================================
          MOBILE FAB
      ================================== */}
      {isAdmin && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() =>
            setIsModalOpen(true)
          }
          sx={{
            position: 'fixed',

            right: {
              xs: 18,
              sm: 24,
            },

            bottom: {
              xs: 18,
              sm: 24,
            },

            display: {
              xs: 'flex',
              md: 'none',
            },

            width: 54,
            height: 54,

            backgroundColor: '#202024',

            color: '#ffffff',

            border:
              '1px solid rgba(255,255,255,0.10)',

            boxShadow:
              '0 10px 24px rgba(0,0,0,0.22)',

            '&:hover': {
              backgroundColor: '#202024',

              color: '#ffffff',

              transform: 'scale(1.04)',
            },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* =================================
          CREATE CONTAINER MODAL
      ================================== */}
      <CreateContainerModal
        open={isModalOpen}
        onClose={() =>
          setIsModalOpen(false)
        }
      />
    </Box>
  );
};

export default ContainersPage;