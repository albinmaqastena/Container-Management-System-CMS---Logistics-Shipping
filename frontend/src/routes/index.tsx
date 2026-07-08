// src/routes/index.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { AdminRoute } from './AdminRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ContainersPage } from '../pages/ContainersPage';
import { CreateContainerPage } from '../pages/CreateContainerPage';
import { ContainerDetailPage } from '../pages/ContainerDetailPage';
import { ItemsPage } from '../pages/ItemsPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SessionsPage } from '../pages/SessionsPage';
import { UserManagementPage } from '../pages/UserManagementPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Private Routes */}
      <Route path="/" element={<PrivateRoute />}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="containers" element={<ContainersPage />} />
        <Route path="containers/create" element={<CreateContainerPage />} />
        <Route path="containers/:id" element={<ContainerDetailPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="sessions" element={<SessionsPage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/" element={<AdminRoute />}>
        <Route path="admin/users" element={<UserManagementPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};