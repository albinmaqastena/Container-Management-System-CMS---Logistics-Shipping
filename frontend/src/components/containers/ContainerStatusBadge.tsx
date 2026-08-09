// src/components/containers/ContainerStatusBadge.tsx

import {
  Chip,
  type ChipProps,
} from '@mui/material';

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
  [ContainerStatus.ACTIVE]: {
    label: 'Active',
    color: 'success',
  },

  [ContainerStatus.ARCHIVED]: {
    label: 'Archived',
    color: 'default',
  },

  [ContainerStatus.SHIPPED]: {
    label: 'Shipped',
    color: 'info',
  },
};

export const ContainerStatusBadge = ({
  status,
  size = 'small',
}: ContainerStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      sx={{
        height:
          size === 'small'
            ? 26
            : 32,

        minWidth:
          size === 'small'
            ? 72
            : 82,

        borderRadius: 1.75,

        fontSize:
          size === 'small'
            ? '0.68rem'
            : '0.76rem',

        fontWeight: 700,

        letterSpacing: '0.01em',

        border: '1px solid transparent',

        boxShadow: 'none',

        transition:
          'transform 0.18s ease, box-shadow 0.18s ease',

        '& .MuiChip-label': {
          px:
            size === 'small'
              ? 1.15
              : 1.4,
        },

        /*
         * ACTIVE
         */
        '&.MuiChip-colorSuccess': {
          backgroundColor: '#eaf7ee',
          color: '#26733d',
          borderColor: '#ccebd5',
        },

        /*
         * ARCHIVED
         */
        '&.MuiChip-colorDefault': {
          backgroundColor: '#f2f2f3',
          color: '#66666b',
          borderColor: '#dedee1',
        },

        /*
         * SHIPPED
         */
        '&.MuiChip-colorInfo': {
          backgroundColor: '#edf5fb',
          color: '#356f98',
          borderColor: '#d4e7f4',
        },

        '&:hover': {
          transform: 'scale(1.025)',
          boxShadow:
            '0 3px 8px rgba(0,0,0,0.06)',
        },
      }}
    />
  );
};