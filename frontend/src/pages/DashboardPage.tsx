// src/pages/DashboardPage.tsx

import {
  Box,
  Typography,
  useTheme,
  Avatar,
} from '@mui/material';

import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utilis/constants';

import { DashboardStats } from '../components/dashboard/DashboardStats';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentActivity } from '../components/dashboard/RecentActivity';

export const DashboardPage = () => {
  const { user } = useAuth();
  const theme = useTheme();

  const isSuperAdmin =
    user?.role === ROLES.SUPER_ADMIN;

  const firstName =
    user?.username?.split(' ')[0] ||
    user?.username ||
    'User';

  const initial =
    firstName.charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        width: '100%',

        minHeight: '100%',

        backgroundColor:
          'transparent',

        px: {
          xs: 0,
          sm: 0.5,
          md: 1,
        },

        pb: {
          xs: 3,
          sm: 4,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            md: 'row',
          },

          justifyContent:
            'space-between',

          alignItems: {
            xs: 'stretch',
            md: 'center',
          },

          gap: {
            xs: 2,
            md: 3,
          },

          mb: {
            xs: 3,
            sm: 3.5,
            md: 4,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',

            alignItems: {
              xs: 'flex-start',
              sm: 'center',
            },

            gap: {
              xs: 1.5,
              sm: 2,
            },

            minWidth: 0,
          }}
        >
          <Avatar
            sx={{
              width: {
                xs: 46,
                sm: 52,
              },

              height: {
                xs: 46,
                sm: 52,
              },

              flexShrink: 0,

              backgroundColor:
                '#202024',

              color: '#ffffff',

              border:
                '1px solid #202024',

              boxShadow:
                '0 4px 12px rgba(0,0,0,0.10)',

              fontSize: {
                xs: '1rem',
                sm: '1.15rem',
              },

              fontWeight: 800,
            }}
          >
            {initial}
          </Avatar>

          <Box
            sx={{
              minWidth: 0,
            }}
          >
            <Typography
              component="h1"
              sx={{
                color: '#17171a',

                fontSize: {
                  xs: '1.6rem',
                  sm: '1.9rem',
                  md: '2.15rem',
                },

                fontWeight: 800,

                letterSpacing:
                  '-0.035em',

                lineHeight: 1.1,
              }}
            >
              Dashboard
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mt: 0.55,

                color: '#66666b',

                maxWidth: 620,

                fontSize: {
                  xs: '0.8rem',
                  sm: '0.88rem',
                },

                fontWeight: 500,

                lineHeight: 1.5,
              }}
            >
              Welcome back, {firstName}. Here&apos;s what&apos;s happening
              with your containers.
            </Typography>
          </Box>
        </Box>

        {/* Date */}
        <Box
          sx={{
            alignSelf: {
              xs: 'flex-start',
              md: 'center',
            },

            px: {
              xs: 1.5,
              sm: 1.75,
            },

            py: {
              xs: 0.9,
              sm: 1,
            },

            borderRadius: 2,

            backgroundColor:
              '#f2f2f4',

            border:
              '1px solid #d9d9dd',

            boxShadow: 'none',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#3f3f44',

              fontSize: {
                xs: '0.75rem',
                sm: '0.8rem',
              },

              fontWeight: 700,

              whiteSpace: 'nowrap',
            }}
          >
            {new Date().toLocaleDateString(
              'en-US',
              {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              },
            )}
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box
        sx={{
          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <DashboardStats />
      </Box>

      {/* Main dashboard grid */}
      <Box
        sx={{
          display: 'grid',

          gridTemplateColumns: {
            xs: '1fr',

            lg: isSuperAdmin
              ? 'minmax(320px, 0.9fr) minmax(0, 1.6fr)'
              : '1fr',
          },

          gap: {
            xs: 2,
            sm: 2.5,
            md: 3,
          },

          alignItems: 'stretch',
        }}
      >
        <QuickActions />

        {isSuperAdmin && (
          <RecentActivity
            maxItems={5}
          />
        )}
      </Box>
    </Box>
  );
};

export default DashboardPage;