// src/contexts/ThemeContext.tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  ThemeProvider as MuiThemeProvider,
} from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import { getTheme } from '../styles/theme';

// ------------------------------------------------------------------
// Constants & helpers
// ------------------------------------------------------------------
const THEME_MODE_KEY = 'themeMode';

const getInitialMode = (): PaletteMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    const storedMode =
      window.localStorage.getItem(
        THEME_MODE_KEY,
      );

    if (
      storedMode === 'light' ||
      storedMode === 'dark'
    ) {
      return storedMode;
    }
  } catch {
    // Përdor preferencën e sistemit.
  }

  const mediaQuery =
    window.matchMedia?.(
      '(prefers-color-scheme: dark)',
    );

  return mediaQuery?.matches
    ? 'dark'
    : 'light';
};

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface ThemeContextType {
  mode: PaletteMode;
  toggleColorMode: () => void;
  setMode: (mode: PaletteMode) => void;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  const toggleColorMode = useCallback((): void => {
    setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  }, []);

  const setModeHandler = useCallback((newMode: PaletteMode): void => {
    setMode(newMode);
  }, []);

  // Ruaj preferencën në localStorage me mbrojtje nga gabime
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_MODE_KEY, mode);
    } catch {
      // Tema vazhdon të funksionojë në memorje edhe nëse storage është i kufizuar
    }
  }, [mode]);

  // Memoizimi i temës
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Memoizimi i vlerës së context-it
  const value = useMemo<ThemeContextType>(
    () => ({
      mode,
      toggleColorMode,
      setMode: setModeHandler,
    }),
    [mode, toggleColorMode, setModeHandler],
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};