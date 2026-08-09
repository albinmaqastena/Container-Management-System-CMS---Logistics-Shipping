// src/components/containers/ContainerDetailList.tsx

import { useNavigate } from 'react-router-dom';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';

import type { ChipProps } from '@mui/material';

import {
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

import type { Container } from '../../types';
import { ContainerStatus } from '../../types';

interface ContainerDetailListProps {
  containers: Container[];
  onView?: (container: Container) => void;
  showActions?: boolean;
}

const getStatusColor = (
  status: ContainerStatus,
): ChipProps['color'] => {
  switch (status) {
    case ContainerStatus.ACTIVE:
      return 'success';

    case ContainerStatus.ARCHIVED:
      return 'default';

    default:
      return 'warning';
  }
};

const capitalizeWords = (
  value: string,
): string => {
  if (!value) return value;

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

export const ContainerDetailList = ({
  containers,
  onView,
  showActions = true,
}: ContainerDetailListProps) => {
  const navigate = useNavigate();

  const handleView = (
    container: Container,
  ): void => {
    if (onView) {
      onView(container);
      return;
    }

    navigate(`/containers/${container.id}`);
  };

  if (containers.length === 0) {
    return (
      <Box
        role="status"
        sx={{
          textAlign: 'center',

          py: {
            xs: 5,
            sm: 6,
          },

          px: 2,

          color: '#7a7a7f',

          fontSize: '0.88rem',
          fontWeight: 500,
        }}
      >
        No containers found
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        width: '100%',

        overflowX: 'auto',

        backgroundColor: '#ffffff',

        border:
          '1px solid #dedee1',

        borderRadius: 2.5,

        boxShadow:
          '0 5px 18px rgba(0,0,0,0.05)',

        '&::-webkit-scrollbar': {
          height: 6,
        },

        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },

        '&::-webkit-scrollbar-thumb': {
          backgroundColor:
            'rgba(0,0,0,0.14)',

          borderRadius: 999,
        },
      }}
    >
      <Table
        sx={{
          minWidth: 760,
        }}
      >
        <TableHead
          sx={{
            backgroundColor: '#f6f6f7',
          }}
        >
          <TableRow>
            <TableCell
              component="th"
              scope="col"
              sx={{
                fontWeight: 700,

                color: '#2b2b2f',

                fontSize: '0.78rem',

                letterSpacing:
                  '0.01em',

                borderBottom:
                  '1px solid #dcdce0',

                py: 1.5,
              }}
            >
              Name
            </TableCell>

            <TableCell
              component="th"
              scope="col"
              sx={{
                fontWeight: 700,

                color: '#2b2b2f',

                fontSize: '0.78rem',

                letterSpacing:
                  '0.01em',

                borderBottom:
                  '1px solid #dcdce0',

                py: 1.5,
              }}
            >
              Code
            </TableCell>

            <TableCell
              component="th"
              scope="col"
              sx={{
                fontWeight: 700,

                color: '#2b2b2f',

                fontSize: '0.78rem',

                letterSpacing:
                  '0.01em',

                borderBottom:
                  '1px solid #dcdce0',

                py: 1.5,
              }}
            >
              Status
            </TableCell>

            <TableCell
              component="th"
              scope="col"
              align="right"
              sx={{
                fontWeight: 700,

                color: '#2b2b2f',

                fontSize: '0.78rem',

                letterSpacing:
                  '0.01em',

                borderBottom:
                  '1px solid #dcdce0',

                py: 1.5,
              }}
            >
              Volume (m³)
            </TableCell>

            <TableCell
              component="th"
              scope="col"
              align="right"
              sx={{
                fontWeight: 700,

                color: '#2b2b2f',

                fontSize: '0.78rem',

                letterSpacing:
                  '0.01em',

                borderBottom:
                  '1px solid #dcdce0',

                py: 1.5,
              }}
            >
              Usage
            </TableCell>

            {showActions && (
              <TableCell
                component="th"
                scope="col"
                align="center"
                sx={{
                  fontWeight: 700,

                  color: '#2b2b2f',

                  fontSize: '0.78rem',

                  letterSpacing:
                    '0.01em',

                  borderBottom:
                    '1px solid #dcdce0',

                  py: 1.5,
                }}
              >
                Actions
              </TableCell>
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {containers.map(
            (container) => {
              // Normalizimi i vlerave numerike
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

              const rawAvailableVolume =
                Number(
                  container.availableVolume,
                );

              const availableVolume =
                Number.isFinite(
                  rawAvailableVolume,
                )
                  ? Math.max(
                      0,
                      rawAvailableVolume,
                    )
                  : 0;

              const usagePercentage =
                totalVolume > 0
                  ? Math.min(
                      Math.max(
                        (usedVolume /
                          totalVolume) *
                          100,
                        0,
                      ),
                      100,
                    )
                  : 0;

              return (
                <TableRow
                  key={container.id}
                  hover
                  sx={{
                    transition:
                      'background-color 0.18s ease',

                    '&:last-child td': {
                      borderBottom: 0,
                    },

                    '&:hover': {
                      backgroundColor:
                        '#fafafa',
                    },
                  }}
                >
                  <TableCell
                    sx={{
                      py: 1.6,

                      borderBottom:
                        '1px solid #ededee',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#202024',

                        fontWeight: 700,

                        fontSize:
                          '0.84rem',

                        lineHeight: 1.35,
                      }}
                    >
                      {container.name}
                    </Typography>

                    {container.description && (
                      <Typography
                        variant="caption"
                        title={
                          container.description
                        }
                        sx={{
                          display: 'block',

                          mt: 0.35,

                          maxWidth: 220,

                          color: '#7a7a7f',

                          fontSize:
                            '0.71rem',

                          lineHeight: 1.4,

                          overflow: 'hidden',

                          textOverflow:
                            'ellipsis',

                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        {
                          container.description
                        }
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell
                    sx={{
                      py: 1.6,

                      borderBottom:
                        '1px solid #ededee',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#66666b',

                        fontSize:
                          '0.8rem',

                        fontWeight: 500,
                      }}
                    >
                      {
                        container.containerCode
                      }
                    </Typography>
                  </TableCell>

                  <TableCell
                    sx={{
                      py: 1.6,

                      borderBottom:
                        '1px solid #ededee',
                    }}
                  >
                    <Chip
                      label={capitalizeWords(
                        container.status,
                      )}
                      color={getStatusColor(
                        container.status,
                      )}
                      size="small"
                      sx={{
                        height: 26,

                        borderRadius: 1.75,

                        fontSize:
                          '0.68rem',

                        fontWeight: 700,

                        '& .MuiChip-label':
                          {
                            px: 1.1,
                          },
                      }}
                    />
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      py: 1.6,

                      borderBottom:
                        '1px solid #ededee',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#2d2d31',

                        fontSize:
                          '0.8rem',

                        fontWeight: 600,

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

                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',

                        mt: 0.3,

                        color: '#77777c',

                        fontSize:
                          '0.7rem',

                        fontWeight: 500,

                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {availableVolume.toFixed(
                        1,
                      )}{' '}
                      m³ available
                    </Typography>
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      minWidth: 150,

                      py: 1.6,

                      borderBottom:
                        '1px solid #ededee',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'flex-end',

                        gap: 1,
                      }}
                    >
                      <LinearProgress
                        variant="determinate"
                        value={
                          usagePercentage
                        }
                        color={
                          usagePercentage >
                          90
                            ? 'error'
                            : usagePercentage >
                                70
                              ? 'warning'
                              : 'primary'
                        }
                        sx={{
                          flex: 1,

                          minWidth: 80,

                          height: 6,

                          borderRadius: 999,

                          backgroundColor:
                            '#dedee1',

                          '& .MuiLinearProgress-bar':
                            {
                              borderRadius:
                                999,
                            },
                        }}
                      />

                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: 34,

                          color: '#66666b',

                          fontSize:
                            '0.7rem',

                          fontWeight: 700,

                          textAlign:
                            'right',
                        }}
                      >
                        {usagePercentage.toFixed(
                          0,
                        )}
                        %
                      </Typography>
                    </Box>
                  </TableCell>

                  {showActions && (
                    <TableCell
                      align="center"
                      sx={{
                        py: 1.6,

                        borderBottom:
                          '1px solid #ededee',
                      }}
                    >
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleView(
                              container,
                            )
                          }
                          aria-label={`View details for ${container.name}`}
                          sx={{
                            width: 36,
                            height: 36,

                            borderRadius: 2,

                            color: '#55555a',

                            border:
                              '1px solid #d7d7da',

                            backgroundColor:
                              '#ffffff',

                            transition:
                              'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                            '&:hover': {
                              color:
                                '#202024',

                              backgroundColor:
                                '#ffffff',

                              borderColor:
                                '#bdbdc2',

                              transform:
                                'scale(1.05)',

                              boxShadow:
                                '0 4px 10px rgba(0,0,0,0.09)',
                            },
                          }}
                        >
                          <VisibilityIcon
                            fontSize="small"
                          />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            },
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};