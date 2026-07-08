// src/components/dashboard/QuickActions.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  List as ListIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface QuickActionsProps {
  onRefresh?: () => void;
  onCreateContainer?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onRefresh,
  onCreateContainer,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const actions = [
    {
      label: 'Create Container',
      icon: <AddIcon />,
      color: 'primary' as const,
      onClick: () => {
        if (onCreateContainer) {
          onCreateContainer();
        } else {
          navigate('/containers');
        }
      },
      show: isAdmin,
    },
    {
      label: 'View All Containers',
      icon: <ListIcon />,
      color: 'secondary' as const,
      onClick: () => navigate('/containers'),
      show: true,
    },
    {
      label: 'View Archived',
      icon: <ArchiveIcon />,
      color: 'warning' as const,
      onClick: () => navigate('/containers?tab=archived'),
      show: true,
    },
    {
      label: 'Refresh Data',
      icon: <RefreshIcon />,
      color: 'info' as const,
      onClick: () => {
        if (onRefresh) onRefresh();
      },
      show: true,
    },
  ];

  const visibleActions = actions.filter((action) => action.show !== false);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {visibleActions.map((action, index) => (
            <Box
              key={index}
              sx={{
                flex: '1 1 calc(50% - 8px)',
                minWidth: '120px',
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                color={action.color}
                startIcon={action.icon}
                onClick={action.onClick}
                sx={{
                  py: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  '&:hover': {
                    transform: 'scale(1.02)',
                    transition: 'transform 0.2s',
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {action.label}
                </Typography>
              </Button>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};