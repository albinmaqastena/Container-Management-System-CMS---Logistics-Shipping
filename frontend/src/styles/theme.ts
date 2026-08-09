// src/styles/theme.ts

import {
  createTheme,
  type PaletteMode,
} from '@mui/material';

/*
 * =========================================
 * COLORS
 * =========================================
 */

const primary = {
  light: '#3a3a3a',
  main: '#1f1f1f',
  dark: '#0f0f0f',
  contrastText: '#ffffff',
};

const secondary = {
  light: '#737373',
  main: '#525252',
  dark: '#262626',
  contrastText: '#ffffff',
};

const grey = {
  50: '#fafafa',
  100: '#f7f7f8',
  200: '#eeeeef',
  300: '#dedee0',
  400: '#bdbdc1',
  500: '#96969b',
  600: '#77777c',
  700: '#58585c',
  800: '#343437',
  900: '#1b1b1d',
};


/*
 * =========================================
 * THEME
 * =========================================
 */

export const getTheme = (
  mode: PaletteMode,
) => {
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
              default: '#111113',
              paper: '#19191c',
            },

            text: {
              primary: '#f5f5f5',
              secondary: '#a7a7ac',
            },

            divider:
              'rgba(255,255,255,0.08)',
          }
        : {
            background: {
              default: '#f7f7f8',
              paper: '#ffffff',
            },

            text: {
              primary: '#18181a',
              secondary: '#77777c',
            },

            divider:
              'rgba(0,0,0,0.07)',
          }),
    },


    /*
     * =========================================
     * TYPOGRAPHY
     * =========================================
     */

    typography: {
      fontFamily:
        '"Roboto", "Helvetica Neue", "Helvetica", "Arial", sans-serif',

      h1: {
        fontWeight: 700,

        fontSize: '2.5rem',

        lineHeight: 1.15,

        letterSpacing: '-0.035em',
      },

      h2: {
        fontWeight: 700,

        fontSize: '2rem',

        lineHeight: 1.2,

        letterSpacing: '-0.03em',
      },

      h3: {
        fontWeight: 700,

        fontSize: '1.75rem',

        lineHeight: 1.25,

        letterSpacing: '-0.025em',
      },

      h4: {
        fontWeight: 700,

        fontSize: '1.5rem',

        lineHeight: 1.3,

        letterSpacing: '-0.02em',
      },

      h5: {
        fontWeight: 600,

        fontSize: '1.25rem',

        lineHeight: 1.35,

        letterSpacing: '-0.015em',
      },

      h6: {
        fontWeight: 600,

        fontSize: '1rem',

        lineHeight: 1.4,

        letterSpacing: '-0.01em',
      },

      body1: {
        fontSize: '1rem',
        lineHeight: 1.55,
      },

      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },

      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.45,
      },

      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '-0.005em',
      },
    },


    /*
     * =========================================
     * GLOBAL SHAPE
     * =========================================
     */

    shape: {
      borderRadius: 10,
    },

    spacing: 8,


    /*
     * =========================================
     * COMPONENTS
     * =========================================
     */

    components: {
      /*
       * APP BAR
       */

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark
              ? 'rgba(25,25,28,0.96)'
              : 'rgba(255,255,255,0.96)',

            color: isDark
              ? '#f5f5f5'
              : '#18181a',

            borderBottom: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.07)'
            }`,

            boxShadow:
              '0 3px 14px rgba(0,0,0,0.025)',

            backdropFilter: 'blur(12px)',
          },
        },
      },


      /*
       * DRAWER
       */

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark
              ? '#171719'
              : '#ffffff',

            borderRight: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.07)'
            }`,

            backgroundImage: 'none',
          },
        },
      },


      /*
       * PAPER
       */

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',

            borderRadius: 12,
          },

          elevation1: {
            boxShadow: isDark
              ? '0 4px 16px rgba(0,0,0,0.28)'
              : '0 3px 12px rgba(0,0,0,0.05)',
          },

          elevation2: {
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.32)'
              : '0 6px 20px rgba(0,0,0,0.07)',
          },

          elevation3: {
            boxShadow: isDark
              ? '0 12px 32px rgba(0,0,0,0.38)'
              : '0 10px 28px rgba(0,0,0,0.09)',
          },
        },
      },


      /*
       * CARD
       */

      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,

            border: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.06)'
            }`,

            boxShadow: isDark
              ? '0 6px 22px rgba(0,0,0,0.3)'
              : '0 5px 18px rgba(0,0,0,0.055)',

            backgroundImage: 'none',

            transition:
              'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
          },
        },
      },


      /*
       * BUTTON
       */

      MuiButton: {
        defaultProps: {
            disableElevation: true,
        },

        styleOverrides: {
            root: {
            minHeight: 40,

            borderRadius: 9,

            padding: '8px 18px',

            fontWeight: 600,

            textTransform: 'none',

            boxShadow: 'none',

            transition:
                'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',

            '&.MuiButton-containedPrimary': {
                backgroundColor: isDark
                ? '#f1f1f1'
                : '#202020',

                color: isDark
                ? '#181818'
                : '#ffffff',

                '&:hover': {
                backgroundColor: isDark
                    ? '#ffffff'
                    : '#0f0f0f',

                boxShadow:
                    '0 7px 18px rgba(0,0,0,0.13)',

                transform: 'translateY(-1px)',
                },

                '&.Mui-disabled': {
                backgroundColor: isDark
                    ? '#49494d'
                    : '#d5d5d7',

                color: isDark
                    ? '#85858a'
                    : '#8b8b90',
                },
            },

            '&.MuiButton-outlined': {
                borderColor: isDark
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(0,0,0,0.18)',

                '&:hover': {
                borderColor: isDark
                    ? 'rgba(255,255,255,0.32)'
                    : 'rgba(0,0,0,0.32)',

                backgroundColor: isDark
                    ? 'rgba(255,255,255,0.055)'
                    : 'rgba(0,0,0,0.035)',
                },
            },

            '&.MuiButton-text': {
                '&:hover': {
                backgroundColor: isDark
                    ? 'rgba(255,255,255,0.055)'
                    : 'rgba(0,0,0,0.035)',
                },
            },
            },
        },
        },


      /*
       * ICON BUTTON
       */

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,

            transition:
              'background-color 0.18s ease, color 0.18s ease, transform 0.18s ease',

            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },


      /*
       * INPUT / TEXT FIELD
       */

      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 9,

              backgroundColor: isDark
                ? '#1c1c1f'
                : '#ffffff',

              transition:
                'border-color 0.18s ease, box-shadow 0.18s ease',

              '& fieldset': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.13)'
                  : '#dedee1',
              },

              '&:hover fieldset': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.25)'
                  : '#b9b9bd',
              },

              '&.Mui-focused fieldset': {
                borderColor: isDark
                  ? '#d7d7d9'
                  : '#202020',

                borderWidth: 1.5,
              },

              '&.Mui-disabled': {
                backgroundColor: isDark
                  ? '#18181a'
                  : '#f7f7f8',
              },
            },
          },
        },
      },


      /*
       * INPUT LABEL
       */

      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark
              ? '#a7a7ac'
              : '#68686d',

            '&.Mui-focused': {
              color: isDark
                ? '#f1f1f1'
                : '#202020',
            },
          },
        },
      },


      /*
       * SELECT
       */

      MuiSelect: {
        styleOverrides: {
          select: {
            borderRadius: 9,
          },
        },
      },


      /*
       * MENU
       */

      MuiMenu: {
        styleOverrides: {
          paper: {
            marginTop: 6,

            borderRadius: 12,

            border: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.07)'
            }`,

            boxShadow: isDark
              ? '0 14px 34px rgba(0,0,0,0.4)'
              : '0 12px 32px rgba(0,0,0,0.11)',

            backgroundImage: 'none',
          },
        },
      },


      /*
       * MENU ITEM
       */

      MuiMenuItem: {
        styleOverrides: {
          root: {
            marginLeft: 6,
            marginRight: 6,

            borderRadius: 8,

            fontSize: '0.875rem',

            transition:
              'background-color 0.15s ease',

            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : '#f5f5f6',
            },

            '&.Mui-selected': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.09)'
                : '#eeeeef',
            },
          },
        },
      },


      /*
       * LIST ITEM BUTTON
       */

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,

            transition:
              'background-color 0.18s ease, color 0.18s ease',
          },
        },
      },


      /*
       * AVATAR
       */

      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark
              ? '#303034'
              : '#eeeeef',

            color: isDark
              ? '#ffffff'
              : '#181818',

            fontWeight: 600,
          },
        },
      },


      /*
       * CHIP
       */

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 7,

            fontWeight: 500,
          },

          colorSuccess: {
            backgroundColor: isDark
              ? '#173723'
              : '#eaf7ee',

            color: isDark
              ? '#8ad9a5'
              : '#176b36',
          },

          colorError: {
            backgroundColor: isDark
              ? '#411d20'
              : '#fff0f1',

            color: isDark
              ? '#ff9a9f'
              : '#b4232b',
          },

          colorWarning: {
            backgroundColor: isDark
              ? '#402e16'
              : '#fff7e8',

            color: isDark
              ? '#ffc670'
              : '#9a5a00',
          },

          colorInfo: {
            backgroundColor: isDark
              ? '#172d3d'
              : '#eef6fb',

            color: isDark
              ? '#83c8ef'
              : '#276b91',
          },

          colorPrimary: {
            backgroundColor: isDark
              ? '#333337'
              : '#ececee',

            color: isDark
              ? '#f0f0f0'
              : '#303034',
          },

          colorDefault: {
            backgroundColor: isDark
              ? '#2b2b2e'
              : '#eeeeef',

            color: isDark
              ? '#c5c5c8'
              : '#58585c',
          },
        },
      },


      /*
       * TABLE
       */

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.06)'
            }`,
          },

          head: {
            fontWeight: 600,

            backgroundColor: isDark
              ? '#1d1d20'
              : '#fafafa',

            color: isDark
              ? '#e4e4e6'
              : '#28282b',
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            transition:
              'background-color 0.15s ease',

            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.025)'
                : 'rgba(0,0,0,0.018)',
            },
          },
        },
      },


      /*
       * DIALOG
       */

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,

            backgroundImage: 'none',

            border: `1px solid ${
              isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.05)'
            }`,

            boxShadow: isDark
              ? '0 24px 60px rgba(0,0,0,0.5)'
              : '0 24px 60px rgba(0,0,0,0.16)',
          },
        },
      },


      /*
       * PROGRESS
       */

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 6,

            borderRadius: 999,

            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.08)',
          },

          bar: {
            borderRadius: 999,
          },
        },
      },


      /*
       * ALERT
       */

      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,

            '&.MuiAlert-standardSuccess': {
              backgroundColor: isDark
                ? '#173723'
                : '#eaf7ee',

              color: isDark
                ? '#8ad9a5'
                : '#176b36',
            },

            '&.MuiAlert-filledSuccess': {
              backgroundColor: '#237a43',
              color: '#ffffff',
            },

            '&.MuiAlert-outlinedSuccess': {
              borderColor: '#3e9b5c',

              color: isDark
                ? '#8ad9a5'
                : '#176b36',
            },


            '&.MuiAlert-standardError': {
              backgroundColor: isDark
                ? '#411d20'
                : '#fff0f1',

              color: isDark
                ? '#ff9a9f'
                : '#b4232b',
            },

            '&.MuiAlert-filledError': {
              backgroundColor: '#c73842',
              color: '#ffffff',
            },

            '&.MuiAlert-outlinedError': {
              borderColor: '#d94c55',

              color: isDark
                ? '#ff9a9f'
                : '#b4232b',
            },


            '&.MuiAlert-standardWarning': {
              backgroundColor: isDark
                ? '#402e16'
                : '#fff7e8',

              color: isDark
                ? '#ffc670'
                : '#9a5a00',
            },

            '&.MuiAlert-filledWarning': {
              backgroundColor: '#c67a0a',
              color: '#ffffff',
            },

            '&.MuiAlert-outlinedWarning': {
              borderColor: '#d99020',

              color: isDark
                ? '#ffc670'
                : '#9a5a00',
            },


            '&.MuiAlert-standardInfo': {
              backgroundColor: isDark
                ? '#172d3d'
                : '#eef6fb',

              color: isDark
                ? '#83c8ef'
                : '#276b91',
            },

            '&.MuiAlert-filledInfo': {
              backgroundColor: '#367fa6',
              color: '#ffffff',
            },

            '&.MuiAlert-outlinedInfo': {
              borderColor: '#4d91b6',

              color: isDark
                ? '#83c8ef'
                : '#276b91',
            },
          },
        },
      },


      /*
       * TABS
       */

      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 46,
          },

          indicator: {
            height: 2,

            borderRadius: 999,

            backgroundColor: isDark
              ? '#f0f0f0'
              : '#202020',
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 46,

            textTransform: 'none',

            fontWeight: 500,

            color: isDark
              ? '#9b9ba0'
              : '#717176',

            '&.Mui-selected': {
              color: isDark
                ? '#ffffff'
                : '#181818',

              fontWeight: 600,
            },
          },
        },
      },


      /*
       * TOOLTIP
       */

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 7,

            padding: '7px 10px',

            backgroundColor: isDark
              ? '#eeeeef'
              : '#202020',

            color: isDark
              ? '#202020'
              : '#ffffff',

            fontSize: '0.72rem',

            fontWeight: 500,

            boxShadow:
              '0 6px 16px rgba(0,0,0,0.12)',
          },
        },
      },


      /*
       * BADGE
       */

      MuiBadge: {
        styleOverrides: {
          badge: {
            fontFamily:
              '"Roboto", "Helvetica Neue", "Helvetica", "Arial", sans-serif',

            fontWeight: 600,
          },
        },
      },


      /*
       * DIVIDER
       */

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.065)',
          },
        },
      },
    },
  });
};


/*
 * =========================================
 * EXPORTED THEMES
 * =========================================
 */

export const defaultTheme =
  getTheme('light');

export const darkTheme =
  getTheme('dark');