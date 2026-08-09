// src/components/common/Layout/Sidebar.tsx

import type { ReactNode } from 'react';

import {
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import {
  SpaceDashboardOutlined as DashboardIcon,
  Inventory2Outlined as InventoryIcon,
  WidgetsOutlined as StorageIcon,
  GroupOutlined as PeopleIcon,
  TuneOutlined as SettingsIcon,
  LogoutOutlined as LogoutIcon,
  BarChartOutlined as AssessmentIcon,
  ManageHistoryOutlined as AuditIcon,
} from '@mui/icons-material';

import {
  useNavigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../../../hooks/useAuth';
import { ROLES } from '../../../utilis/constants';

import type { UserRole } from '../../../types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface SidebarMenuItem {
  text: string;
  icon: ReactNode;
  path: string;
  allowedRoles?: readonly UserRole[];
}

export const SIDEBAR_WIDTH = 290;

const MENU_ITEMS: readonly SidebarMenuItem[] = [
  {
    text: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
  },
  {
    text: 'Containers',
    icon: <StorageIcon />,
    path: '/containers',
  },
  {
    text: 'Items',
    icon: <InventoryIcon />,
    path: '/items',
  },
  {
    text: 'Users',
    icon: <PeopleIcon />,
    path: '/admin/users',
    allowedRoles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
  },
  {
    text: 'Reports',
    icon: <AssessmentIcon />,
    path: '/reports',
    allowedRoles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
  },
  {
    text: 'Audit Logs',
    icon: <AuditIcon />,
    path: '/admin/audit',
    allowedRoles: [ROLES.SUPER_ADMIN],
  },
  {
    text: 'Settings',
    icon: <SettingsIcon />,
    path: '/settings',
    allowedRoles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
  },
];

export const Sidebar = ({
  open,
  onClose,
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();

  const theme = useTheme();

  const isDesktop = useMediaQuery(
    theme.breakpoints.up('md'),
  );

  const filteredMenuItems =
    MENU_ITEMS.filter((item) => {
      if (!item.allowedRoles) {
        return true;
      }

      if (!user?.role) {
        return false;
      }

      return item.allowedRoles.includes(
        user.role,
      );
    });

  const handleNavigation = (
    path: string,
  ): void => {
    navigate(path);

    if (!isDesktop) {
      onClose();
    }
  };

  const handleLogout =
    async (): Promise<void> => {
      if (!isDesktop) {
        onClose();
      }

      await logout();

      navigate('/login', {
        replace: true,
      });
    };

  const isSelected = (
    path: string,
  ): boolean => {
    if (location.pathname === path) {
      return true;
    }

    if (
      path !== '/dashboard' &&
      location.pathname.startsWith(
        `${path}/`,
      )
    ) {
      return true;
    }

    return false;
  };

  const drawerContent = (
    <Box
      sx={{
        width: '100%',
        height: '100%',

        display: 'flex',
        flexDirection: 'column',

        backgroundColor: '#ffffff',

        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          flexShrink: 0,

          minHeight: {
            xs: 108,
            sm: 122,
            md: 142,
            lg: 150,
          },

          px: {
            xs: 1.25,
            sm: 1.5,
            md: 2,
          },

          py: {
            xs: 1.25,
            sm: 1.5,
            md: 2.25,
          },

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          borderBottom:
            '1px solid rgba(0,0,0,0.055)',
        }}
      >
        <Box
            component="img"
            src="/logo-bg(1).webp"
            alt="JONI MIX"
            width={802}
            height={223}
            fetchPriority="high"
            loading="eager"
            sx={{
                display: 'block',

                width: {
                xs: '95%',
                sm: '97%',
                md: '98%',
                },

                maxWidth: {
                xs: 240,
                sm: 260,
                md: 278,
                lg: 282,
                },

                height: 'auto',

                objectFit: 'contain',
            }}
            />
      </Box>

      {/* Navigation */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,

          display: 'flex',
          flexDirection: 'column',

          pt: {
            xs: 1.4,
            sm: 1.75,
            md: 2.25,
          },
        }}
      >
        <Typography
          sx={{
            px: {
              xs: 2.25,
              sm: 2.75,
              md: 3,
            },

            mb: 1.1,

            color: '#9a9a9a',

            fontSize: {
              xs: '0.64rem',
              sm: '0.66rem',
              md: '0.68rem',
            },

            fontWeight: 700,

            letterSpacing: '0.11em',
            textTransform: 'uppercase',
          }}
        >
          Menu
        </Typography>

        <List
          component="nav"
          aria-label="Sidebar navigation"
          sx={{
            flex: 1,

            px: {
              xs: 1.1,
              sm: 1.3,
              md: 1.5,
            },

            py: 0,

            overflowY: 'auto',
            overflowX: 'hidden',

            '&::-webkit-scrollbar': {
              width: 4,
            },

            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },

            '&::-webkit-scrollbar-thumb': {
              backgroundColor:
                'rgba(0,0,0,0.12)',

              borderRadius: 999,
            },
          }}
        >
          {filteredMenuItems.map(
            (item) => {
              const selected =
                isSelected(item.path);

              return (
                <ListItem
                  key={item.path}
                  disablePadding
                  sx={{
                    mb: {
                      xs: 0.4,
                      sm: 0.55,
                    },
                  }}
                >
                  <ListItemButton
                    onClick={() =>
                      handleNavigation(
                        item.path,
                      )
                    }
                    selected={selected}
                    sx={{
                      position: 'relative',

                      minHeight: {
                        xs: 50,
                        sm: 52,
                        md: 54,
                      },

                      px: {
                        xs: 1.5,
                        sm: 1.75,
                      },

                      py: 1,

                      // Menu items mbeten rounded
                      borderRadius: {
                        xs: 2,
                        sm: 2.25,
                      },

                      overflow: 'hidden',

                      color: selected
                        ? '#ffffff'
                        : '#2a2a2a',

                      transition:
                        'background-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',

                      '&::before': {
                        content: '""',

                        position:
                          'absolute',

                        left: 0,
                        top: '50%',

                        width: 3,
                        height: selected
                          ? 24
                          : 0,

                        borderRadius:
                          '0 4px 4px 0',

                        backgroundColor:
                          '#ffffff',

                        transform:
                          'translateY(-50%)',

                        opacity: selected
                          ? 0.9
                          : 0,

                        transition:
                          'all 0.18s ease',
                      },

                      '&:hover': {
                        backgroundColor:
                          selected
                            ? '#181818'
                            : '#f5f5f5',

                        transform: {
                          xs: 'none',
                          md: 'translateX(1px)',
                        },
                      },

                      '&.Mui-selected': {
                        color: '#ffffff',

                        background:
                          'linear-gradient(135deg, #242424 0%, #111111 100%)',

                        boxShadow:
                          '0 7px 18px rgba(0,0,0,0.12)',

                        '&:hover': {
                          background:
                            'linear-gradient(135deg, #202020 0%, #0c0c0c 100%)',
                        },

                        '& .MuiListItemIcon-root':
                          {
                            color:
                              '#ffffff',
                          },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: {
                          xs: 39,
                          sm: 42,
                        },

                        color: selected
                          ? '#ffffff'
                          : '#555555',

                        transition:
                          'color 0.18s ease, transform 0.18s ease',

                        '& svg': {
                          fontSize: {
                            xs: 21,
                            sm: 22,
                            md: 23,
                          },
                        },

                        '.MuiListItemButton-root:hover &':
                          {
                            transform: {
                              xs: 'none',
                              md: 'scale(1.04)',
                            },
                          },
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>

                    <ListItemText
                      primary={item.text}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: {
                              xs: '0.9rem',
                              sm: '0.92rem',
                              md: '0.94rem',
                            },

                            fontWeight:
                              selected
                                ? 600
                                : 500,

                            letterSpacing:
                              '-0.01em',

                            whiteSpace:
                              'nowrap',
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            },
          )}
        </List>
      </Box>

      {/* User section */}
      <Box
        sx={{
          p: {
            xs: 1.25,
            sm: 1.5,
          },

          flexShrink: 0,

          borderTop:
            '1px solid rgba(0,0,0,0.055)',

          backgroundColor: '#ffffff',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',

            minHeight: {
              xs: 66,
              sm: 72,
            },

            px: {
              xs: 1,
              sm: 1.25,
            },

            py: 1,

            border:
              '1px solid rgba(0,0,0,0.075)',

            // User card mbetet rounded
            borderRadius: 2.5,

            backgroundColor: '#ffffff',

            boxShadow:
              '0 3px 14px rgba(0,0,0,0.035)',

            transition:
              'box-shadow 0.18s ease, border-color 0.18s ease',

            '&:hover': {
              borderColor:
                'rgba(0,0,0,0.12)',

              boxShadow:
                '0 5px 18px rgba(0,0,0,0.06)',
            },
          }}
        >
          <Avatar
            sx={{
              width: {
                xs: 38,
                sm: 42,
              },

              height: {
                xs: 38,
                sm: 42,
              },

              mr: 1.25,

              backgroundColor: '#f0f0f0',
              color: '#161616',

              border:
                '1px solid rgba(0,0,0,0.05)',

              fontSize: {
                xs: '0.88rem',
                sm: '0.95rem',
              },

              fontWeight: 700,
            }}
          >
            {user?.email
              ?.charAt(0)
              .toUpperCase() || 'U'}
          </Avatar>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <Typography
              title={user?.email}
              sx={{
                color: '#181818',

                fontSize: {
                  xs: '0.8rem',
                  sm: '0.84rem',
                },

                fontWeight: 600,

                lineHeight: 1.25,

                overflow: 'hidden',
                textOverflow:
                  'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email ||
                'Përdoruesi'}
            </Typography>

            <Typography
              sx={{
                mt: 0.35,

                color: '#818181',

                fontSize: {
                  xs: '0.68rem',
                  sm: '0.72rem',
                },

                fontWeight: 500,

                lineHeight: 1.2,

                textTransform:
                  'capitalize',

                overflow: 'hidden',
                textOverflow:
                  'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.role || 'User'}
            </Typography>
          </Box>

          <Tooltip
            title="Dil nga llogaria"
            placement="top"
          >
            <IconButton
              type="button"
              aria-label="Logout"
              onClick={handleLogout}
              size="small"
              sx={{
                ml: 0.5,

                width: {
                  xs: 34,
                  sm: 36,
                },

                height: {
                  xs: 34,
                  sm: 36,
                },

                flexShrink: 0,

                color: '#626262',

                borderRadius: 2,

                transition:
                  'background-color 0.18s ease, color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#111111',

                  backgroundColor:
                    '#f1f1f1',

                  transform:
                    'scale(1.04)',
                },
              }}
            >
              <LogoutIcon
                sx={{
                  fontSize: {
                    xs: 18,
                    sm: 19,
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      component="aside"
      aria-label="Main navigation"
      sx={{
        width: {
          xs: 0,
          md: SIDEBAR_WIDTH,
        },

        flexShrink: 0,
      }}
    >
      <Drawer
        variant={
          isDesktop
            ? 'permanent'
            : 'temporary'
        }
        open={isDesktop || open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          width: {
            xs: 'min(88vw, 300px)',
            sm: 290,
            md: SIDEBAR_WIDTH,
          },

          flexShrink: 0,

          // Backdrop fillon poshtë Navbar-it në mobile/tablet
          '& .MuiBackdrop-root': {
            top: {
              xs: '64px',
              sm: '68px',
              md: 0,
            },

            backgroundColor:
              'rgba(0,0,0,0.30)',
          },

          '& .MuiDrawer-paper': {
            width: {
              xs: 'min(88vw, 300px)',
              sm: 290,
              md: SIDEBAR_WIDTH,
            },

            maxWidth: '100vw',

            boxSizing: 'border-box',

            // Në mobile sidebar fillon pas navbar-it
            top: {
              xs: '64px',
              sm: '68px',
              md: 0,
            },

            height: {
              xs: 'calc(100dvh - 64px)',
              sm: 'calc(100dvh - 68px)',
              md: '100dvh',
            },

            backgroundColor: '#ffffff',

            // Vetëm drawer-i i madh pa round corners
            borderRadius: 0,

            borderRight:
              '1px solid rgba(0,0,0,0.075)',

            boxShadow: {
              xs: '8px 0 30px rgba(0,0,0,0.12)',
              sm: '8px 0 30px rgba(0,0,0,0.10)',
              md: '4px 0 18px rgba(0,0,0,0.025)',
            },

            overflow: 'hidden',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;