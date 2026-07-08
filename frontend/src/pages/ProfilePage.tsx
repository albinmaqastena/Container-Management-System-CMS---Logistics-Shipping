// src/pages/ProfilePage.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import { Email, Badge, CalendarToday } from '@mui/icons-material';
import { ChangePasswordForm } from '../components/auths/ChangePasswordForm';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
        }}
      >
        {/* Left Column - Profile Info */}
        <Box sx={{ flex: '0 0 300px', minWidth: { xs: '100%', md: '300px' } }}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                bgcolor: 'primary.main',
                fontSize: 48,
              }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h5" sx={{ mt: 2 }}>
              {user?.username}
            </Typography>
            <Chip
              label={user?.role}
              color={
                user?.role === 'super_admin'
                  ? 'error'
                  : user?.role === 'admin'
                  ? 'warning'
                  : 'primary'
              }
              sx={{ mt: 1 }}
            />
            <Box sx={{ mt: 2, textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Email color="action" />
                <Typography variant="body2">{user?.email}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Badge color="action" />
                <Typography variant="body2">
                  Status: {user?.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday color="action" />
                <Typography variant="body2">
                  Joined:{' '}
                  {new Date(user?.createdAt || '').toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Right Column - Change Password */}
        <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 0 } }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Change Password
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <ChangePasswordForm />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default ProfilePage;