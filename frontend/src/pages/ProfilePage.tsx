// src/pages/ProfilePage.tsx

import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utilis/constants';

import type { ChipProps } from '@mui/material';

import {
  Box,
  Paper,
  Typography,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';

import {
  Email,
  Badge,
  CalendarToday,
} from '@mui/icons-material';

import { ChangePasswordForm } from '../components/auths/ChangePasswordForm';

const formatRole = (value?: string): string => {
  if (!value) return 'Unknown';

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

const formatDate = (value?: string): string => {
  if (!value) return 'Unknown';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleDateString();
};

export const ProfilePage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Box
        sx={{
          width: '100%',
          minHeight: 300,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          px: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 520,

            p: {
              xs: 2.5,
              sm: 3,
            },

            textAlign: 'center',

            borderRadius: 2.5,

            backgroundColor: '#ffffff',

            border: '1px solid #d7d7db',

            boxShadow:
              '0 6px 20px rgba(0,0,0,0.05)',
          }}
        >
          <Typography
            sx={{
              color: '#4f4f54',

              fontSize: {
                xs: '0.9rem',
                sm: '0.95rem',
              },

              fontWeight: 600,
            }}
          >
            Unable to load profile.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const roleColor: ChipProps['color'] =
    user.role === ROLES.SUPER_ADMIN
      ? 'error'
      : user.role === ROLES.ADMIN
        ? 'warning'
        : 'primary';

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
          sm: 4,
        },
      }}
    >
      {/* Page Header */}
      <Box
        sx={{
          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Typography
          component="h1"
          sx={{
            color: '#17171a',

            fontSize: {
              xs: '1.65rem',
              sm: '1.95rem',
              md: '2.15rem',
            },

            fontWeight: 800,

            lineHeight: 1.15,

            letterSpacing: '-0.035em',
          }}
        >
          Profile
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mt: 0.6,

            color: '#6b6b70',

            fontSize: {
              xs: '0.8rem',
              sm: '0.86rem',
            },

            fontWeight: 500,

            lineHeight: 1.5,
          }}
        >
          View your account information and manage your password.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            lg: 'row',
          },

          gap: {
            xs: 2,
            sm: 2.5,
            md: 3,
          },

          alignItems: 'stretch',
        }}
      >
        {/* Left Column - Profile Info */}
        <Box
          sx={{
            flex: {
              xs: '1 1 auto',
              lg: '0 0 340px',
            },

            minWidth: {
              xs: '100%',
              lg: 340,
            },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              height: '100%',

              p: {
                xs: 2.25,
                sm: 2.75,
                md: 3,
              },

              textAlign: 'center',

              borderRadius: 3,

              backgroundColor: '#ffffff',

              border: '1px solid #d7d7db',

              boxShadow:
                '0 6px 20px rgba(0,0,0,0.055)',

              overflow: 'hidden',

              position: 'relative',

              '&::before': {
                content: '""',

                position: 'absolute',

                top: 0,
                left: 0,
                right: 0,

                height: 3,

                background:
                  'linear-gradient(90deg, #202024 0%, #5a5a60 100%)',
              },
            }}
          >
            <Avatar
              sx={{
                width: {
                  xs: 92,
                  sm: 104,
                  md: 112,
                },

                height: {
                  xs: 92,
                  sm: 104,
                  md: 112,
                },

                mx: 'auto',

                backgroundColor: '#202024',

                color: '#ffffff',

                fontSize: {
                  xs: '2rem',
                  sm: '2.25rem',
                  md: '2.5rem',
                },

                fontWeight: 800,

                border: '4px solid #f1f1f3',

                boxShadow:
                  '0 8px 20px rgba(0,0,0,0.10)',
              }}
            >
              {user.username?.charAt(0).toUpperCase() || '?'}
            </Avatar>

            <Typography
              variant="h5"
              sx={{
                mt: 2,

                color: '#17171a',

                fontSize: {
                  xs: '1.15rem',
                  sm: '1.3rem',
                },

                fontWeight: 800,

                lineHeight: 1.25,

                letterSpacing: '-0.025em',

                overflowWrap: 'anywhere',
              }}
            >
              {user.username}
            </Typography>

            <Chip
              label={formatRole(user.role)}
              color={roleColor}
              sx={{
                mt: 1,

                height: 28,

                borderRadius: 999,

                fontSize: '0.7rem',

                fontWeight: 700,

                '& .MuiChip-label': {
                  px: 1.4,
                },
              }}
            />

            <Divider
              sx={{
                my: 2.5,

                borderColor: '#e5e5e8',
              }}
            />

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',

                gap: 1.2,

                textAlign: 'left',
              }}
            >
              {/* Email */}
              <Box
                sx={{
                  display: 'flex',

                  alignItems: 'center',

                  gap: 1.25,

                  p: 1.35,

                  borderRadius: 2,

                  backgroundColor: '#f5f5f6',

                  border: '1px solid #e0e0e3',
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,

                    flexShrink: 0,

                    display: 'flex',

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 1.75,

                    backgroundColor: '#ffffff',

                    border: '1px solid #d8d8dc',

                    color: '#5f5f64',
                  }}
                >
                  <Email
                    sx={{
                      fontSize: 18,
                    }}
                  />
                </Box>

                <Box
                  sx={{
                    minWidth: 0,
                  }}
                >
                  <Typography
                    sx={{
                      color: '#7a7a80',

                      fontSize: '0.67rem',

                      fontWeight: 700,

                      textTransform: 'uppercase',

                      letterSpacing: '0.035em',
                    }}
                  >
                    Email
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.2,

                      color: '#28282c',

                      fontSize: '0.8rem',

                      fontWeight: 600,

                      lineHeight: 1.4,

                      overflowWrap: 'anywhere',
                    }}
                  >
                    {user.email}
                  </Typography>
                </Box>
              </Box>

              {/* Status */}
              <Box
                sx={{
                  display: 'flex',

                  alignItems: 'center',

                  gap: 1.25,

                  p: 1.35,

                  borderRadius: 2,

                  backgroundColor: '#f5f5f6',

                  border: '1px solid #e0e0e3',
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,

                    flexShrink: 0,

                    display: 'flex',

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 1.75,

                    backgroundColor: '#ffffff',

                    border: '1px solid #d8d8dc',

                    color: '#5f5f64',
                  }}
                >
                  <Badge
                    sx={{
                      fontSize: 18,
                    }}
                  />
                </Box>

                <Box
                  sx={{
                    flex: 1,

                    minWidth: 0,

                    display: 'flex',

                    alignItems: 'center',

                    justifyContent: 'space-between',

                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography
                      sx={{
                        color: '#7a7a80',

                        fontSize: '0.67rem',

                        fontWeight: 700,

                        textTransform: 'uppercase',

                        letterSpacing: '0.035em',
                      }}
                    >
                      Status
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.2,

                        color: '#28282c',

                        fontSize: '0.8rem',

                        fontWeight: 600,
                      }}
                    >
                      Account status
                    </Typography>
                  </Box>

                  <Chip
                    label={
                      user.isActive
                        ? 'Active'
                        : 'Inactive'
                    }
                    color={
                      user.isActive
                        ? 'success'
                        : 'default'
                    }
                    size="small"
                    sx={{
                      height: 25,

                      borderRadius: 999,

                      flexShrink: 0,

                      fontSize: '0.67rem',

                      fontWeight: 700,
                    }}
                  />
                </Box>
              </Box>

              {/* Joined */}
              <Box
                sx={{
                  display: 'flex',

                  alignItems: 'center',

                  gap: 1.25,

                  p: 1.35,

                  borderRadius: 2,

                  backgroundColor: '#f5f5f6',

                  border: '1px solid #e0e0e3',
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,

                    flexShrink: 0,

                    display: 'flex',

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 1.75,

                    backgroundColor: '#ffffff',

                    border: '1px solid #d8d8dc',

                    color: '#5f5f64',
                  }}
                >
                  <CalendarToday
                    sx={{
                      fontSize: 17,
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: '#7a7a80',

                      fontSize: '0.67rem',

                      fontWeight: 700,

                      textTransform: 'uppercase',

                      letterSpacing: '0.035em',
                    }}
                  >
                    Joined
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.2,

                      color: '#28282c',

                      fontSize: '0.8rem',

                      fontWeight: 600,
                    }}
                  >
                    {formatDate(user.createdAt)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Right Column - Change Password */}
        <Box
          sx={{
            flex: 1,

            minWidth: {
              xs: '100%',
              lg: 0,
            },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              height: '100%',

              overflow: 'hidden',

              borderRadius: 3,

              backgroundColor: '#ffffff',

              border: '1px solid #d7d7db',

              boxShadow:
                '0 6px 20px rgba(0,0,0,0.055)',
            }}
          >
            <Box
              sx={{
                px: {
                  xs: 2.25,
                  sm: 2.75,
                  md: 3,
                },

                py: {
                  xs: 2,
                  sm: 2.25,
                },

                backgroundColor: '#f7f7f8',

                borderBottom: '1px solid #e2e2e5',
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: '#17171a',

                  fontSize: {
                    xs: '1.05rem',
                    sm: '1.15rem',
                  },

                  fontWeight: 800,

                  lineHeight: 1.25,

                  letterSpacing: '-0.02em',
                }}
              >
                Change Password
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.45,

                  color: '#6c6c71',

                  fontSize: {
                    xs: '0.76rem',
                    sm: '0.8rem',
                  },

                  fontWeight: 500,

                  lineHeight: 1.5,
                }}
              >
                Update your account password securely.
              </Typography>
            </Box>

            <Divider
              sx={{
                display: 'none',
              }}
            />

            <Box
              sx={{
                p: {
                  xs: 2.25,
                  sm: 2.75,
                  md: 3,
                },
              }}
            >
              <ChangePasswordForm />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default ProfilePage;