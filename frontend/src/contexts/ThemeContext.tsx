// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, PaletteMode } from '@mui/material';
import { getTheme } from '../styles/theme'; // ✅ Importo temën e personalizuar

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface ThemeContextType {
  mode: PaletteMode;
  toggleColorMode: () => void;
  setMode: (mode: PaletteMode) => void;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Merr preferencën e ruajtur ose përdor sistemin
  const getInitialMode = (): PaletteMode => {
    const stored = localStorage.getItem('themeMode') as PaletteMode | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setModeHandler = (newMode: PaletteMode) => {
    setMode(newMode);
  };

  // Ruaj preferencën në localStorage
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  // ✅ Krijo temën duke përdorur getTheme nga theme.ts
  const theme = getTheme(mode);

  const value: ThemeContextType = {
    mode,
    toggleColorMode,
    setMode: setModeHandler,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export { ThemeContext };