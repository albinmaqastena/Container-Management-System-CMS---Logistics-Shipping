// src/pages/ProfilePage.tsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  TextField,
  Button,
  Divider,
  Alert,
  Chip,
} from '@mui/material';
import { Person, Email, Badge, CalendarToday } from '@mui/icons-material';

export const ProfilePage: React.FC = () => {
  const { user, changePassword } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      setSuccess('Password changed successfully!');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

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
              color={user?.role === 'super_admin' ? 'error' : user?.role === 'admin' ? 'warning' : 'primary'}
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
                  Joined: {new Date(user?.createdAt || '').toLocaleDateString()}
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

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                name="currentPassword"
                label="Current Password"
                type="password"
                value={formData.currentPassword}
                onChange={handleChange}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="newPassword"
                label="New Password"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
                helperText="Minimum 8 characters"
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};