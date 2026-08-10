// src/App.tsx

import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import { AuthProvider } from './contexts/AuthContext';
import { ContainerProvider } from './contexts/ContainerContext';
import { ItemProvider } from './contexts/ItemContext';
import { ReportsProvider } from './contexts/ReportsContext';
import { ThemeProvider } from './contexts/ThemeContext';

import { AppRoutes } from './routes';

import { Layout } from './components/common/Layout/Layout';
import { ToastNotifications } from './components/common/UI/ToastNotifications';

const App = () => {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <ContainerProvider>
            <ItemProvider>
              <ReportsProvider>
                <ThemeProvider>
                  <Layout>
                    <AppRoutes />
                  </Layout>

                  <ToastNotifications />
                </ThemeProvider>
              </ReportsProvider>
            </ItemProvider>
          </ContainerProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
};

export default App;