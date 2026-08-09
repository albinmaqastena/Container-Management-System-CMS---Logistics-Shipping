// src/components/common/Layout/Footer.tsx

import {
  Box,
  Container,
  Typography,
  Link,
  Divider,
} from '@mui/material';

import {
  Link as RouterLink,
} from 'react-router-dom';

export const Footer = () => {
  const currentYear =
    new Date().getFullYear();

  const linkSx = {
    color: '#77777c',

    fontSize: {
      xs: '0.7rem',
      sm: '0.74rem',
    },

    fontWeight: 500,

    lineHeight: 1.5,

    textDecoration: 'none',

    display: 'inline-block',

    transition:
      'transform 0.18s ease',

    '&:hover': {
      color: '#77777c',

      transform: 'scale(1.03)',
    },
  } as const;

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',

        width: '100%',

        px: {
          xs: 1.5,
          sm: 2.5,
          md: 3.5,
          lg: 4,
          xl: 5,
        },

        pb: {
          xs: 1.5,
          sm: 1.75,
          md: 2,
        },

        backgroundColor: '#ffffff',

        /*
         * Footer container pa
         * rounded corners.
         */
        borderRadius: 0,

        boxShadow: 'none',
      }}
    >
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          width: '100%',

          maxWidth: 1600,

          mx: 'auto',

          borderRadius: 0,
        }}
      >
        {/* Vetëm kjo vijë ndan footer */}
        <Divider
          sx={{
            mb: {
              xs: 1.5,
              sm: 1.75,
            },

            borderColor: '#e9e9eb',

            borderBottomWidth: '1px',
          }}
        />

        <Box
          sx={{
            minHeight: {
              xs: 56,
              sm: 48,
            },

            display: 'flex',

            flexDirection: {
              xs: 'column',
              sm: 'row',
            },

            justifyContent:
              'space-between',

            alignItems: 'center',

            gap: {
              xs: 1,
              sm: 2,
            },

            backgroundColor:
              'transparent',

            borderRadius: 0,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#85858a',

              fontSize: {
                xs: '0.68rem',
                sm: '0.73rem',
              },

              lineHeight: 1.5,

              textAlign: {
                xs: 'center',
                sm: 'left',
              },
            }}
          >
            &copy; {currentYear}{' '}
            Container Management System.
            All rights reserved.
          </Typography>

          <Box
            component="nav"
            aria-label="Footer navigation"
            sx={{
              display: 'flex',

              flexWrap: 'wrap',

              justifyContent: {
                xs: 'center',
                sm: 'flex-end',
              },

              alignItems: 'center',

              columnGap: {
                xs: 1.75,
                sm: 2.25,
                md: 2.5,
              },

              rowGap: 0.75,
            }}
          >
            <Link
              component={RouterLink}
              to="/privacy"
              underline="none"
              sx={linkSx}
            >
              Privacy Policy
            </Link>

            <Link
              component={RouterLink}
              to="/terms"
              underline="none"
              sx={linkSx}
            >
              Terms of Service
            </Link>

            <Link
              component={RouterLink}
              to="/support"
              underline="none"
              sx={linkSx}
            >
              Support
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;