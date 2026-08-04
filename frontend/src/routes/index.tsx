import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AdminRoute } from './AdminRoute';
import { PrivateRoute } from './PrivateRoute';

import { ContainerDetailPage } from '../pages/ContainerDetailPage';
import { ContainersPage } from '../pages/ContainersPage';
import { CreateContainerPage } from '../pages/CreateContainerPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ItemsPage } from '../pages/ItemsPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { SessionsPage } from '../pages/SessionsPage';
import { UserManagementPage } from '../pages/UserManagementPage';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />
      <Route
        path="/register"
        element={<RegisterPage />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      <Route element={<PrivateRoute />}>
        <Route
          index
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/containers"
          element={<ContainersPage />}
        />

        <Route
          path="/containers/create"
          element={<CreateContainerPage />}
        />

        <Route
          path="/containers/:id"
          element={<ContainerDetailPage />}
        />

        <Route
          path="/items"
          element={<ItemsPage />}
        />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/sessions"
          element={<SessionsPage />}
        />

        <Route element={<AdminRoute />}>
          <Route
            path="/admin/users"
            element={<UserManagementPage />}
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
};