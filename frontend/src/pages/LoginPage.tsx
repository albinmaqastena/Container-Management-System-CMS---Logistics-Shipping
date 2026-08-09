// src/pages/LoginPage.tsx

import { Link } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
} from '@mui/material';

import { LoginForm } from '../components/auths/LoginForm';

export const LoginPage = () => {
  return (
    <Box
      sx={{
        position: 'relative',

        width: '100%',
        height: '100dvh',
        minHeight: '100dvh',

        overflowX: 'hidden',
        overflowY: {
          xs: 'auto',
          sm: 'hidden',
        },

        backgroundColor: '#ffffff',

        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',

        px: {
          xs: 2,
          sm: 3,
        },

        pt: 'env(safe-area-inset-top)',
        pb: 'env(safe-area-inset-bottom)',

        /*
         * Dark curved background
         */
        '&::before': {
          content: '""',
          position: 'absolute',
          zIndex: 0,

          left: '-20%',
          right: '-20%',

          bottom: {
            xs: '-12%',
            sm: '-22%',
            md: '-26%',
          },

          height: {
            xs: '56%',
            sm: '64%',
            md: '68%',
          },

          borderRadius:
            '50% 50% 0 0 / 20% 20% 0 0',

          background:
            'radial-gradient(circle at 50% 0%, #353535 0%, #262626 38%, #171717 78%)',

          pointerEvents: 'none',
        },

        /*
         * Thin decorative curve
         */
        '&::after': {
          content: '""',
          position: 'absolute',
          zIndex: 1,

          left: '-15%',
          right: '-15%',

          bottom: {
            xs: '38%',
            sm: '34%',
            md: '31%',
          },

          height: {
            xs: 50,
            sm: 75,
            md: 95,
          },

          borderTop:
            '1px solid rgba(30,30,30,0.65)',

          borderRadius: '50%',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Main content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,

          width: '100%',
          flex: 1,

          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',

          /*
           * Mobile:
           * mbetet më lart që keyboard-i të mos
           * e shtyjë formën shumë.
           *
           * Tablet/Desktop:
           * grupohet në qendër vertikalisht.
           */
          justifyContent: {
            xs: 'flex-start',
            sm: 'center',
          },

          pt: {
            xs: 1.5,
            sm: 0,
          },

          pb: {
            xs: 2,
            sm: 2,
          },
        }}
      >
        {/* Logo */}
        <Box
          component="img"
          src="/logo.webp"
          alt="JONI MIX"
          sx={{
            display: 'block',

            width: {
              xs: '96%',
              sm: 520,
              md: 620,
              lg: 700,
            },

            maxWidth: 700,

            /*
             * Kufizojmë vetëm lartësinë në mobile,
             * që keyboard-i të mos humbasë formën.
             */
            maxHeight: {
              xs: 150,
              sm: 190,
              md: 220,
              lg: 240,
            },

            height: 'auto',
            objectFit: 'contain',
            flexShrink: 0,

            mb: {
              xs: 1,
              sm: 2,
              md: 2.5,
            },
          }}
        />

        {/* Login card */}
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            zIndex: 3,

            width: '100%',
            maxWidth: 520,
            boxSizing: 'border-box',
            flexShrink: 0,

            px: {
              xs: 2.5,
              sm: 4,
              md: 5,
            },

            py: {
              xs: 2.5,
              sm: 3.5,
              md: 4,
            },

            borderRadius: {
              xs: 3,
              sm: 4,
            },

            backgroundColor:
              'rgba(255,255,255,0.98)',

            border:
              '1px solid rgba(0,0,0,0.06)',

            boxShadow: {
              xs: '0 10px 28px rgba(0,0,0,0.12)',
              sm: '0 18px 45px rgba(0,0,0,0.13)',
            },

            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              textAlign: 'center',

              mb: {
                xs: 2,
                sm: 3,
              },
            }}
          >
            <Typography
              component="h1"
              sx={{
                color: '#181818',

                fontSize: {
                  xs: '1.55rem',
                  sm: '1.85rem',
                  md: '2rem',
                },

                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: '-0.025em',
              }}
            >
              Mirësevini!
            </Typography>

            <Typography
              sx={{
                mt: 0.75,
                color: '#777777',

                fontSize: {
                  xs: '0.84rem',
                  sm: '0.94rem',
                },
              }}
            >
              Hyni në llogarinë tuaj për të vazhduar
            </Typography>
          </Box>

          <LoginForm />

          {/* Forgot password */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',

              mt: 2,

              textAlign: 'center',
            }}
          >
            <Link
              to="/forgot-password"
              style={{
                textDecoration: 'none',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#242424',
                  fontWeight: 600,

                  fontSize: {
                    xs: '0.84rem',
                    sm: '0.9rem',
                  },

                  textDecoration: 'underline',
                  textUnderlineOffset: 3,

                  transition: 'color 0.2s ease',

                  '&:hover': {
                    color: '#000000',
                  },
                }}
              >
                Keni harruar fjalëkalimin?
              </Typography>
            </Link>
          </Box>
        </Paper>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,

          width: '100%',
          flexShrink: 0,

          px: 2,

          py: {
            xs: 1.5,
            sm: 2,
          },

          textAlign: 'center',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color:
              'rgba(255,255,255,0.70)',

            fontSize: {
              xs: '0.7rem',
              sm: '0.8rem',
            },

            lineHeight: 1.5,
            letterSpacing: '0.01em',
          }}
        >
          © {new Date().getFullYear()} JONI MIX. Të gjitha të
          drejtat e rezervuara.
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;