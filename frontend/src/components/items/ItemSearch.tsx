// src/components/items/ItemSearch.tsx

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ChangeEvent,
  KeyboardEvent,
} from 'react';

import type { Item } from '../../types';

import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';

import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import { useDebounce } from '../../hooks/useDebounce';
import { itemService } from '../../services/item.service';

interface ItemSearchProps {
  onSelect?: (item: Item) => void;
  containerId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

const normalizeVolume = (
  value: unknown,
): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : 0;
};

export const ItemSearch = ({
  onSelect,
  containerId,
  placeholder = 'Search items...',
  autoFocus = false,
}: ItemSearchProps) => {
  const [query, setQuery] =
    useState('');

  const [results, setResults] =
    useState<Item[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [showResults, setShowResults] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [activeIndex, setActiveIndex] =
    useState(-1);

  const debouncedQuery =
    useDebounce(query, 300);

  const containerRef =
    useRef<HTMLDivElement>(null);

  const listRef =
    useRef<HTMLUListElement>(null);

  // Mbyll dropdown-in kur klikohet jashtë
  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setShowResults(false);
        setActiveIndex(-1);
      }
    };

    if (showResults) {
      document.addEventListener(
        'mousedown',
        handleClickOutside,
      );
    }

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, [showResults]);

  // Scroll active element into view
  useEffect(() => {
    if (
      activeIndex >= 0 &&
      listRef.current
    ) {
      const activeElement =
        listRef.current.querySelector(
          `[data-option-index="${activeIndex}"]`,
        ) as HTMLElement | null;

      if (activeElement) {
        activeElement.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    let active = true;

    const performSearch =
      async (): Promise<void> => {
        const normalizedQuery =
          debouncedQuery.trim();

        if (
          normalizedQuery.length < 2
        ) {
          setResults([]);
          setShowResults(false);
          setLoading(false);
          setError(null);
          setActiveIndex(-1);
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const response =
            await itemService.search(
              normalizedQuery,
              {
                containerId:
                  containerId ||
                  undefined,
                limit: 10,
              },
            );

          if (!active) return;

          setResults(response.data);
          setShowResults(true);
          setActiveIndex(-1);
        } catch {
          if (!active) return;

          setResults([]);
          setError(
            'Failed to search items',
          );
          setShowResults(true);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void performSearch();

    return () => {
      active = false;
    };
  }, [
    debouncedQuery,
    containerId,
  ]);

  const handleQueryChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    setQuery(event.target.value);
    setActiveIndex(-1);
  };

  const handleSelect = (
    item: Item,
  ): void => {
    setQuery(item.name);
    setShowResults(false);
    setActiveIndex(-1);
    onSelect?.(item);
  };

  const handleClear = (): void => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setActiveIndex(-1);
    setError(null);
  };

  const handleFocus = (): void => {
    if (results.length > 0) {
      setShowResults(true);
      setActiveIndex(-1);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent,
  ): void => {
    const hasResults =
      results.length > 0;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (!hasResults) return;

        if (!showResults) {
          setShowResults(true);
          setActiveIndex(0);
          return;
        }

        setActiveIndex((prev) =>
          Math.min(
            prev + 1,
            results.length - 1,
          ),
        );

        break;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (!hasResults) return;

        if (!showResults) {
          setShowResults(true);
          setActiveIndex(
            results.length - 1,
          );
          return;
        }

        setActiveIndex((prev) =>
          prev <= 0
            ? -1
            : prev - 1,
        );

        break;
      }

      case 'Enter': {
        if (
          activeIndex >= 0 &&
          results[activeIndex]
        ) {
          event.preventDefault();

          handleSelect(
            results[activeIndex],
          );
        }

        break;
      }

      case 'Escape': {
        event.preventDefault();

        setShowResults(false);
        setActiveIndex(-1);

        break;
      }
    }
  };

  const hasResults =
    results.length > 0;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
      }}
    >
      <TextField
        fullWidth
        placeholder={placeholder}
        value={query}
        onChange={handleQueryChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        slotProps={{
          htmlInput: {
            'aria-label':
              placeholder,

            'aria-expanded':
              showResults,

            'aria-controls':
              showResults
                ? 'item-search-results'
                : undefined,

            'aria-autocomplete':
              'list',

            'aria-activedescendant':
              activeIndex >= 0 &&
              results[activeIndex]
                ? `item-search-option-${results[activeIndex].id}`
                : undefined,

            role: 'combobox',
          },

          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{
                    color: '#6b6b70',
                    fontSize: 21,
                  }}
                />
              </InputAdornment>
            ),

            endAdornment: (
              <InputAdornment position="end">
                {loading && (
                  <CircularProgress
                    size={18}
                    thickness={4}
                    sx={{
                      color: '#55555a',
                    }}
                  />
                )}

                {query &&
                  !loading && (
                    <IconButton
                      type="button"
                      size="small"
                      onClick={
                        handleClear
                      }
                      aria-label="Clear search"
                      edge="end"
                      sx={{
                        width: 32,
                        height: 32,

                        borderRadius: 1.75,

                        color:
                          '#66666b',

                        '&:hover': {
                          color:
                            '#202024',

                          backgroundColor:
                            '#eeeeF0',
                        },
                      }}
                    >
                      <ClearIcon
                        sx={{
                          fontSize: 19,
                        }}
                      />
                    </IconButton>
                  )}
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root':
            {
              minHeight: 50,

              borderRadius: 2.25,

              backgroundColor:
                '#ffffff',

              color: '#18181b',

              '& fieldset': {
                borderColor:
                  '#c9c9ce',
              },

              '&:hover fieldset': {
                borderColor:
                  '#9f9fa5',
              },

              '&.Mui-focused fieldset':
                {
                  borderColor:
                    '#202024',

                  borderWidth: 1.5,
                },
            },

          '& .MuiOutlinedInput-input':
            {
              color: '#18181b',

              WebkitTextFillColor:
                '#18181b',

              fontSize: {
                xs: '16px',
                sm: '0.9rem',
              },

              '&::placeholder': {
                color:
                  '#929297',

                opacity: 1,
              },
            },
        }}
      />

      {showResults &&
        hasResults && (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',

              top: '100%',

              left: 0,
              right: 0,

              mt: 1,

              maxHeight: 320,

              overflowY: 'auto',
              overflowX: 'hidden',

              zIndex: 20,

              borderRadius: 2.5,

              backgroundColor:
                '#ffffff',

              border:
                '1px solid #cfcfd4',

              boxShadow:
                '0 12px 28px rgba(0,0,0,0.12)',

              '&::-webkit-scrollbar':
                {
                  width: 6,
                },

              '&::-webkit-scrollbar-track':
                {
                  backgroundColor:
                    'transparent',
                },

              '&::-webkit-scrollbar-thumb':
                {
                  backgroundColor:
                    '#c7c7cc',

                  borderRadius: 999,
                },
            }}
          >
            <List
              id="item-search-results"
              role="listbox"
              dense
              ref={listRef}
              sx={{
                p: 0.75,
              }}
            >
              {results.map(
                (
                  item,
                  index,
                ) => {
                  const totalVolume =
                    normalizeVolume(
                      item.totalVolume,
                    );

                  const optionId =
                    `item-search-option-${item.id}`;

                  const isActive =
                    index ===
                    activeIndex;

                  return (
                    <ListItem
                      key={item.id}
                      disablePadding
                      sx={{
                        '&:not(:last-child)':
                          {
                            mb: 0.4,
                          },
                      }}
                    >
                      <ListItemButton
                        role="option"
                        id={optionId}
                        data-option-index={
                          index
                        }
                        aria-selected={
                          isActive
                        }
                        selected={
                          isActive
                        }
                        onClick={() =>
                          handleSelect(
                            item,
                          )
                        }
                        sx={{
                          minHeight: 58,

                          px: 1.5,
                          py: 1,

                          borderRadius:
                            1.75,

                          border:
                            '1px solid transparent',

                          color:
                            '#202024',

                          transition:
                            'background-color 0.16s ease, border-color 0.16s ease',

                          '&:hover': {
                            backgroundColor:
                              '#f3f3f5',

                            borderColor:
                              '#dedee1',
                          },

                          '&.Mui-selected':
                            {
                              backgroundColor:
                                '#e9e9ec',

                              borderColor:
                                '#c9c9ce',

                              color:
                                '#18181b',
                            },

                          '&.Mui-selected:hover':
                            {
                              backgroundColor:
                                '#e5e5e8',
                            },
                        }}
                      >
                        <ListItemText
                          sx={{
                            m: 0,
                          }}
                          primary={
                            item.name
                          }
                          secondary={`${item.uniqueNumber} • ${totalVolume.toFixed(2)} m³`}
                          slotProps={{
                            primary: {
                              sx: {
                                color:
                                  '#202024',

                                fontSize:
                                  '0.84rem',

                                fontWeight:
                                  700,

                                lineHeight:
                                  1.35,
                              },
                            },

                            secondary:
                              {
                                sx: {
                                  mt: 0.35,

                                  color:
                                    '#6c6c71',

                                  fontSize:
                                    '0.72rem',

                                  fontWeight:
                                    500,

                                  lineHeight:
                                    1.35,
                                },
                              },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                },
              )}
            </List>
          </Paper>
        )}

      {showResults &&
        query &&
        !loading &&
        !hasResults && (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',

              top: '100%',

              left: 0,
              right: 0,

              mt: 1,

              p: 2,

              zIndex: 20,

              borderRadius: 2.5,

              backgroundColor:
                error
                  ? '#fff4f5'
                  : '#ffffff',

              border: error
                ? '1px solid #efc9cc'
                : '1px solid #cfcfd4',

              boxShadow:
                '0 12px 28px rgba(0,0,0,0.10)',
            }}
          >
            <Typography
              align="center"
              sx={{
                color: error
                  ? '#9b2831'
                  : '#69696e',

                fontSize: '0.8rem',

                fontWeight:
                  error
                    ? 700
                    : 600,

                lineHeight: 1.5,
              }}
            >
              {error ||
                'No items found'}
            </Typography>
          </Paper>
        )}
    </Box>
  );
};