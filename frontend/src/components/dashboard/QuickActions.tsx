// src/components/dashboard/QuickActions.tsx

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  useTheme,
} from '@mui/material';

import {
  Add as AddIcon,
  List as ListIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utilis/constants';

interface QuickActionsProps {
  onRefresh?: () => void;
  onCreateContainer?: () => void;
}

interface QuickAction {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  show: boolean;
}

export const QuickActions = ({
  onRefresh,
  onCreateContainer,
}: QuickActionsProps) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const isAdmin =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.SUPER_ADMIN;

  const actions: QuickAction[] = [
    {
      label: 'Create Container',
      description:
        'Add a new container to the system',
      icon: <AddIcon />,
      onClick: () => {
        if (onCreateContainer) {
          onCreateContainer();
          return;
        }

        navigate('/containers/create');
      },
      show: isAdmin,
    },
    {
      label: 'Active Containers',
      description:
        'View containers currently in use',
      icon: <ListIcon />,
      onClick: () =>
        navigate('/containers?status=active'),
      show: true,
    },
    {
      label: 'Archived Containers',
      description:
        'Browse containers moved to archive',
      icon: <ArchiveIcon />,
      onClick: () =>
        navigate('/containers?status=archived'),
      show: true,
    },
    {
      label: 'Refresh Data',
      description:
        'Reload the latest dashboard data',
      icon: <RefreshIcon />,
      onClick: () => onRefresh?.(),
      show: Boolean(onRefresh),
    },
  ];

  const visibleActions =
    actions.filter(
      (action) => action.show,
    );

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',

        height: '100%',

        overflow: 'hidden',

        borderRadius: 3,

        backgroundColor: '#ffffff',

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
            mb: {
              xs: 2.25,
              sm: 2.75,
            },
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
            Quick Actions
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mt: 0.65,

              color: '#69696e',

              fontSize: {
                xs: '0.78rem',
                sm: '0.82rem',
              },

              fontWeight: 500,

              lineHeight: 1.5,
            }}
          >
            Access the most common
            container management
            actions.
          </Typography>
        </Box>

        {/* Actions */}
        <Grid
          container
          spacing={{
            xs: 1.5,
            sm: 2,
          }}
        >
          {visibleActions.map(
            (action, index) => {
              const isFirst =
                index === 0;

              const accentColor =
                isFirst
                  ? theme.palette
                      .success.main
                  : '#55555a';

              const iconBg =
                isFirst
                  ? '#eaf6ee'
                  : '#f1f1f3';

              const iconColor =
                isFirst
                  ? '#2d7a46'
                  : '#4f4f54';

              return (
                <Grid
                  key={action.label}
                  size={{
                    xs: 12,
                    sm: 6,
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={
                      action.onClick
                    }
                    aria-label={
                      action.label
                    }
                    sx={{
                      position:
                        'relative',

                      width: '100%',

                      minHeight: {
                        xs: 112,
                        sm: 122,
                      },

                      height: '100%',

                      p: {
                        xs: 2,
                        sm: 2.25,
                      },

                      pl: {
                        xs: 2.35,
                        sm: 2.6,
                      },

                      overflow:
                        'hidden',

                      border:
                        '1px solid #ddddE1',

                      borderRadius: 2.5,

                      backgroundColor:
                        '#ffffff',

                      color:
                        '#17171a',

                      textAlign:
                        'left',

                      cursor:
                        'pointer',

                      font: 'inherit',

                      display: 'flex',

                      flexDirection:
                        'column',

                      justifyContent:
                        'space-between',

                      boxShadow:
                        '0 3px 10px rgba(0,0,0,0.035)',

                      transition:
                        'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',

                      '&::before': {
                        content:
                          '""',

                        position:
                          'absolute',

                        top: 0,
                        left: 0,

                        width: 3,

                        height:
                          '100%',

                        backgroundColor:
                          accentColor,
                      },

                      '&:hover': {
                        backgroundColor:
                          '#ffffff',

                        color:
                          '#17171a',

                        transform:
                          'translateY(-3px)',

                        borderColor:
                          '#bcbcc1',

                        boxShadow:
                          '0 10px 24px rgba(0,0,0,0.09)',
                      },

                      '&:active': {
                        transform:
                          'translateY(-1px)',

                        boxShadow:
                          '0 5px 14px rgba(0,0,0,0.07)',
                      },

                      '&:focus-visible': {
                        outline:
                          '2px solid #303035',

                        outlineOffset:
                          2,
                      },
                    }}
                  >
                    {/* Top */}
                    <Box
                      sx={{
                        width: '100%',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'space-between',

                        gap: 2,
                      }}
                    >
                      {/* Icon */}
                      <Box
                        sx={{
                          width: {
                            xs: 42,
                            sm: 46,
                          },

                          height: {
                            xs: 42,
                            sm: 46,
                          },

                          borderRadius:
                            2,

                          backgroundColor:
                            iconBg,

                          color:
                            iconColor,

                          border:
                            '1px solid rgba(0,0,0,0.055)',

                          display:
                            'flex',

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          flexShrink: 0,

                          transition:
                            'transform 0.2s ease',

                          '.MuiBox-root:hover > &':
                            {
                              transform:
                                'scale(1.04)',
                            },

                          '& svg': {
                            fontSize: {
                              xs: 21,
                              sm: 23,
                            },
                          },
                        }}
                      >
                        {action.icon}
                      </Box>

                      {/* Arrow */}
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{
                          width: 30,
                          height: 30,

                          borderRadius:
                            '50%',

                          backgroundColor:
                            '#f4f4f5',

                          border:
                            '1px solid #e5e5e7',

                          color:
                            '#626267',

                          display:
                            'flex',

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          flexShrink: 0,

                          fontSize:
                            '1rem',

                          fontWeight:
                            700,

                          lineHeight: 1,

                          transition:
                            'transform 0.2s ease, background-color 0.2s ease',

                          '.MuiBox-root:hover > div > &':
                            {
                              transform:
                                'translateX(2px)',
                            },
                        }}
                      >
                        →
                      </Box>
                    </Box>

                    {/* Text */}
                    <Box
                      sx={{
                        mt: 2,

                        minWidth: 0,
                      }}
                    >
                      <Typography
                        component="div"
                        sx={{
                          color:
                            '#202023',

                          fontSize: {
                            xs: '0.88rem',
                            sm: '0.92rem',
                          },

                          fontWeight:
                            750,

                          lineHeight:
                            1.25,

                          letterSpacing:
                            '-0.015em',
                        }}
                      >
                        {action.label}
                      </Typography>

                      <Typography
                        component="div"
                        sx={{
                          mt: 0.55,

                          color:
                            '#6a6a70',

                          fontSize: {
                            xs: '0.74rem',
                            sm: '0.78rem',
                          },

                          fontWeight:
                            500,

                          lineHeight:
                            1.45,
                        }}
                      >
                        {
                          action.description
                        }
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            },
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default QuickActions;