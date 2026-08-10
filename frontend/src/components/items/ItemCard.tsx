// src/components/items/ItemCard.tsx

import { useState } from 'react';

import type { Item } from '../../types';

import { ROLES } from '../../utilis/constants';
import { useAuth } from '../../hooks/useAuth';

import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  CardActions,
  LinearProgress,
  Tooltip,
} from '@mui/material';

import {
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

import { EditItemModal } from './EditItemModal';

interface ItemCardProps {
  item: Item;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
}

export const ItemCard = ({
  item,
  onEdit,
  onDelete,
}: ItemCardProps) => {
  const { user } = useAuth();

  const [
    editDialogOpen,
    setEditDialogOpen,
  ] = useState(false);

  const isAdmin =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.SUPER_ADMIN;

  // Normalizimi i vlerave numerike
  const rawPackagePrice =
    Number(item.packagePrice);

  const packagePrice =
    Number.isFinite(rawPackagePrice) &&
    rawPackagePrice >= 0
      ? rawPackagePrice
      : 0;

  const rawVolume =
    Number(item.volume);

  const volume =
    Number.isFinite(rawVolume) &&
    rawVolume >= 0
      ? rawVolume
      : 0;

  const rawTotalVolume =
    Number(item.totalVolume);

  const totalVolume =
    Number.isFinite(rawTotalVolume) &&
    rawTotalVolume >= 0
      ? rawTotalVolume
      : 0;

  const rawContainerVolume =
    Number(item.container?.totalVolume);

  const containerVolume =
    Number.isFinite(rawContainerVolume) &&
    rawContainerVolume > 0
      ? rawContainerVolume
      : 0;

  const rawPackageQuantity =
    Number(item.packageQuantity);

  const packageQuantity =
    Number.isInteger(rawPackageQuantity) &&
    rawPackageQuantity > 0
      ? rawPackageQuantity
      : 0;

  const rawProductsPerPackage =
    Number(item.productsPerPackage);

  const productsPerPackage =
    Number.isInteger(rawProductsPerPackage) &&
    rawProductsPerPackage > 0
      ? rawProductsPerPackage
      : 0;

  const volumePercentage =
    containerVolume > 0
      ? Math.min(
          Math.max(
            (
              totalVolume /
              containerVolume
            ) * 100,
            0,
          ),
          100,
        )
      : 0;

  const handleEditClick = (): void => {
    if (onEdit) {
      onEdit(item);
      return;
    }

    setEditDialogOpen(true);
  };

  const handleEditClose = (): void => {
    setEditDialogOpen(false);
  };

  return (
    <>
      <Card
        elevation={0}
        sx={{
          position: 'relative',

          height: '100%',

          display: 'flex',

          flexDirection: 'column',

          overflow: 'hidden',

          backgroundColor: '#ffffff',

          border:
            '1px solid #cfcfd4',

          borderRadius: {
            xs: 3,
            sm: 3.25,
          },

          boxShadow:
            '0 8px 24px rgba(0,0,0,0.075)',

          transition:
            'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',

          '&::before': {
            content: '""',

            position: 'absolute',

            top: 0,
            left: 0,
            right: 0,

            height: 3,

            background:
              'linear-gradient(90deg, #202024 0%, #5b5b60 100%)',

            zIndex: 2,
          },

          '&:hover': {
            transform:
              'translateY(-3px)',

            borderColor:
              '#a9a9ae',

            boxShadow:
              '0 14px 30px rgba(0,0,0,0.12)',
          },
        }}
      >
        <CardContent
          sx={{
            flexGrow: 1,

            p: {
              xs: 2.25,
              sm: 2.75,
            },

            backgroundColor:
              '#ffffff',

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

              justifyContent:
                'space-between',

              alignItems:
                'flex-start',

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
                title={item.name}
                sx={{
                  color: '#121214',

                  fontWeight: 800,

                  fontSize: {
                    xs: '1.04rem',
                    sm: '1.1rem',
                  },

                  lineHeight: 1.25,

                  letterSpacing:
                    '-0.025em',
                }}
              >
                {item.name}
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.45,

                  color: '#66666b',

                  fontSize: {
                    xs: '0.75rem',
                    sm: '0.79rem',
                  },

                  fontWeight: 500,
                }}
              >
                Item details
              </Typography>
            </Box>

            <Chip
              label={item.uniqueNumber}
              size="small"
              title={item.uniqueNumber}
              sx={{
                flexShrink: 0,

                maxWidth: {
                  xs: 130,
                  sm: 170,
                },

                height: 27,

                borderRadius: 999,

                backgroundColor:
                  '#eeeeF0',

                color: '#3f3f44',

                border:
                  '1px solid #d5d5d9',

                fontSize: '0.68rem',

                fontWeight: 700,

                letterSpacing:
                  '0.02em',

                '& .MuiChip-label': {
                  px: 1.2,

                  overflow: 'hidden',

                  textOverflow:
                    'ellipsis',

                  whiteSpace: 'nowrap',

                  marginTop: '5px',
                },
              }}
            />
          </Box>

          {/* Photo */}
          {item.photo && (
            <Box
              sx={{
                mt: 1.8,

                p: 0.75,

                borderRadius: 2.25,

                backgroundColor:
                  '#f4f4f6',

                border:
                  '1px solid #d8d8dc',
              }}
            >
              <Box
                component="img"
                src={item.photo}
                alt={item.name}
                sx={{
                  display: 'block',

                  width: '100%',

                  height: {
                    xs: 150,
                    sm: 160,
                  },

                  objectFit: 'cover',

                  borderRadius: 1.75,

                  backgroundColor:
                    '#ffffff',
                }}
              />
            </Box>
          )}

          {/* Details */}
          <Box
            sx={{
              mt: 2,

              display: 'grid',

              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
              },

              gap: 1.25,
            }}
          >
            {/* Package Quantity */}
            <Box
              sx={{
                p: 1.35,

                borderRadius: 2,

                backgroundColor:
                  '#f5f5f6',

                border:
                  '1px solid #dedee1',
              }}
            >
              <Typography
                sx={{
                  color: '#707075',

                  fontSize: '0.68rem',

                  fontWeight: 700,

                  textTransform:
                    'uppercase',

                  letterSpacing:
                    '0.035em',
                }}
              >
                Package Quantity
              </Typography>

              <Typography
                sx={{
                  mt: 0.35,

                  color: '#202024',

                  fontSize: '0.86rem',

                  fontWeight: 800,
                }}
              >
                {packageQuantity}
              </Typography>
            </Box>

            {/* Products / Package */}
            <Box
              sx={{
                p: 1.35,

                borderRadius: 2,

                backgroundColor:
                  '#f5f5f6',

                border:
                  '1px solid #dedee1',
              }}
            >
              <Typography
                sx={{
                  color: '#707075',

                  fontSize: '0.68rem',

                  fontWeight: 700,

                  textTransform:
                    'uppercase',

                  letterSpacing:
                    '0.035em',
                }}
              >
                Products / Package
              </Typography>

              <Typography
                sx={{
                  mt: 0.35,

                  color: '#202024',

                  fontSize: '0.86rem',

                  fontWeight: 800,
                }}
              >
                {productsPerPackage}
              </Typography>
            </Box>

            {/* Price / Package */}
            <Box
              sx={{
                p: 1.35,

                borderRadius: 2,

                backgroundColor:
                  '#f5f5f6',

                border:
                  '1px solid #dedee1',
              }}
            >
              <Typography
                sx={{
                  color: '#707075',

                  fontSize: '0.68rem',

                  fontWeight: 700,

                  textTransform:
                    'uppercase',

                  letterSpacing:
                    '0.035em',
                }}
              >
                Price / Package
              </Typography>

              <Typography
                sx={{
                  mt: 0.35,

                  color: '#202024',

                  fontSize: '0.86rem',

                  fontWeight: 800,
                }}
              >
                ${packagePrice.toFixed(2)}
              </Typography>
            </Box>

            {/* Volume / Package */}
            <Box
              sx={{
                p: 1.35,

                borderRadius: 2,

                backgroundColor:
                  '#f5f5f6',

                border:
                  '1px solid #dedee1',
              }}
            >
              <Typography
                sx={{
                  color: '#707075',

                  fontSize: '0.68rem',

                  fontWeight: 700,

                  textTransform:
                    'uppercase',

                  letterSpacing:
                    '0.035em',
                }}
              >
                Volume / Package
              </Typography>

              <Typography
                sx={{
                  mt: 0.35,

                  color: '#202024',

                  fontSize: '0.86rem',

                  fontWeight: 800,
                }}
              >
                {volume.toFixed(2)} m³
              </Typography>
            </Box>
          </Box>

          {/* Volume */}
          <Box
            sx={{
              mt: 2,

              p: {
                xs: 1.6,
                sm: 1.8,
              },

              borderRadius: 2.5,

              background:
                'linear-gradient(180deg, #f2f2f4 0%, #eaeaed 100%)',

              border:
                '1px solid #d5d5d9',
            }}
          >
            <Box
              sx={{
                display: 'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                gap: 1.5,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#29292d',

                  fontSize: '0.78rem',

                  fontWeight: 700,
                }}
              >
                Total Volume
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: '#202024',

                  fontSize: '0.8rem',

                  fontWeight: 800,

                  whiteSpace:
                    'nowrap',
                }}
              >
                {totalVolume.toFixed(2)} m³
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={volumePercentage}
              sx={{
                mt: 1.2,

                height: 7,

                borderRadius: 999,

                backgroundColor:
                  '#d1d1d5',

                '& .MuiLinearProgress-bar':
                  {
                    borderRadius: 999,

                    backgroundColor:
                      volumePercentage >
                      90
                        ? '#c53a43'
                        : volumePercentage >
                            70
                          ? '#b8872e'
                          : '#4e5e6f',
                  },
              }}
            />

            <Box
              sx={{
                mt: 0.85,

                display: 'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                gap: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#66666b',

                  fontSize: '0.7rem',

                  fontWeight: 600,
                }}
              >
                Container capacity
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  color: '#444449',

                  fontSize: '0.7rem',

                  fontWeight: 800,
                }}
              >
                {volumePercentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </CardContent>

        {/* Actions */}
        {isAdmin && (
          <CardActions
            sx={{
              justifyContent:
                'flex-end',

              gap: 0.65,

              px: 1.75,

              py: 1,

              borderTop:
                '1px solid #d5d5d9',

              background:
                'linear-gradient(180deg, #f5f5f6 0%, #eeeeef 100%)',
            }}
          >
            {/* Edit */}
            <Tooltip title="Edit item">
              <IconButton
                size="small"
                onClick={handleEditClick}
                aria-label={`Edit ${item.name}`}
                sx={{
                  width: 38,

                  height: 38,

                  borderRadius: 2,

                  color: '#48484d',

                  border:
                    '1px solid #cfcfd3',

                  backgroundColor:
                    '#ffffff',

                  boxShadow:
                    '0 2px 7px rgba(0,0,0,0.055)',

                  transition:
                    'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                  '&:hover': {
                    color:
                      '#202024',

                    backgroundColor:
                      '#ffffff',

                    borderColor:
                      '#b5b5ba',

                    transform:
                      'scale(1.05)',

                    boxShadow:
                      '0 5px 12px rgba(0,0,0,0.10)',
                  },
                }}
              >
                <EditIcon
                  sx={{
                    fontSize: 20,
                  }}
                />
              </IconButton>
            </Tooltip>

            {/* Delete */}
            {onDelete && (
              <Tooltip title="Delete item">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() =>
                    onDelete(item.id)
                  }
                  aria-label={`Delete ${item.name}`}
                  sx={{
                    width: 38,

                    height: 38,

                    borderRadius: 2,

                    color: '#c9353f',

                    border:
                      '1px solid #e9c6c9',

                    backgroundColor:
                      '#ffffff',

                    boxShadow:
                      '0 2px 7px rgba(0,0,0,0.055)',

                    transition:
                      'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

                    '&:hover': {
                      color:
                        '#c9353f',

                      backgroundColor:
                        '#ffffff',

                      borderColor:
                        '#df9fa5',

                      transform:
                        'scale(1.05)',

                      boxShadow:
                        '0 5px 12px rgba(201,53,63,0.12)',
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
            )}
          </CardActions>
        )}
      </Card>

      {/* Edit Item Modal */}
      <EditItemModal
        open={editDialogOpen}
        onClose={handleEditClose}
        item={item}
      />
    </>
  );
};

export default ItemCard;