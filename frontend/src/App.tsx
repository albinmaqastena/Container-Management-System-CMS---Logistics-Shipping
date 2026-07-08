// src/App.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { ContainerProvider } from './contexts/ContainerContext';
import { ItemProvider } from './contexts/ItemContext';
import { ThemeProvider } from './contexts/ThemeContext'; // ✅ Përdor ThemeProvider-in e personalizuar
import { AppRoutes } from './routes';
import { Layout } from './components/common/Layout/Layout';
// @ts-ignore
require('react-toastify/dist/ReactToastify.css');

const App: React.FC = () => {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <ContainerProvider>
            <ItemProvider>
              <ThemeProvider> {/* ✅ Tema menaxhohet nga ThemeContext */}
                <Layout>
                  <AppRoutes />
                </Layout>
                <ToastContainer
                  position="top-right"
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  pauseOnHover
                  draggable
                />
              </ThemeProvider>
            </ItemProvider>
          </ContainerProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
};

export default App;