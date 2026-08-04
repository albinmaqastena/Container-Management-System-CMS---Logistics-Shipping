import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/UI/LoadingSpinner';
import { ROLES } from '../utilis/constants';

export const AdminRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
  return <LoadingSpinner />;
}

if (!user) {
  return <Navigate to="/login" replace />;
}

const isAdmin =
  user.role === ROLES.ADMIN ||
  user.role === ROLES.SUPER_ADMIN;

return isAdmin
  ? <Outlet />
  : <Navigate to="/dashboard" replace />;
};