// src/pages/DashboardPage.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentActivity } from '../components/dashboard/RecentActivity';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.username}!
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Here&apos;s what&apos;s happening with your containers
        </Typography>
      </Box>

      {/* ✅ Përdor DashboardStats */}
      <DashboardStats />

      {/* ✅ Përdor QuickActions dhe RecentActivity */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          mt: 3,
        }}
      >
        <Box
          sx={{
            flex: '1 1 300px',
            minWidth: { xs: '100%', md: '300px' },
          }}
        >
          <QuickActions />
        </Box>
        <Box
          sx={{
            flex: '2 1 500px',
            minWidth: { xs: '100%', md: '400px' },
          }}
        >
          <RecentActivity maxItems={5} />
        </Box>
      </Box>
    </Box>
  );
};