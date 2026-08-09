// src/pages/ItemsPage.tsx

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material';

import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';

import {
  Search as SearchIcon,
} from '@mui/icons-material';

import type { Item } from '../types';

import { useItems } from '../hooks/useItems';
import { useContainers } from '../hooks/useContainers';
import { ItemList } from '../components/items/ItemList';
import { useDebounce } from '../hooks/useDebounce';

export const ItemsPage = () => {
  const {
    items,
    isLoading,
    error,
    fetchItems,
    searchItems,
  } = useItems();

  const {
    activeContainers,
    fetchActiveContainers,
  } = useContainers();

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    selectedContainer,
    setSelectedContainer,
  ] = useState('');

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const [
    searchResults,
    setSearchResults,
  ] = useState<Item[]>([]);

  const debouncedSearch =
    useDebounce(searchQuery, 500);

  // Ngarko containers nëse nuk janë të ngarkuar
  useEffect(() => {
    if (
      activeContainers.length === 0
    ) {
      void fetchActiveContainers();
    }
  }, [
    activeContainers.length,
    fetchActiveContainers,
  ]);

  // Efekti i kërkimit me mbrojtje nga race condition
  useEffect(() => {
    let active = true;

    const loadItems =
      async (): Promise<void> => {
        const query =
          debouncedSearch.trim();

        try {
          if (query) {
            const response =
              await searchItems(
                query,
                {
                  containerId:
                    selectedContainer ||
                    undefined,
                },
              );

            if (!active) {
              return;
            }

            setSearchResults(
              response.data,
            );
          } else {
            setSearchResults([]);

            await fetchItems({
              containerId:
                selectedContainer ||
                undefined,
            });
          }
        } catch {
          if (active) {
            setSearchResults([]);
          }

          // Error handled by context
        } finally {
          if (active) {
            setIsSearching(false);
          }
        }
      };

    void loadItems();

    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    selectedContainer,
    fetchItems,
    searchItems,
  ]);

  const handleContainerChange = (
    event: SelectChangeEvent,
  ): void => {
    setSelectedContainer(
      event.target.value,
    );

    // Nëse ka një kërkim aktiv, shfaq spinner gjatë kërkimit të ri
    if (searchQuery.trim()) {
      setIsSearching(true);
    }
  };

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const value =
      event.target.value;

    setSearchQuery(value);

    if (!value.trim()) {
      setSearchResults([]);
    }

    setIsSearching(
      value.trim().length > 0,
    );
  };

  // Page-level loading për initial load
  if (
    isLoading &&
    items.length === 0
  ) {
    return (
      <Box
        sx={{
          minHeight: {
            xs: 300,
            sm: 400,
          },

          display: 'flex',

          alignItems: 'center',

          justifyContent:
            'center',

          width: '100%',
        }}
      >
        <CircularProgress
          size={34}
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

  const displayedItems =
    hasSearchQuery
      ? searchResults
      : items;

  return (
    <Box
      sx={{
        width: '100%',

        minWidth: 0,

        px: {
          xs: 0,
          sm: 0,
        },

        py: {
          xs: 1,
          sm: 1.5,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Typography
          component="h1"
          sx={{
            color: '#18181b',

            fontSize: {
              xs: '1.7rem',
              sm: '2rem',
              md: '2.2rem',
            },

            fontWeight: 750,

            lineHeight: 1.15,

            letterSpacing:
              '-0.035em',
          }}
        >
          Items
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mt: 0.75,

            color: '#71717a',

            fontSize: {
              xs: '0.84rem',
              sm: '0.9rem',
            },

            lineHeight: 1.6,
          }}
        >
          Search and manage items across your containers.
        </Typography>
      </Box>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2.5,

            border:
              '1px solid #fecaca',

            borderRadius: 2,

            backgroundColor:
              '#fff7f7',

            color: '#991b1b',

            '& .MuiAlert-icon': {
              color: '#dc2626',
            },
          }}
        >
          {error}
        </Alert>
      )}

      {/* Search + Filter */}
      <Paper
        elevation={0}
        sx={{
          mb: {
            xs: 2.5,
            sm: 3,
          },

          p: {
            xs: 1.5,
            sm: 2,
          },

          border:
            '1px solid #dedee2',

          borderRadius: 2.5,

          backgroundColor:
            '#ffffff',

          boxShadow:
            '0 4px 16px rgba(0,0,0,0.035)',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            flexDirection: {
              xs: 'column',
              md: 'row',
            },

            alignItems: {
              xs: 'stretch',
              md: 'center',
            },

            gap: {
              xs: 1.5,
              sm: 2,
            },
          }}
        >
          {/* Search */}
          <Box
            sx={{
              flex: 1,

              minWidth: 0,

              width: '100%',
            }}
          >
            <TextField
              fullWidth
              placeholder="Search items by name or code..."
              value={searchQuery}
              onChange={
                handleSearchChange
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{
                          color:
                            '#71717a',

                          fontSize: 21,
                        }}
                      />
                    </InputAdornment>
                  ),

                  endAdornment:
                    isSearching ? (
                      <InputAdornment position="end">
                        <CircularProgress
                          size={18}
                          thickness={4}
                          sx={{
                            color:
                              '#52525b',
                          }}
                        />
                      </InputAdornment>
                    ) : undefined,
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root':
                  {
                    minHeight: 50,

                    borderRadius: 2.25,

                    backgroundColor:
                      '#ffffff',

                    color:
                      '#18181b',

                    transition:
                      'border-color 0.2s ease, box-shadow 0.2s ease',

                    '& fieldset': {
                      borderColor:
                        '#c9c9ce',
                    },

                    '&:hover fieldset':
                      {
                        borderColor:
                          '#9f9fa5',
                      },

                    '&.Mui-focused fieldset':
                      {
                        borderColor:
                          '#202024',

                        borderWidth: 1.5,
                      },

                    '&.Mui-focused': {
                      boxShadow:
                        '0 0 0 3px rgba(32,32,36,0.06)',
                    },
                  },

                '& .MuiInputBase-input':
                  {
                    fontSize: {
                      xs: '16px',
                      sm: '0.9rem',
                    },

                    fontWeight: 500,

                    color:
                      '#18181b',

                    WebkitTextFillColor:
                      '#18181b',

                    '&::placeholder':
                      {
                        color:
                          '#8b8b91',

                        opacity: 1,
                      },
                  },
              }}
            />
          </Box>

          {/* Container Filter */}
          <Box
            sx={{
              flex: 1,

              minWidth: 0,

              width: '100%',
            }}
          >
            <FormControl
              fullWidth
              sx={{
                '& .MuiInputLabel-root':
                  {
                    color:
                      '#66666c',

                    fontSize: {
                      xs: '0.9rem',
                      sm: '0.86rem',
                    },

                    fontWeight: 600,

                    backgroundColor:
                      '#ffffff',

                    px: 0.5,
                  },

                '& .MuiInputLabel-root.Mui-focused':
                  {
                    color:
                      '#202024',
                  },

                '& .MuiOutlinedInput-root':
                  {
                    minHeight: 50,

                    borderRadius: 2.25,

                    backgroundColor:
                      '#ffffff',

                    color:
                      '#18181b',

                    transition:
                      'border-color 0.2s ease, box-shadow 0.2s ease',

                    '& fieldset': {
                      borderColor:
                        '#c9c9ce',
                    },

                    '&:hover fieldset':
                      {
                        borderColor:
                          '#9f9fa5',
                      },

                    '&.Mui-focused fieldset':
                      {
                        borderColor:
                          '#202024',

                        borderWidth: 1.5,
                      },

                    '&.Mui-focused': {
                      boxShadow:
                        '0 0 0 3px rgba(32,32,36,0.06)',
                    },
                  },

                '& .MuiSelect-select':
                  {
                    display: 'flex',

                    alignItems:
                      'center',

                    minWidth: 0,

                    color:
                      '#202024',

                    fontSize: {
                      xs: '16px',
                      sm: '0.9rem',
                    },

                    fontWeight: 600,
                  },

                '& .MuiSelect-icon':
                  {
                    color:
                      '#66666b',
                  },
              }}
            >
              <InputLabel
                id="container-filter-label"
                shrink
              >
                Filter by Container
              </InputLabel>

              <Select
                labelId="container-filter-label"
                value={
                  selectedContainer
                }
                onChange={
                  handleContainerChange
                }
                label="Filter by Container"
                displayEmpty
                renderValue={(value) => {
                  if (!value) {
                    return (
                      <Typography
                        component="span"
                        sx={{
                          color:
                            '#202024',

                          fontSize: {
                            xs: '16px',
                            sm: '0.9rem',
                          },

                          fontWeight:
                            600,

                          overflow:
                            'hidden',

                          textOverflow:
                            'ellipsis',

                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        All Containers
                      </Typography>
                    );
                  }

                  const selected =
                    activeContainers.find(
                      (container) =>
                        container.id ===
                        value,
                    );

                  return selected ? (
                    <Typography
                      component="span"
                      sx={{
                        color:
                          '#202024',

                        fontSize: {
                          xs: '16px',
                          sm: '0.9rem',
                        },

                        fontWeight:
                          600,

                        overflow:
                          'hidden',

                        textOverflow:
                          'ellipsis',

                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {selected.name}{' '}
                      (
                      {
                        selected.containerCode
                      }
                      )
                    </Typography>
                  ) : (
                    <Typography
                      component="span"
                      sx={{
                        color:
                          '#202024',

                        fontSize: {
                          xs: '16px',
                          sm: '0.9rem',
                        },

                        fontWeight:
                          600,
                      }}
                    >
                      All Containers
                    </Typography>
                  );
                }}
                MenuProps={{
                  slotProps: {
                    paper: {
                      sx: {
                        mt: 0.75,

                        maxHeight:
                          320,

                        borderRadius:
                          2,

                        border:
                          '1px solid #d1d1d5',

                        backgroundColor:
                          '#ffffff',

                        boxShadow:
                          '0 12px 28px rgba(0,0,0,0.12)',

                        '& .MuiMenuItem-root':
                          {
                            minHeight:
                              44,

                            mx: 0.75,

                            my: 0.25,

                            px: 1.5,

                            borderRadius:
                              1.5,

                            color:
                              '#27272a',

                            fontSize:
                              '0.9rem',

                            fontWeight:
                              500,

                            transition:
                              'background-color 0.15s ease',

                            '&:hover':
                              {
                                backgroundColor:
                                  '#f4f4f5',
                              },

                            '&.Mui-selected':
                              {
                                backgroundColor:
                                  '#ededf0',

                                color:
                                  '#18181b',

                                fontWeight:
                                  700,
                              },

                            '&.Mui-selected:hover':
                              {
                                backgroundColor:
                                  '#e5e5e8',
                              },
                          },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">
                  All Containers
                </MenuItem>

                {activeContainers.map(
                  (container) => (
                    <MenuItem
                      key={
                        container.id
                      }
                      value={
                        container.id
                      }
                    >
                      {container.name}{' '}
                      (
                      {
                        container.containerCode
                      }
                      )
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      {/* Results */}
      <Box
        sx={{
          width: '100%',

          minWidth: 0,
        }}
      >
        {isSearching &&
        hasSearchQuery ? (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              minHeight: {
                xs: 200,
                sm: 230,
              },

              width: '100%',

              display: 'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 1.5,

              border:
                '1px dashed #d8d8dc',

              borderRadius: 2.5,

              backgroundColor:
                '#ffffff',
            }}
          >
            <CircularProgress
              size={30}
              thickness={4}
              sx={{
                color: '#404045',
              }}
            />

            <Typography
              sx={{
                color: '#626267',

                fontSize: {
                  xs: '0.8rem',
                  sm: '0.84rem',
                },

                fontWeight: 600,
              }}
            >
              Searching items...
            </Typography>
          </Box>
        ) : (
          <ItemList
            items={
              displayedItems
            }
            loading={
              isLoading
            }
            emptyMessage={
              hasSearchQuery
                ? 'No items match your search'
                : 'No items found'
            }
          />
        )}
      </Box>
    </Box>
  );
};

export default ItemsPage;