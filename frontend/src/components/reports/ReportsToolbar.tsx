// src/components/reports/ReportsToolbar.tsx

import type { ChangeEvent } from 'react';

import {
  Box,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';

import {
  SearchOutlined as SearchIcon,
} from '@mui/icons-material';

interface ReportsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalContainers: number;
  selectedCount: number;
  disabled?: boolean;
}

export const ReportsToolbar = ({
  searchQuery,
  onSearchChange,
  totalContainers,
  selectedCount,
  disabled = false,
}: ReportsToolbarProps) => {
  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    onSearchChange(event.target.value);
  };

  return (
    <Box
      sx={{
        width: '100%',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            md: 'row',
          },

          alignItems: {
            xs: 'flex-start',
            md: 'flex-end',
          },

          justifyContent:
            'space-between',

          gap: {
            xs: 2,
            md: 3,
          },

          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Box
          sx={{
            minWidth: 0,
          }}
        >
          <Typography
            component="h1"
            sx={{
              color: '#17171a',

              fontSize: {
                xs: '1.7rem',
                sm: '2rem',
                md: '2.2rem',
              },

              fontWeight: 800,

              lineHeight: 1.15,

              letterSpacing:
                '-0.035em',
            }}
          >
            Reports
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mt: 0.65,

              color: '#717176',

              fontSize: {
                xs: '0.8rem',
                sm: '0.86rem',
              },

              fontWeight: 500,

              lineHeight: 1.55,
            }}
          >
            Export reports for all
            containers or select specific
            containers.
          </Typography>
        </Box>

        {/* Statistics */}
        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            gap: 1,

            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 0.85,

              borderRadius: 2,

              backgroundColor:
                '#f5f5f6',

              border:
                '1px solid #dedee2',
            }}
          >
            <Typography
              sx={{
                color: '#717176',

                fontSize: '0.64rem',

                fontWeight: 700,

                textTransform:
                  'uppercase',

                letterSpacing:
                  '0.04em',
              }}
            >
              Containers
            </Typography>

            <Typography
              sx={{
                mt: 0.15,

                color: '#202024',

                fontSize: '0.88rem',

                fontWeight: 800,
              }}
            >
              {totalContainers}
            </Typography>
          </Box>

          <Box
            sx={{
              px: 1.5,
              py: 0.85,

              borderRadius: 2,

              backgroundColor:
                selectedCount > 0
                  ? '#eeeeF0'
                  : '#f5f5f6',

              border:
                '1px solid #dedee2',
            }}
          >
            <Typography
              sx={{
                color: '#717176',

                fontSize: '0.64rem',

                fontWeight: 700,

                textTransform:
                  'uppercase',

                letterSpacing:
                  '0.04em',
              }}
            >
              Selected
            </Typography>

            <Typography
              sx={{
                mt: 0.15,

                color: '#202024',

                fontSize: '0.88rem',

                fontWeight: 800,
              }}
            >
              {selectedCount}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        value={searchQuery}
        onChange={handleChange}
        disabled={disabled}
        placeholder="Search containers by name or code..."
        autoComplete="off"
        slotProps={{
          htmlInput: {
            'aria-label':
              'Search containers for reports',
          },

          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{
                    color: '#717176',

                    fontSize: 20,
                  }}
                />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root':
            {
              minHeight: 50,

              borderRadius: 2,

              backgroundColor:
                '#ffffff',

              color: '#18181b',

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

              '&.Mui-disabled': {
                backgroundColor:
                  '#f3f3f5',
              },
            },

          '& .MuiInputBase-input':
            {
              color: '#18181b',

              WebkitTextFillColor:
                '#18181b',

              fontSize: {
                xs: '16px',
                sm: '0.9rem',
              },

              fontWeight: 500,

              '&::placeholder': {
                color: '#8b8b91',

                opacity: 1,
              },
            },
        }}
      />
    </Box>
  );
};

export default ReportsToolbar;