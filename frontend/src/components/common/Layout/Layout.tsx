// src/components/common/Layout/Layout.tsx

import {
  useCallback,
  useState,
} from 'react';

import type { ReactNode } from 'react';

import {
  Box,
  Toolbar,
} from '@mui/material';

import { Footer } from './Footer';
import { Navbar } from './Navbar';

import {
  Sidebar,
  SIDEBAR_WIDTH,
} from './Sidebar';

import { LoadingSpinner } from '../UI/LoadingSpinner';

import { useAuth } from '../../../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({
  children,
}: LayoutProps) => {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const handleSidebarToggle = useCallback(
    (): void => {
      setSidebarOpen(
        (current) => !current,
      );
    },
    [],
  );

  const handleSidebarClose = useCallback(
    (): void => {
      setSidebarOpen(false);
    },
    [],
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        display: 'flex',

        width: '100%',
        minHeight: '100dvh',

        backgroundColor: '#ffffff',

        overflowX: 'hidden',
      }}
    >
      <Navbar
        onMenuClick={
          handleSidebarToggle
        }
      />

      <Sidebar
        open={sidebarOpen}
        onClose={handleSidebarClose}
      />

      <Box
        sx={{
          flexGrow: 1,

          minWidth: 0,
          minHeight: '100dvh',

          display: 'flex',
          flexDirection: 'column',

          width: {
            xs: '100%',
            md: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          },

          backgroundColor: '#ffffff',

          borderRadius: 0,
        }}
      >
        <Box
          component="main"
          sx={{
            flexGrow: 1,

            width: '100%',

            boxSizing: 'border-box',

            backgroundColor: '#ffffff',

            borderRadius: 0,

            px: {
              xs: 1.5,
              sm: 2.5,
              md: 3.5,
              lg: 4,
              xl: 5,
            },

            pb: {
              xs: 2.5,
              sm: 3,
              md: 4,
            },
          }}
        >
          {/* Hapësira e Navbar-it fixed */}
          <Toolbar
            sx={{
              minHeight: {
                xs: '64px !important',
                sm: '68px !important',
                md: '72px !important',
              },

              p: '0 !important',
            }}
          />

          {/* Page Content */}
          <Box
            sx={{
              width: '100%',

              maxWidth: 1600,

              mx: 'auto',

              pt: {
                xs: 2,
                sm: 2.5,
                md: 3,
              },

              backgroundColor:
                'transparent',

              borderRadius: 0,
            }}
          >
            {children}
          </Box>
        </Box>

        <Footer />
      </Box>
    </Box>
  );
};

export default Layout;