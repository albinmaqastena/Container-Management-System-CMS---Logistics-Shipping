// src/components/common/Layout/Footer.tsx
import { Box, Container, Typography, Link, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            &copy; {currentYear} Container Management System. All rights reserved.
          </Typography>
          <Box
            component="nav"
            aria-label="Footer navigation"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Link
              component={RouterLink}
              to="/privacy"
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              Privacy Policy
            </Link>
            <Link
              component={RouterLink}
              to="/terms"
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              Terms of Service
            </Link>
            <Link
              component={RouterLink}
              to="/support"
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              Support
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};