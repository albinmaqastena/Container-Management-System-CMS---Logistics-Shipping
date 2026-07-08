import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/UI/LoadingSpinner';

export const AdminRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" />;
};