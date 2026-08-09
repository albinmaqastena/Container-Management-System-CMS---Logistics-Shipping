// src/components/common/Layout/Navbar.tsx

import { useState } from 'react';
import type { MouseEvent } from 'react';

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Divider,
} from '@mui/material';

import {
  Menu as MenuIcon,
  AccountCircleOutlined as AccountCircleIcon,
  LogoutOutlined as LogoutIcon,
  TuneOutlined as SettingsIcon,
  SpaceDashboardOutlined as DashboardIcon,
  KeyboardArrowDownRounded as ArrowDownIcon,
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../hooks/useAuth';
import { getInitials } from '../../../utilis/helpers';

import { SIDEBAR_WIDTH } from './Sidebar';

interface NavbarProps {
  onMenuClick: () => void;
}

export const Navbar = ({
  onMenuClick,
}: NavbarProps) => {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] =
    useState<null | HTMLElement>(null);

  const menuOpen = Boolean(anchorEl);

  const handleMenu = (
    event: MouseEvent<HTMLElement>,
  ): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout =
    async (): Promise<void> => {
      handleClose();

      await logout();

      navigate('/login', {
        replace: true,
      });
    };

  const handleNavigate = (
    path: string,
  ): void => {
    handleClose();

    navigate(path);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) =>
          theme.zIndex.drawer + 1,

        width: {
          xs: '100%',
          md: `calc(100% - ${SIDEBAR_WIDTH}px)`,
        },

        ml: {
          md: `${SIDEBAR_WIDTH}px`,
        },

        backgroundColor: '#ffffff',

        color: '#181818',

        borderBottom:
          '1px solid #e2e2e5',

        borderRadius: 0,

        boxShadow: 'none',

        backdropFilter: 'none',

        backgroundImage: 'none',
      }}
    >
      <Toolbar
        sx={{
          minHeight: {
            xs: 64,
            sm: 68,
            md: 72,
          },

          px: {
            xs: 1.5,
            sm: 2.5,
            md: 3.5,
            lg: 4,
          },

          gap: {
            xs: 1,
            sm: 1.5,
          },
        }}
      >
        {/* Mobile menu */}
        <IconButton
          color="inherit"
          edge="start"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          sx={{
            display: {
              xs: 'inline-flex',
              md: 'none',
            },

            width: 40,
            height: 40,

            mr: {
              xs: 0.25,
              sm: 0.75,
            },

            borderRadius: 2,

            color: '#2f2f33',

            border:
              '1px solid #dedee1',

            backgroundColor: '#ffffff',

            '&:hover': {
              color: '#18181b',

              backgroundColor:
                '#f1f1f3',

              borderColor:
                '#c9c9cd',
            },
          }}
        >
          <MenuIcon
            sx={{
              fontSize: 23,
            }}
          />
        </IconButton>

        {/* Title */}
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <Typography
            component="h1"
            noWrap
            sx={{
              color: '#181818',

              fontSize: {
                xs: '0.95rem',
                sm: '1.05rem',
                md: '1.12rem',
              },

              fontWeight: 700,

              letterSpacing:
                '-0.02em',

              lineHeight: 1.2,
            }}
          >
            Container Management
          </Typography>

          <Typography
            sx={{
              display: {
                xs: 'none',
                sm: 'block',
              },

              mt: 0.2,

              color: '#77777c',

              fontSize: '0.7rem',

              fontWeight: 500,

              lineHeight: 1.2,
            }}
          >
            JONI MIX Management System
          </Typography>
        </Box>

        {/* User */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Tooltip title="Profili">
            <IconButton
              onClick={handleMenu}
              aria-label="Open user menu"
              aria-controls={
                menuOpen
                  ? 'user-menu'
                  : undefined
              }
              aria-haspopup="true"
              aria-expanded={
                menuOpen
                  ? 'true'
                  : undefined
              }
              sx={{
                display: 'flex',
                alignItems: 'center',

                gap: {
                  xs: 0,
                  sm: 1,
                },

                p: {
                  xs: 0.4,
                  sm: 0.55,
                },

                pr: {
                  xs: 0.4,
                  sm: 1.2,
                },

                borderRadius: 2.25,

                color: '#18181b',

                /*
                 * Profil më i dukshëm
                 */
                border: menuOpen
                  ? '1px solid #b8b8bd'
                  : '1px solid #d6d6da',

                backgroundColor:
                  menuOpen
                    ? '#eeeeF0'
                    : '#f7f7f8',

                boxShadow: menuOpen
                  ? '0 5px 14px rgba(0,0,0,0.10)'
                  : '0 2px 7px rgba(0,0,0,0.05)',

                transition:
                  'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#bdbdc2',

                  color: '#18181b',

                  transform:
                    'translateY(-1px)',

                  boxShadow:
                    '0 5px 14px rgba(0,0,0,0.09)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: {
                    xs: 36,
                    sm: 39,
                  },

                  height: {
                    xs: 36,
                    sm: 39,
                  },

                  backgroundColor:
                    '#202024',

                  color: '#ffffff',

                  border:
                    '1px solid #202024',

                  boxShadow:
                    '0 2px 5px rgba(0,0,0,0.10)',

                  fontSize: {
                    xs: '0.75rem',
                    sm: '0.8rem',
                  },

                  fontWeight: 700,
                }}
              >
                {getInitials(
                  user?.username ?? '',
                )}
              </Avatar>

              <Box
                sx={{
                  display: {
                    xs: 'none',
                    sm: 'block',
                  },

                  textAlign: 'left',

                  minWidth: 0,

                  maxWidth: {
                    sm: 150,
                    md: 185,
                  },
                }}
              >
                <Typography
                  noWrap
                  sx={{
                    color: '#18181b',

                    fontSize: '0.81rem',

                    fontWeight: 700,

                    lineHeight: 1.2,
                  }}
                >
                  {user?.username ||
                    user?.email ||
                    'Përdoruesi'}
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    mt: 0.2,

                    color: '#6c6c72',

                    fontSize: '0.69rem',

                    fontWeight: 600,

                    lineHeight: 1.2,

                    textTransform:
                      'capitalize',
                  }}
                >
                  {user?.role || 'User'}
                </Typography>
              </Box>

              <ArrowDownIcon
                sx={{
                  display: {
                    xs: 'none',
                    sm: 'block',
                  },

                  ml: 0.25,

                  fontSize: 19,

                  color: '#55555a',

                  transform: menuOpen
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',

                  transition:
                    'transform 0.18s ease',
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Dropdown */}
        <Menu
          id="user-menu"
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleClose}
          transformOrigin={{
            horizontal: 'right',
            vertical: 'top',
          }}
          anchorOrigin={{
            horizontal: 'right',
            vertical: 'bottom',
          }}
          slotProps={{
            paper: {
              sx: {
                mt: 1.25,

                width: {
                  xs: 230,
                  sm: 250,
                },

                borderRadius: 2.5,

                /*
                 * Kontrast më i fortë
                 */
                border:
                  '1px solid #cfcfd4',

                backgroundColor:
                  '#ffffff',

                boxShadow:
                  '0 14px 36px rgba(0,0,0,0.16)',

                overflow: 'hidden',

                py: 0,
              },
            },
          }}
        >
          {/* User info header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',

              gap: 1.25,

              px: 1.6,
              py: 1.5,

              background:
                'linear-gradient(180deg, #f5f5f6 0%, #ededee 100%)',

              borderBottom:
                '1px solid #d8d8dc',
            }}
          >
            <Avatar
              sx={{
                width: 42,
                height: 42,

                backgroundColor:
                  '#202024',

                color: '#ffffff',

                border:
                  '1px solid #202024',

                boxShadow:
                  '0 3px 8px rgba(0,0,0,0.12)',

                fontSize: '0.8rem',

                fontWeight: 700,
              }}
            >
              {getInitials(
                user?.username ?? '',
              )}
            </Avatar>

            <Box
              sx={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <Typography
                noWrap
                sx={{
                  color: '#17171a',

                  fontSize: '0.84rem',

                  fontWeight: 700,

                  lineHeight: 1.3,
                }}
              >
                {user?.username ||
                  user?.email ||
                  'Përdoruesi'}
              </Typography>

              <Typography
                noWrap
                sx={{
                  mt: 0.2,

                  color: '#66666b',

                  fontSize: '0.7rem',

                  fontWeight: 600,

                  textTransform:
                    'capitalize',
                }}
              >
                {user?.role || 'User'}
              </Typography>
            </Box>
          </Box>

          {/* Menu area */}
          <Box
            sx={{
              py: 0.75,

              backgroundColor:
                '#ffffff',
            }}
          >
            <MenuItem
              onClick={() =>
                handleNavigate('/profile')
              }
              sx={{
                mx: 0.75,
                my: 0.35,

                minHeight: 46,

                px: 1.3,

                borderRadius: 1.75,

                color: '#2b2b2f',

                fontSize: '0.87rem',

                fontWeight: 600,

                border:
                  '1px solid transparent',

                transition:
                  'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#18181b',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#d8d8dc',

                  transform:
                    'translateX(2px)',
                },
              }}
            >
              <AccountCircleIcon
                sx={{
                  mr: 1.25,

                  fontSize: 21,

                  color: '#444449',
                }}
              />

              Profile
            </MenuItem>

            <MenuItem
              onClick={() =>
                handleNavigate(
                  '/dashboard',
                )
              }
              sx={{
                mx: 0.75,
                my: 0.35,

                minHeight: 46,

                px: 1.3,

                borderRadius: 1.75,

                color: '#2b2b2f',

                fontSize: '0.87rem',

                fontWeight: 600,

                border:
                  '1px solid transparent',

                transition:
                  'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#18181b',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#d8d8dc',

                  transform:
                    'translateX(2px)',
                },
              }}
            >
              <DashboardIcon
                sx={{
                  mr: 1.25,

                  fontSize: 21,

                  color: '#444449',
                }}
              />

              Dashboard
            </MenuItem>

            <MenuItem
              onClick={() =>
                handleNavigate(
                  '/settings',
                )
              }
              sx={{
                mx: 0.75,
                my: 0.35,

                minHeight: 46,

                px: 1.3,

                borderRadius: 1.75,

                color: '#2b2b2f',

                fontSize: '0.87rem',

                fontWeight: 600,

                border:
                  '1px solid transparent',

                transition:
                  'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#18181b',

                  backgroundColor:
                    '#eeeeF0',

                  borderColor:
                    '#d8d8dc',

                  transform:
                    'translateX(2px)',
                },
              }}
            >
              <SettingsIcon
                sx={{
                  mr: 1.25,

                  fontSize: 21,

                  color: '#444449',
                }}
              />

              Settings
            </MenuItem>
          </Box>

          <Divider
            sx={{
              borderColor:
                '#dcdce0',
            }}
          />

          {/* Logout */}
          <Box
            sx={{
              px: 0.75,
              py: 0.75,

              backgroundColor:
                '#f7f7f8',
            }}
          >
            <MenuItem
              onClick={handleLogout}
              sx={{
                minHeight: 46,

                px: 1.3,

                borderRadius: 1.75,

                color: '#b62f38',

                fontSize: '0.87rem',

                fontWeight: 700,

                border:
                  '1px solid transparent',

                transition:
                  'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',

                '&:hover': {
                  color: '#b62f38',

                  backgroundColor:
                    '#fff0f1',

                  borderColor:
                    '#edc9cc',

                  transform:
                    'translateX(2px)',
                },
              }}
            >
              <LogoutIcon
                sx={{
                  mr: 1.25,

                  fontSize: 21,

                  color: 'inherit',
                }}
              />

              Logout
            </MenuItem>
          </Box>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;