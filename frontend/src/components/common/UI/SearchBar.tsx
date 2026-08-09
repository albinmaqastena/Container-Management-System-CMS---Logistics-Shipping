// src/components/common/UI/SearchBar.tsx

import type { ChangeEvent } from 'react';

import {
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';

import {
  SearchRounded as SearchIcon,
  CloseRounded as ClearIcon,
} from '@mui/icons-material';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
}: SearchBarProps) => {
  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    onChange(event.target.value);
  };

  const handleClear = (): void => {
    onChange('');
  };

  return (
    <TextField
      fullWidth
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      slotProps={{
        htmlInput: {
          'aria-label': placeholder,
        },
        input: {
          startAdornment: (
            <InputAdornment
              position="start"
              sx={{
                mr: 0.5,
              }}
            >
              <SearchIcon
                sx={{
                  fontSize: {
                    xs: 20,
                    sm: 21,
                  },
                  color: '#7a7a7f',
                }}
              />
            </InputAdornment>
          ),

          endAdornment:
            !disabled && value ? (
              <InputAdornment
                position="end"
                sx={{
                  ml: 0.5,
                }}
              >
                <IconButton
                  type="button"
                  size="small"
                  onClick={handleClear}
                  aria-label="Clear search"
                  edge="end"
                  sx={{
                    width: 32,
                    height: 32,

                    color: '#77777c',

                    borderRadius: 1.75,

                    transition:
                      'background-color 0.18s ease, transform 0.18s ease',

                    '&:hover': {
                      backgroundColor:
                        '#f0f0f1',

                      transform:
                        'scale(1.04)',
                    },
                  }}
                >
                  <ClearIcon
                    sx={{
                      fontSize: 19,
                    }}
                  />
                </IconButton>
              </InputAdornment>
            ) : undefined,
        },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          minHeight: {
            xs: 48,
            sm: 52,
          },

          borderRadius: 2.5,

          backgroundColor: '#ffffff',

          color: '#1c1c1f',

          fontSize: {
            xs: '16px',
            sm: '0.92rem',
          },

          boxShadow:
            '0 2px 10px rgba(0,0,0,0.025)',

          transition:
            'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',

          '& fieldset': {
            borderColor:
              'rgba(0,0,0,0.10)',
          },

          '&:hover': {
            backgroundColor: '#ffffff',

            '& fieldset': {
              borderColor:
                'rgba(0,0,0,0.20)',
            },
          },

          '&.Mui-focused': {
            backgroundColor: '#ffffff',

            boxShadow:
              '0 0 0 3px rgba(0,0,0,0.035)',

            '& fieldset': {
              borderColor: '#2a2a2d',
              borderWidth: 1.5,
            },
          },

          '&.Mui-disabled': {
            backgroundColor: '#f5f5f6',

            '& fieldset': {
              borderColor:
                'rgba(0,0,0,0.06)',
            },
          },
        },

        '& .MuiOutlinedInput-input': {
          py: {
            xs: 1.35,
            sm: 1.5,
          },

          px: 0.5,

          color: '#1c1c1f',

          WebkitTextFillColor:
            '#1c1c1f',

          '&::placeholder': {
            color: '#929297',
            opacity: 1,
          },

          '&.Mui-disabled': {
            color: '#a6a6aa',

            WebkitTextFillColor:
              '#a6a6aa',
          },
        },
      }}
    />
  );
};

export default SearchBar;