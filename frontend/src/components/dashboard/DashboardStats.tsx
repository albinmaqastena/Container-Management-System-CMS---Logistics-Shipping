// src/components/dashboard/DashboardStats.tsx
import React from 'react';
import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material';
import {
  Inventory as InventoryIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { useContainers } from '../../contexts/ContainerContext';

interface StatItem {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

export const DashboardStats: React.FC = () => {
  const { activeContainers, archivedContainers, loading } = useContainers();

  const totalItems = activeContainers.reduce(
    (sum, container) => sum + (container.items?.length || 0),
    0
  );

  const totalVolume = activeContainers.reduce(
    (sum, container) => sum + container.totalVolume,
    0
  );

  const usedVolume = activeContainers.reduce(
    (sum, container) => sum + container.usedVolume,
    0
  );

  const usagePercentage = totalVolume > 0 ? (usedVolume / totalVolume) * 100 : 0;

  const stats: StatItem[] = [
    {
      title: 'Active Containers',
      value: activeContainers.length,
      icon: <InventoryIcon sx={{ fontSize: 32 }} />,
      color: '#4caf50',
    },
    {
      title: 'Total Items',
      value: totalItems,
      icon: <StorageIcon sx={{ fontSize: 32 }} />,
      color: '#2196f3',
    },
    {
      title: 'Volume Usage',
      value: `${usagePercentage.toFixed(1)}%`,
      icon: <AssessmentIcon sx={{ fontSize: 32 }} />,
      color: '#ff9800',
    },
    {
      title: 'Archived',
      value: archivedContainers.length,
      icon: <ArchiveIcon sx={{ fontSize: 32 }} />,
      color: '#9e9e9e',
    },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        {[...Array(4)].map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: '1 1 200px',
              minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' },
            }}
          >
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" height={40} />
                <Skeleton variant="circular" width={40} height={40} />
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
      }}
    >
      {stats.map((stat, index) => (
        <Box
          key={index}
          sx={{
            flex: '1 1 200px',
            minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' },
          }}
        >
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    backgroundColor: `${stat.color}20`,
                    borderRadius: '50%',
                    padding: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                    color: stat.color,
                  }}
                >
                  {stat.icon}
                </Box>
                <Typography variant="subtitle2" color="textSecondary">
                  {stat.title}
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {stat.value}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};