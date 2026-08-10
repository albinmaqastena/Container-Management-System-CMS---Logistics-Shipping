// src/pages/ContainerDetailPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useParams,
  useNavigate,
} from 'react-router-dom';

import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';

import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PictureAsPdfOutlined as PdfIcon,
  TableChartOutlined as ExcelIcon,
} from '@mui/icons-material';

import { toast } from 'react-toastify';

import { useContainers } from '../hooks/useContainers';
import { useItems } from '../hooks/useItems';
import { useAuth } from '../hooks/useAuth';
import { useReports } from '../hooks/useReports';

import { ROLES } from '../utilis/constants';

import { ContainerStatus } from '../types';
import type { Container } from '../types';

import { CreateItemModal } from '../components/items/CreateItemModal';
import { ItemList } from '../components/items/ItemList';
import { SearchBar } from '../components/common/UI/SearchBar';
import { ConfirmDialog } from '../components/common/Modals/ConfirmDialog';
import { LoadingSpinner } from '../components/common/UI/LoadingSpinner';

const formatStatusLabel = (
  value: string,
): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase(),
    );

const normalizeVolume = (
  value: unknown,
): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : 0;
};

const normalizeNonNegative = (
  value: unknown,
): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : 0;
};

export const ContainerDetailPage = () => {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();

  const { user } = useAuth();

  const {
    exportContainerPdf,
    exportContainerExcel,
    loading: reportsLoading,
  } = useReports();

  const {
    getContainer,
    updateContainerStatus,
    softDeleteContainer,
    isLoading,
  } = useContainers();

  const {
    items,
    fetchItems,
    softDeleteItem,
    isLoading: itemsLoading,
  } = useItems();

  const [
    container,
    setContainer,
  ] = useState<Container | null>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    isCreateItemModalOpen,
    setIsCreateItemModalOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  const [
    deleteLoading,
    setDeleteLoading,
  ] = useState(false);

  const [
    statusLoading,
    setStatusLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const isAdmin =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.SUPER_ADMIN;

  const totalVolume =
    normalizeVolume(
      container?.totalVolume,
    );

  const usedVolume =
    normalizeNonNegative(
      container?.usedVolume,
    );

  const rawAvailableVolume =
    Number(
      container?.availableVolume,
    );

  const availableVolume =
    Number.isFinite(
      rawAvailableVolume,
    ) &&
    rawAvailableVolume >= 0
      ? rawAvailableVolume
      : Math.max(
          totalVolume - usedVolume,
          0,
        );

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

  const isArchived =
    container?.status ===
    ContainerStatus.ARCHIVED;

  const filteredItems = useMemo(
    () => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      if (!query) return items;

      return items.filter(
        (item) =>
          item.name
            .toLowerCase()
            .includes(query) ||
          item.uniqueNumber
            .toLowerCase()
            .includes(query),
      );
    },
    [items, searchQuery],
  );

  const loadContainerDetails =
    useCallback(async () => {
      if (!id) return;

      setError(null);

      try {
        const data =
          await getContainer(id);

        setContainer(data);

        await fetchItems({
          containerId: id,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load container';

        setError(message);
      }
    }, [
      id,
      getContainer,
      fetchItems,
    ]);

  useEffect(() => {
    void loadContainerDetails();
  }, [loadContainerDetails]);

  const handleRefresh =
    useCallback(async () => {
      if (refreshing) return;

      setRefreshing(true);

      try {
        await loadContainerDetails();
      } finally {
        setRefreshing(false);
      }
    }, [
      loadContainerDetails,
      refreshing,
    ]);

  const handleExportPdf =
    useCallback(async (): Promise<void> => {
      if (
        !container ||
        reportsLoading.containerPdf
      ) {
        return;
      }

      try {
        await exportContainerPdf(
          container.id,
        );
      } catch {
        toast.error(
          'Failed to export PDF report',
        );
      }
    }, [
      container,
      exportContainerPdf,
      reportsLoading.containerPdf,
    ]);

  const handleExportExcel =
    useCallback(async (): Promise<void> => {
      if (
        !container ||
        reportsLoading.containerExcel
      ) {
        return;
      }

      try {
        await exportContainerExcel(
          container.id,
        );
      } catch {
        toast.error(
          'Failed to export Excel report',
        );
      }
    }, [
      container,
      exportContainerExcel,
      reportsLoading.containerExcel,
    ]);

  const handleStatusChange =
    useCallback(async () => {
      if (
        !container ||
        statusLoading
      ) {
        return;
      }

      const newStatus =
        isArchived
          ? ContainerStatus.ACTIVE
          : ContainerStatus.ARCHIVED;

      setStatusLoading(true);

      try {
        const updated =
          await updateContainerStatus(
            container.id,
            newStatus,
          );

        setContainer(updated);

        toast.success(
          `Container ${
            newStatus ===
            ContainerStatus.ACTIVE
              ? 'activated'
              : 'archived'
          }`,
        );
      } catch {
        toast.error(
          'Failed to update status',
        );
      } finally {
        setStatusLoading(false);
      }
    }, [
      container,
      isArchived,
      updateContainerStatus,
      statusLoading,
    ]);

  const handleDeleteClick =
    useCallback(() => {
      setDeleteDialogOpen(true);
    }, []);

  const handleDeleteConfirm =
    useCallback(async () => {
      if (!container) return;

      setDeleteLoading(true);

      try {
        await softDeleteContainer(
          container.id,
        );

        toast.success(
          'Container deleted',
        );

        setDeleteDialogOpen(false);

        navigate('/containers');
      } catch {
        toast.error(
          'Failed to delete container',
        );
      } finally {
        setDeleteLoading(false);
      }
    }, [
      container,
      softDeleteContainer,
      navigate,
    ]);

  const handleDeleteCancel =
    useCallback(() => {
      setDeleteDialogOpen(false);
    }, []);

  const handleItemDeleted =
    useCallback(
      async (itemId: string) => {
        try {
          await softDeleteItem(
            itemId,
          );

          await loadContainerDetails();

          toast.success(
            'Item deleted',
          );
        } catch {
          toast.error(
            'Failed to delete item',
          );
        }
      },
      [
        softDeleteItem,
        loadContainerDetails,
      ],
    );

  if (isLoading) {
    return (
      <LoadingSpinner
        message="Loading container details..."
        minHeight="300px"
      />
    );
  }

  if (error && !container) {
    return (
      <Box
        sx={{
          px: {
            xs: 0,
            sm: 0.5,
            md: 1,
          },

          pt: 2,
        }}
      >
        <Alert
          severity="error"
          onClose={() =>
            setError(null)
          }
          sx={{
            borderRadius: 2,

            border:
              '1px solid #efc9cc',

            backgroundColor:
              '#fff3f4',

            color: '#8b1f27',
          }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!container) {
    return (
      <Box
        sx={{
          px: {
            xs: 0,
            sm: 0.5,
            md: 1,
          },

          pt: 2,
        }}
      >
        <Alert
          severity="warning"
          sx={{
            borderRadius: 2,

            border:
              '1px solid #ead9ae',

            backgroundColor:
              '#fff9ea',
          }}
        >
          Container not found
        </Alert>
      </Box>
    );
  }

  const isBusy =
    statusLoading ||
    refreshing ||
    deleteLoading ||
    reportsLoading.containerPdf ||
    reportsLoading.containerExcel;

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
      {/* Header */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          justifyContent:
            'space-between',

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          mb: {
            xs: 2.5,
            sm: 3,
          },

          gap: {
            xs: 1.5,
            sm: 2,
          },
        }}
      >
        <Button
          startIcon={
            <ArrowBackIcon />
          }
          onClick={() =>
            navigate('/containers')
          }
          sx={{
            alignSelf: {
              xs: 'flex-start',
              sm: 'center',
            },

            minHeight: 42,

            px: 1.5,

            borderRadius: 2,

            color: '#303034',

            fontSize: '0.84rem',

            fontWeight: 700,

            textTransform: 'none',

            backgroundColor:
              '#ffffff',

            border:
              '1px solid #d2d2d6',

            '&:hover': {
              color: '#18181b',

              backgroundColor:
                '#f3f3f5',

              borderColor:
                '#b9b9be',
            },
          }}
        >
          Back
        </Button>

        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            justifyContent: {
              xs: 'flex-start',
              sm: 'flex-end',
            },

            gap: 0.8,

            flexWrap: 'wrap',
          }}
        >
          {/* Refresh */}
          <IconButton
            onClick={handleRefresh}
            title="Refresh"
            aria-label="Refresh"
            disabled={isBusy}
            sx={{
              width: 40,
              height: 40,

              borderRadius: 2,

              color: '#444449',

              border:
                '1px solid #d2d2d6',

              backgroundColor:
                '#ffffff',

              '&:hover': {
                color: '#18181b',

                backgroundColor:
                  '#f2f2f4',

                borderColor:
                  '#b9b9be',
              },

              '&.Mui-disabled': {
                color: '#69696e',

                borderColor:
                  '#c7c7cc',

                backgroundColor:
                  '#ececef',

                opacity: 1,
              },
            }}
          >
            {refreshing ? (
              <CircularProgress
                size={20}
                color="inherit"
              />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>

          {isAdmin && (
            <>
              {/* Export PDF */}
              <Button
                variant="outlined"
                startIcon={
                  reportsLoading.containerPdf ? (
                    <CircularProgress
                      size={17}
                      color="inherit"
                    />
                  ) : (
                    <PdfIcon />
                  )
                }
                onClick={() => {
                  void handleExportPdf();
                }}
                disabled={isBusy}
                sx={{
                  minHeight: 40,

                  px: {
                    xs: 1.25,
                    sm: 1.5,
                  },

                  borderRadius: 2,

                  borderColor:
                    '#d4b9bc',

                  color: '#a8323b',

                  backgroundColor:
                    '#ffffff',

                  fontSize: '0.78rem',

                  fontWeight: 700,

                  textTransform: 'none',

                  boxShadow: 'none',

                  '&:hover': {
                    borderColor:
                      '#c78f95',

                    backgroundColor:
                      '#fff5f5',

                    color: '#a8323b',

                    boxShadow: 'none',
                  },

                  '&.Mui-disabled': {
                    borderColor:
                      '#dedee2',

                    backgroundColor:
                      '#f5f5f6',

                    color: '#99999e',

                    opacity: 1,
                  },
                }}
              >
                {reportsLoading.containerPdf
                  ? 'Exporting...'
                  : 'PDF'}
              </Button>

              {/* Export Excel */}
              <Button
                variant="outlined"
                startIcon={
                  reportsLoading.containerExcel ? (
                    <CircularProgress
                      size={17}
                      color="inherit"
                    />
                  ) : (
                    <ExcelIcon />
                  )
                }
                onClick={() => {
                  void handleExportExcel();
                }}
                disabled={isBusy}
                sx={{
                  minHeight: 40,

                  px: {
                    xs: 1.25,
                    sm: 1.5,
                  },

                  borderRadius: 2,

                  borderColor:
                    '#bfd6c7',

                  color: '#327047',

                  backgroundColor:
                    '#ffffff',

                  fontSize: '0.78rem',

                  fontWeight: 700,

                  textTransform: 'none',

                  boxShadow: 'none',

                  '&:hover': {
                    borderColor:
                      '#91bca0',

                    backgroundColor:
                      '#f2f8f4',

                    color: '#327047',

                    boxShadow: 'none',
                  },

                  '&.Mui-disabled': {
                    borderColor:
                      '#dedee2',

                    backgroundColor:
                      '#f5f5f6',

                    color: '#99999e',

                    opacity: 1,
                  },
                }}
              >
                {reportsLoading.containerExcel
                  ? 'Exporting...'
                  : 'Excel'}
              </Button>

              {/* Archive / Activate */}
              <IconButton
                color={
                  isArchived
                    ? 'primary'
                    : 'default'
                }
                onClick={
                  handleStatusChange
                }
                title={
                  isArchived
                    ? 'Activate'
                    : 'Archive'
                }
                aria-label={
                  isArchived
                    ? 'Activate container'
                    : 'Archive container'
                }
                disabled={isBusy}
                sx={{
                  width: 40,
                  height: 40,

                  borderRadius: 2,

                  color: '#444449',

                  border:
                    '1px solid #d2d2d6',

                  backgroundColor:
                    '#ffffff',

                  '&:hover': {
                    color: '#18181b',

                    backgroundColor:
                      '#f2f2f4',

                    borderColor:
                      '#b9b9be',
                  },

                  '&.Mui-disabled': {
                    color: '#77777c',

                    borderColor:
                      '#ceced2',

                    backgroundColor:
                      '#eeeeF0',

                    opacity: 1,
                  },
                }}
              >
                {isArchived ? (
                  <UnarchiveIcon />
                ) : (
                  <ArchiveIcon />
                )}
              </IconButton>

              {/* Delete */}
              <IconButton
                color="error"
                onClick={
                  handleDeleteClick
                }
                title="Delete"
                aria-label="Delete container"
                disabled={isBusy}
                sx={{
                  width: 40,
                  height: 40,

                  borderRadius: 2,

                  color: '#c23640',

                  border:
                    '1px solid #efc8cb',

                  backgroundColor:
                    '#ffffff',

                  '&:hover': {
                    color: '#c23640',

                    backgroundColor:
                      '#fff1f2',

                    borderColor:
                      '#e4aeb3',
                  },

                  '&.Mui-disabled': {
                    color: '#d29a9f',

                    borderColor:
                      '#ead8da',

                    backgroundColor:
                      '#f7f7f8',

                    opacity: 1,
                  },
                }}
              >
                <DeleteIcon />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() =>
            setError(null)
          }
          sx={{
            mb: 2.5,

            borderRadius: 2,

            border:
              '1px solid #efc9cc',

            backgroundColor:
              '#fff3f4',

            color: '#8b1f27',
          }}
        >
          {error}
        </Alert>
      )}

      {/* Container Info */}
      <Paper
        elevation={0}
        sx={{
          p: {
            xs: 2.25,
            sm: 2.75,
            md: 3,
          },

          mb: 3,

          borderRadius: 3,

          backgroundColor:
            '#ffffff',

          border:
            '1px solid #d8d8dc',

          boxShadow:
            '0 6px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            flexDirection: {
              xs: 'column',
              md: 'row',
            },

            gap: {
              xs: 2.5,
              md: 3.5,
            },
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="h4"
              gutterBottom
              sx={{
                color: '#151518',

                fontSize: {
                  xs: '1.55rem',
                  sm: '1.75rem',
                  md: '2rem',
                },

                fontWeight: 800,

                lineHeight: 1.2,

                letterSpacing:
                  '-0.03em',
              }}
            >
              {container.name}
            </Typography>

            <Typography
              variant="body2"
              gutterBottom
              sx={{
                color: '#65656a',

                fontSize: '0.82rem',

                fontWeight: 600,
              }}
            >
              Code:{' '}
              {container.containerCode}
            </Typography>

            {container.description && (
              <Typography
                variant="body1"
                sx={{
                  mt: 1,

                  color: '#3f3f44',

                  fontSize: {
                    xs: '0.86rem',
                    sm: '0.92rem',
                  },

                  lineHeight: 1.65,
                }}
              >
                {
                  container.description
                }
              </Typography>
            )}

            <Box
              sx={{
                mt: 2,

                display: 'flex',

                gap: 1,

                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={formatStatusLabel(
                  container.status,
                )}
                color={
                  container.status ===
                  ContainerStatus.ACTIVE
                    ? 'success'
                    : 'default'
                }
                size="medium"
                sx={{
                  height: 30,

                  borderRadius: 2,

                  fontWeight: 700,

                  '& .MuiChip-label': {
                    px: 1.3,
                  },
                }}
              />

              <Chip
                label={`${items.length} items`}
                color="primary"
                size="medium"
                sx={{
                  height: 30,

                  borderRadius: 2,

                  fontWeight: 700,

                  '& .MuiChip-label': {
                    px: 1.3,
                  },
                }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              flex: {
                xs: '1 1 auto',
                md: '0 0 320px',
              },

              p: {
                xs: 1.75,
                sm: 2,
              },

              borderRadius: 2.5,

              backgroundColor:
                '#f1f1f3',

              border:
                '1px solid #d8d8dc',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: '#4a4a4f',

                fontSize: '0.78rem',

                fontWeight: 700,

                textTransform:
                  'uppercase',

                letterSpacing:
                  '0.04em',
              }}
            >
              Volume Usage
            </Typography>

            <Box
              sx={{
                display: 'flex',

                justifyContent:
                  'space-between',

                alignItems: 'center',

                mt: 1.1,

                gap: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#242428',

                  fontSize: '0.82rem',

                  fontWeight: 700,
                }}
              >
                {usedVolume.toFixed(
                  2,
                )}{' '}
                /{' '}
                {totalVolume.toFixed(
                  2,
                )}{' '}
                m³
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: '#4f4f54',

                  fontSize: '0.8rem',

                  fontWeight: 700,
                }}
              >
                {usagePercentage.toFixed(
                  1,
                )}
                %
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
                mt: 1.2,

                height: 8,

                borderRadius: 999,

                backgroundColor:
                  '#d5d5d9',

                '& .MuiLinearProgress-bar':
                  {
                    borderRadius: 999,
                  },
              }}
            />

            <Typography
              variant="body2"
              sx={{
                mt: 1,

                color: '#5f5f64',

                fontSize: '0.78rem',

                fontWeight: 600,
              }}
            >
              Available:{' '}
              {availableVolume.toFixed(
                2,
              )}{' '}
              m³
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Items Section */}
      <Paper
        elevation={0}
        sx={{
          p: {
            xs: 2.25,
            sm: 2.75,
            md: 3,
          },

          borderRadius: 3,

          backgroundColor:
            '#ffffff',

          border:
            '1px solid #d8d8dc',

          boxShadow:
            '0 6px 20px rgba(0,0,0,0.05)',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            flexDirection: {
              xs: 'column',
              sm: 'row',
            },

            justifyContent:
              'space-between',

            alignItems: {
              xs: 'stretch',
              sm: 'center',
            },

            mb: {
              xs: 2.25,
              sm: 2.75,
            },

            gap: 2,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              color: '#17171a',

              fontSize: {
                xs: '1.15rem',
                sm: '1.3rem',
              },

              fontWeight: 800,

              letterSpacing:
                '-0.02em',
            }}
          >
            Items
          </Typography>

          <Box
            sx={{
              display: 'flex',

              flexDirection: {
                xs: 'column',
                sm: 'row',
              },

              gap: 1.25,

              alignItems: {
                xs: 'stretch',
                sm: 'center',
              },
            }}
          >
            <Box
              sx={{
                width: {
                  xs: '100%',
                  sm: 280,
                },
              }}
            >
              <SearchBar
                value={
                  searchQuery
                }
                onChange={
                  setSearchQuery
                }
                placeholder="Search items..."
              />
            </Box>

            {isAdmin && (
              <Button
                variant="contained"
                startIcon={
                  <AddIcon />
                }
                onClick={() =>
                  setIsCreateItemModalOpen(
                    true,
                  )
                }
                sx={{
                  minHeight: 44,

                  px: 2.25,

                  borderRadius: 2,

                  backgroundColor:
                    '#202024',

                  color: '#ffffff',

                  fontSize: '0.84rem',

                  fontWeight: 700,

                  textTransform:
                    'none',

                  boxShadow: 'none',

                  '&:hover': {
                    backgroundColor:
                      '#111114',

                    color: '#ffffff',

                    boxShadow: 'none',
                  },
                }}
              >
                Add Item
              </Button>
            )}
          </Box>
        </Box>

        <ItemList
          items={filteredItems}
          loading={itemsLoading}
          emptyMessage={
            searchQuery
              ? 'No items match your search'
              : 'No items in this container yet'
          }
          onDelete={
            handleItemDeleted
          }
        />
      </Paper>

      <CreateItemModal
        open={
          isCreateItemModalOpen
        }
        onClose={() =>
          setIsCreateItemModalOpen(
            false,
          )
        }
        containerId={
          container.id
        }
        onItemCreated={
          loadContainerDetails
        }
      />

      <ConfirmDialog
        open={
          deleteDialogOpen
        }
        title="Delete Container"
        message={`Are you sure you want to delete container "${container.name}"? This action can be undone from the trash.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={
          handleDeleteConfirm
        }
        onCancel={
          handleDeleteCancel
        }
        loading={
          deleteLoading
        }
        confirmColor="error"
      />
    </Box>
  );
};

export default ContainerDetailPage;