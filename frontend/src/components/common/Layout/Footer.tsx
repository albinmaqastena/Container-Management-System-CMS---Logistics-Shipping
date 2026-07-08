// src/components/common/Layout/Footer.tsx
import React from 'react';
import { Box, Container, Typography, Link, Divider } from '@mui/material';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) =>
          theme.palette.mode === 'light'
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
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
          <Typography variant="body2" color="textSecondary">
            &copy; {currentYear} Container Management System. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link href="#" variant="body2" color="textSecondary" underline="hover">
              Privacy Policy
            </Link>
            <Link href="#" variant="body2" color="textSecondary" underline="hover">
              Terms of Service
            </Link>
            <Link href="#" variant="body2" color="textSecondary" underline="hover">
              Support
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};