// src/components/dashboard/RecentActivity.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Chip,
  Skeleton,
  Button,
} from '@mui/material';
import {
  Person as PersonIcon,
  Inventory as InventoryIcon,
  Storage as StorageIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'container_created' | 'item_added' | 'status_changed' | 'container_deleted';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  username?: string;
}

interface RecentActivityProps {
  maxItems?: number;
}

const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'container_created',
    title: 'New Container Created',
    description: 'Container "Alpha" was created by admin',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    userId: '1',
    username: 'admin',
  },
  {
    id: '2',
    type: 'item_added',
    title: 'Item Added',
    description: 'Item "ITEM-001" was added to Container "Alpha"',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    userId: '1',
    username: 'admin',
  },
  {
    id: '3',
    type: 'status_changed',
    title: 'Container Archived',
    description: 'Container "Beta" was archived',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    userId: '1',
    username: 'admin',
  },
  {
    id: '4',
    type: 'container_deleted',
    title: 'Container Deleted',
    description: 'Container "Gamma" was permanently deleted',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    userId: '1',
    username: 'admin',
  },
];

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'container_created':
      return <InventoryIcon />;
    case 'item_added':
      return <StorageIcon />;
    case 'status_changed':
      return <ArchiveIcon />;
    case 'container_deleted':
      return <ArchiveIcon />;
    default:
      return <PersonIcon />;
  }
};

const getActivityColor = (type: Activity['type']) => {
  switch (type) {
    case 'container_created':
      return 'success' as const;
    case 'item_added':
      return 'primary' as const;
    case 'status_changed':
      return 'warning' as const;
    case 'container_deleted':
      return 'error' as const;
    default:
      return 'default' as const;
  }
};

export const RecentActivity: React.FC<RecentActivityProps> = ({ maxItems = 5 }) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setActivities(mockActivities.slice(0, maxItems));
      setLoading(false);
    };
    loadData();
  }, [maxItems]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setActivities(mockActivities.slice(0, maxItems));
      setLoading(false);
    }, 500);
  };

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recent Activity</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {[...Array(3)].map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Recent Activity</Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {activities.length === 0 ? (
          <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
            No recent activity
          </Typography>
        ) : (
          <List disablePadding>
            {activities.map((activity, index) => (
              <React.Fragment key={activity.id}>
                <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `${getActivityColor(activity.type)}.light` }}>
                      {getActivityIcon(activity.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {activity.title}
                        </Typography>
                        <Chip
                          label={activity.type.replace('_', ' ')}
                          size="small"
                          color={getActivityColor(activity.type)}
                          variant="outlined"
                          sx={{ fontSize: '0.625rem', height: 20 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                          {activity.description}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          {activity.username && ` • by ${activity.username}`}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < activities.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};