// src/components/reports/ContainerReportSelector.tsx

import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';

import {
  CheckBoxOutlined as SelectAllIcon,
  ClearOutlined as ClearIcon,
  Inventory2Outlined as ContainerIcon,
} from '@mui/icons-material';

import type { Container } from '../../types';
import { ContainerStatus } from '../../types';

interface ContainerReportSelectorProps {
  containers: Container[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  loading?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

const formatStatus = (
  value: string,
): string => {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(' ');
};

export const ContainerReportSelector = ({
  containers,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearSelection,
  loading = false,
  disabled = false,
  emptyMessage = 'No containers found',
}: ContainerReportSelectorProps) => {
  const allSelected =
    containers.length > 0 &&
    containers.every((container) =>
      selectedIds.includes(container.id),
    );

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          minHeight: 260,

          display: 'flex',

          flexDirection: 'column',

          alignItems: 'center',

          justifyContent:
            'center',

          gap: 1.5,

          border:
            '1px solid #d7d7db',

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
            color: '#717176',

            fontSize: '0.8rem',

            fontWeight: 600,
          }}
        >
          Loading containers...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',

        overflow: 'hidden',

        border:
          '1px solid #d7d7db',

        borderRadius: 2.5,

        backgroundColor:
          '#ffffff',

        boxShadow:
          '0 5px 18px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: {
            xs: 1.75,
            sm: 2.25,
          },

          py: 1.5,

          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          justifyContent:
            'space-between',

          gap: 1.25,

          backgroundColor:
            '#f5f5f6',

          borderBottom:
            '1px solid #dedee2',
        }}
      >
        <Box>
          <Typography
            sx={{
              color: '#202024',

              fontSize: '0.9rem',

              fontWeight: 800,
            }}
          >
            Select Containers
          </Typography>

          <Typography
            sx={{
              mt: 0.25,

              color: '#77777c',

              fontSize: '0.72rem',

              fontWeight: 500,
            }}
          >
            Choose one or more containers
            for the selected report.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            gap: 0.75,

            flexWrap: 'wrap',
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={
              <SelectAllIcon />
            }
            onClick={onSelectAll}
            disabled={
              disabled ||
              containers.length === 0 ||
              allSelected
            }
            sx={{
              minHeight: 36,

              borderRadius: 1.75,

              borderColor:
                '#c7c7cc',

              color: '#3f3f44',

              backgroundColor:
                '#ffffff',

              fontSize: '0.72rem',

              fontWeight: 700,

              textTransform: 'none',

              boxShadow: 'none',

              '&:hover': {
                borderColor:
                  '#9f9fa5',

                backgroundColor:
                  '#eeeeF0',
              },
            }}
          >
            Select All
          </Button>

          <Button
            size="small"
            variant="text"
            startIcon={
              <ClearIcon />
            }
            onClick={
              onClearSelection
            }
            disabled={
              disabled ||
              selectedIds.length === 0
            }
            sx={{
              minHeight: 36,

              borderRadius: 1.75,

              color: '#66666b',

              fontSize: '0.72rem',

              fontWeight: 700,

              textTransform: 'none',

              '&:hover': {
                color: '#202024',

                backgroundColor:
                  '#eeeeF0',
              },
            }}
          >
            Clear
          </Button>
        </Box>
      </Box>

      {containers.length === 0 ? (
        <Box
          role="status"
          sx={{
            minHeight: 220,

            display: 'flex',

            alignItems: 'center',

            justifyContent:
              'center',

            px: 2,
          }}
        >
          <Typography
            sx={{
              color: '#77777c',

              fontSize: '0.84rem',

              fontWeight: 600,

              textAlign: 'center',
            }}
          >
            {emptyMessage}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            p: {
              xs: 1,
              sm: 1.25,
            },

            display: 'flex',

            flexDirection: 'column',

            gap: 0.75,

            maxHeight: 520,

            overflowY: 'auto',

            '&::-webkit-scrollbar':
              {
                width: 6,
              },

            '&::-webkit-scrollbar-thumb':
              {
                backgroundColor:
                  '#c8c8cd',

                borderRadius: 999,
              },
          }}
        >
          {containers.map(
            (container) => {
              const checked =
                selectedIds.includes(
                  container.id,
                );

              const rawUsedVolume =
                Number(
                  container.usedVolume,
                );

              const usedVolume =
                Number.isFinite(
                  rawUsedVolume,
                )
                  ? Math.max(
                      0,
                      rawUsedVolume,
                    )
                  : 0;

              const rawTotalVolume =
                Number(
                  container.totalVolume,
                );

              const totalVolume =
                Number.isFinite(
                  rawTotalVolume,
                ) &&
                rawTotalVolume > 0
                  ? rawTotalVolume
                  : 0;

              const statusColor =
                container.status ===
                ContainerStatus.ACTIVE
                  ? '#31764a'
                  : container.status ===
                      ContainerStatus.ARCHIVED
                    ? '#66666b'
                    : '#8a6728';

              const statusBg =
                container.status ===
                ContainerStatus.ACTIVE
                  ? '#eef7f1'
                  : container.status ===
                      ContainerStatus.ARCHIVED
                    ? '#eeeeF0'
                    : '#faf5e8';

              return (
                <Box
                  key={container.id}
                  component="label"
                  sx={{
                    width: '100%',

                    minWidth: 0,

                    display: 'flex',

                    alignItems:
                      'center',

                    gap: {
                      xs: 1,
                      sm: 1.4,
                    },

                    p: {
                      xs: 1.25,
                      sm: 1.5,
                    },

                    boxSizing:
                      'border-box',

                    borderRadius: 2,

                    backgroundColor:
                      checked
                        ? '#f2f2f4'
                        : '#ffffff',

                    border:
                      checked
                        ? '1px solid #a9a9ae'
                        : '1px solid #dedee2',

                    cursor:
                      disabled
                        ? 'default'
                        : 'pointer',

                    transition:
                      'background-color 0.15s ease, border-color 0.15s ease',

                    '&:hover': {
                      backgroundColor:
                        disabled
                          ? undefined
                          : '#f7f7f8',

                      borderColor:
                        disabled
                          ? undefined
                          : '#bdbdc2',
                    },
                  }}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                        onToggle(
                        container.id,
                        )
                    }
                    slotProps={{
                        input: {
                        'aria-label': `Select ${container.name}`,
                        },
                    }}
                    sx={{
                        p: 0.5,

                        color: '#85858a',

                        '&.Mui-checked': {
                        color: '#202024',
                        },
                    }}
                    />

                  <Box
                    sx={{
                      width: {
                        xs: 36,
                        sm: 40,
                      },

                      height: {
                        xs: 36,
                        sm: 40,
                      },

                      flexShrink: 0,

                      display: 'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      borderRadius: 1.75,

                      backgroundColor:
                        '#f1f1f3',

                      border:
                        '1px solid #dedee2',

                      color: '#55555a',
                    }}
                  >
                    <ContainerIcon
                      sx={{
                        fontSize: 20,
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      flex: 1,

                      minWidth: 0,

                      display: 'grid',

                      gridTemplateColumns:
                        {
                          xs: '1fr',
                          md: 'minmax(0, 1fr) auto',
                        },

                      alignItems:
                        'center',

                      gap: {
                        xs: 0.7,
                        md: 2,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        noWrap
                        title={
                          container.name
                        }
                        sx={{
                          color:
                            '#202024',

                          fontSize:
                            '0.84rem',

                          fontWeight:
                            800,
                        }}
                      >
                        {
                          container.name
                        }
                      </Typography>

                      <Typography
                        noWrap
                        sx={{
                          mt: 0.2,

                          color:
                            '#77777c',

                          fontSize:
                            '0.7rem',

                          fontWeight:
                            500,
                        }}
                      >
                        {
                          container.containerCode
                        }
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',

                        flexWrap: 'wrap',

                        alignItems:
                          'center',

                        justifyContent:
                          {
                            xs: 'flex-start',
                            md: 'flex-end',
                          },

                        gap: 0.75,
                      }}
                    >
                      <Chip
                        label={formatStatus(
                          container.status,
                        )}
                        size="small"
                        sx={{
                          height: 25,

                          borderRadius:
                            999,

                          backgroundColor:
                            statusBg,

                          color:
                            statusColor,

                          border:
                            '1px solid #dedee2',

                          fontSize:
                            '0.65rem',

                          fontWeight:
                            700,
                        }}
                      />

                      <Typography
                        sx={{
                          color:
                            '#606065',

                          fontSize:
                            '0.7rem',

                          fontWeight:
                            600,

                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        {usedVolume.toFixed(
                          1,
                        )}{' '}
                        /{' '}
                        {totalVolume.toFixed(
                          1,
                        )}{' '}
                        m³
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            },
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ContainerReportSelector;