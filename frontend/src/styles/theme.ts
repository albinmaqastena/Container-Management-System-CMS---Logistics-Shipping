// frontend/src/styles/theme.ts
import { createTheme, PaletteMode } from '@mui/material';

// Ngjyrat e përbashkëta
const primary = {
  light: '#4dabf7',
  main: '#1976d2',
  dark: '#0d47a1',
  contrastText: '#ffffff',
};

const secondary = {
  light: '#f06292',
  main: '#dc004e',
  dark: '#9a0036',
  contrastText: '#ffffff',
};

const grey = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#eeeeee',
  300: '#e0e0e0',
  400: '#bdbdbd',
  500: '#9e9e9e',
  600: '#757575',
  700: '#616161',
  800: '#424242',
  900: '#212121',
};

export const getTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary,
      secondary,
      grey,
      ...(isDark
        ? {
            background: {
              default: '#121212',
              paper: '#1e1e1e',
            },
            text: {
              primary: '#ffffff',
              secondary: '#b0b0b0',
            },
            divider: 'rgba(255, 255, 255, 0.12)',
          }
        : {
            background: {
              default: '#f5f5f5',
              paper: '#ffffff',
            },
            text: {
              primary: 'rgba(0, 0, 0, 0.87)',
              secondary: 'rgba(0, 0, 0, 0.6)',
            },
            divider: 'rgba(0, 0, 0, 0.12)',
          }),
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 600,
        fontSize: '2.5rem',
        lineHeight: 1.2,
      },
      h2: {
        fontWeight: 600,
        fontSize: '2rem',
        lineHeight: 1.3,
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
        lineHeight: 1.3,
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem',
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.4,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.43,
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1a1a2e' : primary.main,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#16213e' : '#ffffff',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: isDark
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 20px',
            fontWeight: 500,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
          outlined: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            ...(isDark
              ? {
                  backgroundColor: '#1e1e1e',
                }
              : {}),
          },
          elevation1: {
            boxShadow: isDark
              ? '0 2px 8px rgba(0,0,0,0.4)'
              : '0 2px 4px rgba(0,0,0,0.06)',
          },
          elevation2: {
            boxShadow: isDark
              ? '0 4px 12px rgba(0,0,0,0.4)'
              : '0 4px 8px rgba(0,0,0,0.08)',
          },
          elevation3: {
            boxShadow: isDark
              ? '0 6px 16px rgba(0,0,0,0.45)'
              : '0 6px 12px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
          colorSuccess: {
            backgroundColor: isDark ? '#2e7d32' : '#e8f5e9',
            color: isDark ? '#a5d6a7' : '#1b5e20',
          },
          colorError: {
            backgroundColor: isDark ? '#c62828' : '#ffebee',
            color: isDark ? '#ef9a9a' : '#b71c1c',
          },
          colorWarning: {
            backgroundColor: isDark ? '#e65100' : '#fff3e0',
            color: isDark ? '#ffcc80' : '#e65100',
          },
          colorInfo: {
            backgroundColor: isDark ? '#0d47a1' : '#e3f2fd',
            color: isDark ? '#90caf9' : '#0d47a1',
          },
          colorPrimary: {
            backgroundColor: isDark ? '#1a237e' : '#e8eaf6',
            color: isDark ? '#9fa8da' : '#1a237e',
          },
          colorDefault: {
            backgroundColor: isDark ? '#424242' : '#e0e0e0',
            color: isDark ? '#bdbdbd' : '#616161',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          },
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
            color: isDark ? '#e0e0e0' : 'rgba(0,0,0,0.87)',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.24)',
              },
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            ...(isDark
              ? {
                  backgroundColor: '#1e1e1e',
                }
              : {}),
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        },
      },
      // ✅ RREGULLIMI I ALERT - Përdor selektorë brenda root
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            // Success variant
            '&.MuiAlert-standardSuccess': {
              backgroundColor: isDark ? '#1b3a1b' : '#e8f5e9',
              color: isDark ? '#a5d6a7' : '#1b5e20',
            },
            '&.MuiAlert-filledSuccess': {
              backgroundColor: '#2e7d32',
              color: '#ffffff',
            },
            '&.MuiAlert-outlinedSuccess': {
              borderColor: '#2e7d32',
              color: isDark ? '#a5d6a7' : '#1b5e20',
            },
            // Error variant
            '&.MuiAlert-standardError': {
              backgroundColor: isDark ? '#3a1b1b' : '#ffebee',
              color: isDark ? '#ef9a9a' : '#b71c1c',
            },
            '&.MuiAlert-filledError': {
              backgroundColor: '#d32f2f',
              color: '#ffffff',
            },
            '&.MuiAlert-outlinedError': {
              borderColor: '#d32f2f',
              color: isDark ? '#ef9a9a' : '#b71c1c',
            },
            // Warning variant
            '&.MuiAlert-standardWarning': {
              backgroundColor: isDark ? '#3a2b1b' : '#fff3e0',
              color: isDark ? '#ffcc80' : '#e65100',
            },
            '&.MuiAlert-filledWarning': {
              backgroundColor: '#ed6c02',
              color: '#ffffff',
            },
            '&.MuiAlert-outlinedWarning': {
              borderColor: '#ed6c02',
              color: isDark ? '#ffcc80' : '#e65100',
            },
            // Info variant
            '&.MuiAlert-standardInfo': {
              backgroundColor: isDark ? '#1b2a3a' : '#e3f2fd',
              color: isDark ? '#90caf9' : '#0d47a1',
            },
            '&.MuiAlert-filledInfo': {
              backgroundColor: '#0288d1',
              color: '#ffffff',
            },
            '&.MuiAlert-outlinedInfo': {
              borderColor: '#0288d1',
              color: isDark ? '#90caf9' : '#0d47a1',
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 48,
          },
          indicator: {
            backgroundColor: isDark ? '#90caf9' : primary.main,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 48,
            textTransform: 'none',
            fontWeight: 500,
            '&.Mui-selected': {
              color: isDark ? '#90caf9' : primary.main,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            backgroundColor: isDark ? '#424242' : '#212121',
            color: '#ffffff',
          },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          },
        },
      },
    },
  });
};

export const defaultTheme = getTheme('light');
export const darkTheme = getTheme('dark');