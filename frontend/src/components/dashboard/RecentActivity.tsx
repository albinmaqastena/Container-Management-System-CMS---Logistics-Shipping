// src/components/dashboard/RecentActivity.tsx

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Alert,
  Divider,
  Tooltip,
} from '@mui/material';

import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utilis/constants';
import { auditService } from '../../services/audit.service';

import type {
  AuditLog,
  AuditAction,
  AuditStatus,
} from '../../types';

interface RecentActivityProps {
  maxItems?: number;
}

type StatusColor =
  | 'success'
  | 'error'
  | 'warning'
  | 'text';

const getStatusColor = (
  status?: AuditStatus,
): StatusColor => {
  switch (status) {
    case 'success':
      return 'success';

    case 'failed':
    case 'error':
      return 'error';

    case 'pending':
      return 'warning';

    default:
      return 'text';
  }
};

const getStatusTextColor = (
  status: AuditStatus | undefined,
  theme: Theme,
): string => {
  const colorType =
    getStatusColor(status);

  switch (colorType) {
    case 'success':
      return theme.palette.success.main;

    case 'error':
      return theme.palette.error.main;

    case 'warning':
      return theme.palette.warning.main;

    default:
      return theme.palette.text.secondary;
  }
};

const formatActionLabel = (
  action: AuditAction,
): string => {
  return action
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase(),
    );
};

const formatDateTime = (
  value: string,
): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString();
};

export const RecentActivity = ({
  maxItems = 5,
}: RecentActivityProps) => {
  const { user } = useAuth();
  const theme = useTheme();

  const [
    activities,
    setActivities,
  ] = useState<AuditLog[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const isSuperAdmin =
    user?.role === ROLES.SUPER_ADMIN;

  const safeMaxItems =
    Math.max(
      1,
      Math.floor(maxItems),
    );

  const loadActivities = useCallback(
    async (
      showRefresh = false,
    ): Promise<void> => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response =
          await auditService.getAll({
            limit: safeMaxItems,
            offset: 0,
            sort: 'createdAt:DESC',
          });

        setActivities(
          response.data,
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load recent activity';

        setError(message);
      } finally {
        if (showRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [safeMaxItems],
  );

  useEffect(() => {
    if (isSuperAdmin) {
      void loadActivities();
    } else {
      setLoading(false);
    }
  }, [
    isSuperAdmin,
    loadActivities,
  ]);

  const handleRefresh =
    useCallback((): void => {
      void loadActivities(true);
    }, [loadActivities]);

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',

        height: '100%',

        display: 'flex',

        flexDirection: 'column',

        overflow: 'hidden',

        borderRadius: 3,

        backgroundColor:
          '#ffffff',

        border:
          '1px solid #d7d7db',

        boxShadow:
          '0 6px 20px rgba(0,0,0,0.055)',

        '&::before': {
          content: '""',

          position: 'absolute',

          top: 0,
          left: 0,

          width: 4,
          height: '100%',

          backgroundColor:
            '#55555a',
        },
      }}
    >
      <CardContent
        sx={{
          flexGrow: 1,

          p: {
            xs: 2.25,
            sm: 2.75,
            md: 3,
          },

          pl: {
            xs: 2.75,
            sm: 3.25,
            md: 3.5,
          },

          '&:last-child': {
            pb: {
              xs: 2.25,
              sm: 2.75,
              md: 3,
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

            alignItems: 'center',

            gap: 1.5,

            mb: 1.5,
          }}
        >
          <Box
            sx={{
              minWidth: 0,
            }}
          >
            <Typography
              component="h2"
              sx={{
                color: '#17171a',

                fontSize: {
                  xs: '1.05rem',
                  sm: '1.15rem',
                  md: '1.2rem',
                },

                fontWeight: 800,

                lineHeight: 1.2,

                letterSpacing:
                  '-0.025em',
              }}
            >
              Recent Activity
            </Typography>

            <Typography
              variant="body2"
              sx={{
                mt: 0.5,

                color: '#69696e',

                fontSize: {
                  xs: '0.76rem',
                  sm: '0.8rem',
                },

                fontWeight: 500,

                lineHeight: 1.5,
              }}
            >
              Latest system activity and changes.
            </Typography>
          </Box>

          <Tooltip title="Refresh activity">
            <IconButton
              size="small"
              onClick={handleRefresh}
              disabled={
                loading ||
                refreshing
              }
              aria-label="Refresh recent activity"
              sx={{
                width: 40,
                height: 40,

                flexShrink: 0,

                borderRadius: 2,

                color: '#444449',

                border:
                  '1px solid #d2d2d6',

                backgroundColor:
                  '#ffffff',

                boxShadow:
                  '0 2px 7px rgba(0,0,0,0.045)',

                transition:
                  'border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#18181b',

                  backgroundColor:
                    '#f2f2f4',

                  borderColor:
                    '#b9b9be',

                  transform:
                    'scale(1.04)',
                },

                '&.Mui-disabled': {
                  color: '#65656a',

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
                  size={18}
                  color="inherit"
                />
              ) : (
                <RefreshIcon
                  sx={{
                    fontSize: 20,
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        <Divider
          sx={{
            mb: 2,

            borderColor:
              '#e3e3e6',
          }}
        />

        {/* Loading */}
        {loading && (
          <Box
            sx={{
              minHeight: 180,

              display: 'flex',

              alignItems: 'center',

              justifyContent:
                'center',
            }}
          >
            <CircularProgress
              size={30}
              thickness={4}
              sx={{
                color: '#4f4f54',
              }}
            />
          </Box>
        )}

        {/* Error */}
        {error && !loading && (
          <Alert
            severity="error"
            sx={{
              mb: 2,

              borderRadius: 2,

              color: '#8b1f27',

              backgroundColor:
                '#fff2f3',

              border:
                '1px solid #efc9cc',

              boxShadow: 'none',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Empty state */}
        {!loading &&
          !error &&
          activities.length === 0 && (
            <Box
              sx={{
                minHeight: 180,

                display: 'flex',

                alignItems: 'center',

                justifyContent:
                  'center',

                px: 2,
              }}
            >
              <Typography
                align="center"
                sx={{
                  color: '#707075',

                  fontSize: {
                    xs: '0.8rem',
                    sm: '0.84rem',
                  },

                  fontWeight: 500,
                }}
              >
                No recent activity
              </Typography>
            </Box>
          )}

        {/* Activities */}
        {!loading &&
          !error &&
          activities.length > 0 && (
            <List
              dense
              sx={{
                p: 0,
              }}
            >
              {activities.map(
                (log, index) => {
                  const username =
                    log.user
                      ?.username ||
                    'Unknown user';

                  const actionLabel =
                    formatActionLabel(
                      log.action,
                    );

                  const statusColor =
                    getStatusTextColor(
                      log.status,
                      theme,
                    );

                  return (
                    <Fragment
                      key={log.id}
                    >
                      <ListItem
                        sx={{
                          px: {
                            xs: 1.25,
                            sm: 1.5,
                          },

                          py: {
                            xs: 1.3,
                            sm: 1.45,
                          },

                          borderRadius:
                            2,

                          transition:
                            'background-color 0.18s ease',

                          '&:hover': {
                            backgroundColor:
                              '#f5f5f6',
                          },
                        }}
                      >
                        <ListItemText
                          sx={{
                            m: 0,
                          }}
                          primary={
                            <Box
                              sx={{
                                display:
                                  'flex',

                                alignItems:
                                  'center',

                                gap: 1,

                                flexWrap:
                                  'wrap',
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    '#202024',

                                  fontSize: {
                                    xs: '0.8rem',
                                    sm: '0.84rem',
                                  },

                                  fontWeight:
                                    700,

                                  lineHeight:
                                    1.4,
                                }}
                              >
                                {username}
                              </Typography>

                              <Typography
                                variant="body2"
                                sx={{
                                  color:
                                    '#505055',

                                  fontSize: {
                                    xs: '0.78rem',
                                    sm: '0.82rem',
                                  },

                                  fontWeight:
                                    600,

                                  lineHeight:
                                    1.4,
                                }}
                              >
                                {actionLabel}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box
                              sx={{
                                display:
                                  'flex',

                                alignItems:
                                  'center',

                                gap: 0.75,

                                mt: 0.65,

                                flexWrap:
                                  'wrap',
                              }}
                            >
                              {log.targetType && (
                                <>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color:
                                        '#66666b',

                                      fontSize:
                                        '0.7rem',

                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    {
                                      log.targetType
                                    }

                                    {log.targetId &&
                                      ` #${log.targetId.slice(
                                        0,
                                        8,
                                      )}`}
                                  </Typography>

                                  <Typography
                                    component="span"
                                    sx={{
                                      color:
                                        '#a0a0a5',

                                      fontSize:
                                        '0.7rem',
                                    }}
                                  >
                                    •
                                  </Typography>
                                </>
                              )}

                              <Typography
                                variant="caption"
                                sx={{
                                  color:
                                    '#77777c',

                                  fontSize:
                                    '0.7rem',

                                  fontWeight:
                                    500,
                                }}
                              >
                                {formatDateTime(
                                  log.createdAt,
                                )}
                              </Typography>

                              {log.status && (
                                <>
                                  <Typography
                                    component="span"
                                    sx={{
                                      color:
                                        '#a0a0a5',

                                      fontSize:
                                        '0.7rem',
                                    }}
                                  >
                                    •
                                  </Typography>

                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color:
                                        statusColor,

                                      fontSize:
                                        '0.7rem',

                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    {formatActionLabel(
                                      log.status,
                                    )}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>

                      {index <
                        activities.length -
                          1 && (
                        <Divider
                          sx={{
                            borderColor:
                              '#ececef',
                          }}
                        />
                      )}
                    </Fragment>
                  );
                },
              )}
            </List>
          )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;