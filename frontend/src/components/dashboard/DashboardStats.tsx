// src/components/dashboard/DashboardStats.tsx

import {
  useEffect,
  useState,
} from 'react';

import type { ReactNode } from 'react';

import {
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';

import {
  Inventory2Outlined as InventoryIcon,
  ArchiveOutlined as ArchiveIcon,
  InventoryOutlined as ItemsIcon,
} from '@mui/icons-material';

import { useContainers } from '../../hooks/useContainers';
import { itemService } from '../../services/item.service';

interface StatItem {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
}

export const DashboardStats = () => {
  const theme = useTheme();

  const {
    activeContainers,
    archivedContainers,
    isLoading,
  } = useContainers();

  const [
    activeItemsCount,
    setActiveItemsCount,
  ] = useState(0);

  const [
    itemsCountLoading,
    setItemsCountLoading,
  ] = useState(true);

  useEffect(() => {
    let active = true;

    const loadActiveItemsCount =
      async (): Promise<void> => {
        setItemsCountLoading(true);

        try {
          const total =
            await itemService.getActiveCount();

          if (!active) {
            return;
          }

          setActiveItemsCount(total);
        } catch {
          if (!active) {
            return;
          }

          setActiveItemsCount(0);
        } finally {
          if (active) {
            setItemsCountLoading(false);
          }
        }
      };

    void loadActiveItemsCount();

    return () => {
      active = false;
    };
  }, []);

  const stats: StatItem[] = [
    {
      title: 'Active Containers',
      value: activeContainers.length,
      description:
        'Containers currently in use',
      icon: <InventoryIcon />,
    },
    {
      title: 'Archived Containers',
      value: archivedContainers.length,
      description:
        'Containers moved to archive',
      icon: <ArchiveIcon />,
    },
    {
      title: 'Active Items',
      value: activeItemsCount,
      description:
        'Items in active containers',
      icon: <ItemsIcon />,
    },
  ];

  const loading =
    isLoading ||
    itemsCountLoading;

  if (loading) {
    return (
      <Grid
        container
        spacing={{
          xs: 2,
          sm: 2.5,
          md: 3,
        }}
      >
        {Array.from({
          length: 3,
        }).map((_, index) => (
          <Grid
            key={index}
            size={{
              xs: 12,
              sm: 6,
              lg: 4,
            }}
          >
            <Card
              elevation={0}
              sx={{
                height: '100%',

                border:
                  '1px solid #d7d7db',

                borderRadius: 3,

                backgroundColor:
                  '#ffffff',

                boxShadow:
                  '0 6px 18px rgba(0,0,0,0.05)',
              }}
            >
              <CardContent
                sx={{
                  p: {
                    xs: 2.25,
                    sm: 2.75,
                    md: 3,
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
                <Box
                  sx={{
                    display: 'flex',

                    alignItems:
                      'flex-start',

                    justifyContent:
                      'space-between',

                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                    }}
                  >
                    <Skeleton
                      width={130}
                      height={18}
                    />

                    <Skeleton
                      width={80}
                      height={52}
                      sx={{
                        mt: 0.5,
                      }}
                    />

                    <Skeleton
                      width="70%"
                      height={18}
                      sx={{
                        mt: 0.75,
                      }}
                    />
                  </Box>

                  <Skeleton
                    variant="rounded"
                    width={52}
                    height={52}
                    sx={{
                      borderRadius: 2,
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid
      container
      spacing={{
        xs: 2,
        sm: 2.5,
        md: 3,
      }}
    >
      {stats.map(
        (stat, index) => {
          const isActive =
            index === 0;

          const isArchived =
            index === 1;

          const accentColor =
            isActive
              ? theme.palette.success.main
              : isArchived
                ? theme.palette.grey[500]
                : '#3f5368';

          const iconBg =
            isActive
              ? '#eaf6ee'
              : isArchived
                ? '#eeeeF0'
                : '#edf2f7';

          const iconColor =
            isActive
              ? '#2d7a46'
              : isArchived
                ? '#4f4f54'
                : '#3f5368';

          return (
            <Grid
              key={stat.title}
              size={{
                xs: 12,
                sm: 6,
                lg: 4,
              }}
            >
              <Card
                elevation={0}
                sx={{
                  position:
                    'relative',

                  height: '100%',

                  overflow:
                    'hidden',

                  borderRadius: 3,

                  backgroundColor:
                    '#ffffff',

                  border:
                    '1px solid #d7d7db',

                  boxShadow:
                    '0 6px 20px rgba(0,0,0,0.055)',

                  transition:
                    'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',

                  '&::before': {
                    content: '""',

                    position:
                      'absolute',

                    top: 0,
                    left: 0,

                    width: 4,

                    height: '100%',

                    backgroundColor:
                      accentColor,
                  },

                  '&:hover': {
                    transform:
                      'translateY(-3px)',

                    borderColor:
                      '#b9b9be',

                    boxShadow:
                      '0 12px 28px rgba(0,0,0,0.11)',
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
                  <Box
                    sx={{
                      display: 'flex',

                      alignItems:
                        'flex-start',

                      justifyContent:
                        'space-between',

                      gap: {
                        xs: 1.5,
                        sm: 2,
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
                        variant="body2"
                        sx={{
                          color:
                            '#55555a',

                          fontWeight:
                            700,

                          letterSpacing:
                            '0.045em',

                          textTransform:
                            'uppercase',

                          fontSize: {
                            xs: '0.66rem',
                            sm: '0.7rem',
                          },
                        }}
                      >
                        {stat.title}
                      </Typography>

                      <Typography
                        sx={{
                          mt: 0.5,

                          color:
                            '#17171a',

                          fontSize: {
                            xs: '2rem',
                            sm: '2.35rem',
                            md: '2.55rem',
                          },

                          lineHeight:
                            1.05,

                          fontWeight:
                            800,

                          letterSpacing:
                            '-0.035em',
                        }}
                      >
                        {stat.value}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.8,

                          color:
                            '#616166',

                          fontWeight:
                            500,

                          fontSize: {
                            xs: '0.78rem',
                            sm: '0.82rem',
                          },

                          lineHeight:
                            1.5,
                        }}
                      >
                        {
                          stat.description
                        }
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        width: {
                          xs: 46,
                          sm: 50,
                          md: 52,
                        },

                        height: {
                          xs: 46,
                          sm: 50,
                          md: 52,
                        },

                        flexShrink: 0,

                        display: 'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'center',

                        borderRadius: 2,

                        backgroundColor:
                          iconBg,

                        color:
                          iconColor,

                        border:
                          '1px solid rgba(0,0,0,0.07)',

                        '& svg': {
                          fontSize: {
                            xs: 22,
                            sm: 24,
                            md: 25,
                          },
                        },
                      }}
                    >
                      {stat.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        },
      )}
    </Grid>
  );
};

export default DashboardStats;