import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import { LoadingSpinner } from '../components/common/UI/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

export const PrivateRoute = () => {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
};