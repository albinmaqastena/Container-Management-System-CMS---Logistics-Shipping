// src/components/containers/ContainerCard.tsx

import { useState } from 'react';
import type { MouseEvent } from 'react';

import {
  Card,
  CardActionArea,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';

import type { ChipProps } from '@mui/material';

import {
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';

import type { Container } from '../../types';
import { ContainerStatus } from '../../types';

import { useAuth } from '../../hooks/useAuth';
import { useContainers } from '../../hooks/useContainers';

import { ROLES } from '../../utilis/constants';

import { ConfirmDialog } from '../common/Modals/ConfirmDialog';

// Helper jashtë komponentit
const formatDate = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : date.toLocaleDateString();
};

const capitalizeWords = (value: string): string => {
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

interface ContainerCardProps {
  container: Container;
  onClick?: () => void;
}

export const ContainerCard = ({
  container,
  onClick,
}: ContainerCardProps) => {
  const { user } = useAuth();

  const {
    updateContainerStatus,
    softDeleteContainer,
  } = useContainers();

  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  const [
    statusLoading,
    setStatusLoading,
  ] = useState(false);

  const [
    deleteLoading,
    setDeleteLoading,
  ] = useState(false);

  const isAdmin =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.SUPER_ADMIN;

  const isArchived =
    container.status === ContainerStatus.ARCHIVED;

  const rawUsedVolume = Number(
    container.usedVolume,
  );

  const usedVolume = Number.isFinite(
    rawUsedVolume,
  )
    ? Math.max(0, rawUsedVolume)
    : 0;

  const rawTotalVolume = Number(
    container.totalVolume,
  );

  const safeTotalVolume =
    Number.isFinite(rawTotalVolume) &&
    rawTotalVolume > 0
      ? rawTotalVolume
      : 0;

  const rawAvailableVolume = Number(
  container.availableVolume,
);

const availableVolume =
  Number.isFinite(rawAvailableVolume) &&
  rawAvailableVolume >= 0
    ? rawAvailableVolume
    : Math.max(
        safeTotalVolume - usedVolume,
        0,
      );

  const usagePercentage =
    safeTotalVolume > 0
      ? Math.min(
          Math.max(
            (usedVolume / safeTotalVolume) * 100,
            0,
          ),
          100,
        )
      : 0;

  const statusColor: ChipProps['color'] =
    container.status === ContainerStatus.ACTIVE
      ? 'success'
      : container.status === ContainerStatus.ARCHIVED
        ? 'default'
        : 'warning';

  const handleStatusChange = async (
    event: MouseEvent,
  ): Promise<void> => {
    event.stopPropagation();

    const newStatus: ContainerStatus =
      isArchived
        ? ContainerStatus.ACTIVE
        : ContainerStatus.ARCHIVED;

    setStatusLoading(true);

    try {
      await updateContainerStatus(
        container.id,
        newStatus,
      );
    } catch {
      // Error handled by context
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteClick = (
    event: MouseEvent,
  ): void => {
    event.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm =
    async (): Promise<void> => {
      setDeleteLoading(true);

      try {
        await softDeleteContainer(
          container.id,
        );

        setDeleteDialogOpen(false);
      } catch {
        // Error handled by context
      } finally {
        setDeleteLoading(false);
      }
    };

  const handleDeleteCancel = (): void => {
    setDeleteDialogOpen(false);
  };

  const isLoading =
    statusLoading || deleteLoading;

  const cardContent = (
    <CardContent
      sx={{
        flexGrow: 1,

        p: {
          xs: 2.25,
          sm: 2.75,
        },

        backgroundColor: '#ffffff',

        '&:last-child': {
          pb: {
            xs: 2.25,
            sm: 2.75,
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <Typography
            variant="h6"
            component="div"
            noWrap
            title={container.name}
            sx={{
              color: '#121214',

              fontWeight: 800,

              fontSize: {
                xs: '1.05rem',
                sm: '1.12rem',
              },

              lineHeight: 1.25,

              letterSpacing: '-0.025em',
            }}
          >
            {container.name}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mt: 0.45,

              color: '#66666b',

              fontSize: {
                xs: '0.76rem',
                sm: '0.8rem',
              },

              fontWeight: 500,

              letterSpacing: '0.005em',
            }}
          >
            Code: {container.containerCode}
          </Typography>
        </Box>

        <Chip
          label={capitalizeWords(
            container.status,
          )}
          color={statusColor}
          size="small"
          sx={{
            flexShrink: 0,

            height: 28,

            borderRadius: 999,

            fontSize: '0.7rem',

            fontWeight: 700,

            '& .MuiChip-label': {
              px: 1.25,
            },
          }}
        />
      </Box>

      {/* Description */}
      {container.description && (
        <Typography
          variant="body2"
          sx={{
            mt: 1.6,

            color: '#444448',

            fontSize: {
              xs: '0.82rem',
              sm: '0.86rem',
            },

            lineHeight: 1.65,

            overflow: 'hidden',

            display: '-webkit-box',

            WebkitLineClamp: 2,

            WebkitBoxOrient: 'vertical',
          }}
        >
          {container.description}
        </Typography>
      )}

      {/* Volume panel */}
      <Box
        sx={{
          mt: 2.2,

          p: {
            xs: 1.6,
            sm: 1.8,
          },

          borderRadius: 2.5,

          background:
            'linear-gradient(180deg, #f6f6f7 0%, #eeeeF1 100%)',

          border: '1px solid #d8d8dc',

          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            justifyContent: 'space-between',

            gap: 1.5,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#252529',

              fontSize: '0.8rem',

              fontWeight: 700,
            }}
          >
            Volume
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: '#252529',

              fontSize: '0.8rem',

              fontWeight: 700,

              whiteSpace: 'nowrap',
            }}
          >
            {usedVolume.toFixed(1)} /{' '}
            {safeTotalVolume.toFixed(1)} m³
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={usagePercentage}
          color={
            usagePercentage > 90
              ? 'error'
              : usagePercentage > 70
                ? 'warning'
                : 'primary'
          }
          sx={{
            mt: 1.25,

            height: 7,

            borderRadius: 999,

            backgroundColor: '#d3d3d7',

            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
            },
          }}
        />

        <Box
          sx={{
            mt: 0.95,

            display: 'flex',

            justifyContent: 'space-between',

            alignItems: 'center',

            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#66666b',

              fontSize: '0.72rem',

              fontWeight: 600,
            }}
          >
            {availableVolume.toFixed(1)} m³ available
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: '#4f4f54',

              fontSize: '0.72rem',

              fontWeight: 700,
            }}
          >
            {usagePercentage.toFixed(0)}%
          </Typography>
        </Box>
      </Box>

      {/* Created date */}
      <Box
        sx={{
          mt: 2.1,

          pt: 1.5,

          borderTop: '1px solid #e0e0e3',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: '#717176',

            fontSize: '0.75rem',

            fontWeight: 500,
          }}
        >
          Created:{' '}
          {formatDate(container.createdAt)}
        </Typography>
      </Box>
    </CardContent>
  );

  return (
    <>
      <Card
        aria-busy={isLoading}
        elevation={0}
        sx={{
          position: 'relative',

          height: '100%',

          display: 'flex',

          flexDirection: 'column',

          cursor: onClick
            ? 'pointer'
            : 'default',

          overflow: 'hidden',

          backgroundColor: '#ffffff',

          border: '1px solid #cfcfd4',

          borderRadius: {
            xs: 3,
            sm: 3.25,
          },

          boxShadow:
            '0 8px 24px rgba(0,0,0,0.085)',

          transition:
            'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',

          '&::before': {
            content: '""',

            position: 'absolute',

            top: 0,
            left: 0,
            right: 0,

            height: 3,

            background:
              'linear-gradient(90deg, #202020 0%, #55555a 100%)',

            opacity: 0.9,

            zIndex: 2,
          },

          '&:hover': onClick
            ? {
                transform:
                  'translateY(-4px)',

                borderColor: '#a8a8ae',

                boxShadow:
                  '0 14px 32px rgba(0,0,0,0.14)',
              }
            : undefined,
        }}
      >
        {onClick ? (
          <CardActionArea
            onClick={onClick}
            sx={{
              flexGrow: 1,

              display: 'flex',

              flexDirection: 'column',

              alignItems: 'stretch',

              backgroundColor: '#ffffff',

              '&:hover': {
                backgroundColor: '#ffffff',
              },

              '& .MuiCardActionArea-focusHighlight': {
                opacity: 0,
              },

              '&:hover .MuiCardActionArea-focusHighlight': {
                opacity: 0,
              },
            }}
          >
            {cardContent}
          </CardActionArea>
        ) : (
          cardContent
        )}

        {/* Actions */}
        {isAdmin && (
          <CardActions
            sx={{
              justifyContent: 'flex-end',

              gap: 0.65,

              px: 1.75,

              py: 1,

              borderTop: '1px solid #d5d5d9',

              background:
                'linear-gradient(180deg, #f5f5f6 0%, #eeeeef 100%)',
            }}
          >
            <Tooltip
              title={
                isArchived
                  ? 'Activate'
                  : 'Archive'
              }
            >
              <IconButton
                size="small"
                onClick={handleStatusChange}
                color={
                  isArchived
                    ? 'primary'
                    : 'default'
                }
                aria-label={
                  isArchived
                    ? 'Activate container'
                    : 'Archive container'
                }
                disabled={isLoading}
                sx={{
                  width: 38,
                  height: 38,

                  borderRadius: 2,

                  color: '#48484d',

                  border: '1px solid #cfcfd3',

                  backgroundColor: '#ffffff',

                  boxShadow:
                    '0 2px 7px rgba(0,0,0,0.055)',

                  transition:
                    'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                  '&:hover': {
                    color: '#202024',

                    backgroundColor: '#ffffff',

                    borderColor: '#b5b5ba',

                    transform: 'scale(1.05)',

                    boxShadow:
                      '0 5px 12px rgba(0,0,0,0.10)',
                  },

                  '&.Mui-disabled': {
                    color: '#99999e',

                    backgroundColor: '#f5f5f6',

                    borderColor: '#dedee1',
                  },
                }}
              >
                {statusLoading ? (
                  <CircularProgress
                    size={18}
                    color="inherit"
                  />
                ) : isArchived ? (
                  <UnarchiveIcon
                    sx={{
                      fontSize: 20,
                    }}
                  />
                ) : (
                  <ArchiveIcon
                    sx={{
                      fontSize: 20,
                    }}
                  />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={handleDeleteClick}
                aria-label="Delete container"
                disabled={isLoading}
                sx={{
                  width: 38,
                  height: 38,

                  borderRadius: 2,

                  color: '#c9353f',

                  border: '1px solid #e9c6c9',

                  backgroundColor: '#ffffff',

                  boxShadow:
                    '0 2px 7px rgba(0,0,0,0.055)',

                  transition:
                    'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                  '&:hover': {
                    color: '#c9353f',

                    backgroundColor: '#ffffff',

                    borderColor: '#df9fa5',

                    transform: 'scale(1.05)',

                    boxShadow:
                      '0 5px 12px rgba(201,53,63,0.12)',
                  },

                  '&.Mui-disabled': {
                    color: '#d9a2a6',

                    backgroundColor: '#f7f7f8',

                    borderColor: '#eadada',
                  },
                }}
              >
                <DeleteIcon
                  sx={{
                    fontSize: 20,
                  }}
                />
              </IconButton>
            </Tooltip>
          </CardActions>
        )}
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Container"
        message={`Are you sure you want to delete container "${container.name}"? This action can be undone from the trash.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleteLoading}
        confirmColor="error"
      />
    </>
  );
};

export default ContainerCard;