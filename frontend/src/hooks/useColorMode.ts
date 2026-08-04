// src/hooks/useColorMode.ts
import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export const useColorMode = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useColorMode must be used within a ThemeProvider');
  }

  return context;
};