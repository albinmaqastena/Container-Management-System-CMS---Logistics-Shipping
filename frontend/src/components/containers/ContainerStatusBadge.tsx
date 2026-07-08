import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { ContainerStatus } from '../../types';

interface ContainerStatusBadgeProps {
  status: ContainerStatus;
  size?: 'small' | 'medium';
}

type StatusConfig = {
  [key in ContainerStatus]: {
    label: string;
    color: ChipProps['color'];
  };
};

const statusConfig: StatusConfig = {
  active: { label: 'Active', color: 'success' },
  archived: { label: 'Archived', color: 'default' },
  shipped: { label: 'Shipped', color: 'info' },
};

export const ContainerStatusBadge: React.FC<ContainerStatusBadgeProps> = ({
  status,
  size = 'small',
}) => {
  const config = statusConfig[status] || { label: status, color: 'default' };
  return <Chip label={config.label} color={config.color} size={size} />;
};