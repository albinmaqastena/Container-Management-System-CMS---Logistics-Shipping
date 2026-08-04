// src/hooks/useContainers.ts

import { useContext } from 'react';

import { ContainerContext } from '../contexts/ContainerContext';

export const useContainers = () => {
  const context = useContext(ContainerContext);

  if (context === undefined) {
    throw new Error(
      'useContainers must be used within a ContainerProvider',
    );
  }

  return context;
};