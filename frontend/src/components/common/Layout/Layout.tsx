// src/components/common/Layout/Layout.tsx (i përditësuar)
import React, { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useAuth } from '../../../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: { xs: 8, sm: 9 },
          pb: 4,
          px: { xs: 2, sm: 3 },
          backgroundColor: '#f5f5f5',
          width: '100%',
        }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  );
};