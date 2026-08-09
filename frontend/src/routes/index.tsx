// src/routes/index.tsx
// ose file-i ku ndodhet AppRoutes

import {
  lazy,
  Suspense,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AdminRoute } from './AdminRoute';
import { PrivateRoute } from './PrivateRoute';

import { LoadingSpinner } from '../components/common/UI/LoadingSpinner';

/*
 * Lazy loaded pages
 *
 * Përdorim .then(...) sepse faqet aktualisht
 * janë exported si named exports.
 */

const ContainerDetailPage = lazy(() =>
  import('../pages/ContainerDetailPage').then(
    (module) => ({
      default: module.ContainerDetailPage,
    }),
  ),
);

const ContainersPage = lazy(() =>
  import('../pages/ContainersPage').then(
    (module) => ({
      default: module.ContainersPage,
    }),
  ),
);

const CreateContainerPage = lazy(() =>
  import('../pages/CreateContainerPage').then(
    (module) => ({
      default: module.CreateContainerPage,
    }),
  ),
);

const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then(
    (module) => ({
      default: module.DashboardPage,
    }),
  ),
);

const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then(
    (module) => ({
      default: module.ForgotPasswordPage,
    }),
  ),
);

const ItemsPage = lazy(() =>
  import('../pages/ItemsPage').then(
    (module) => ({
      default: module.ItemsPage,
    }),
  ),
);

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then(
    (module) => ({
      default: module.LoginPage,
    }),
  ),
);

const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then(
    (module) => ({
      default: module.NotFoundPage,
    }),
  ),
);

const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then(
    (module) => ({
      default: module.ProfilePage,
    }),
  ),
);

const RegisterPage = lazy(() =>
  import('../pages/RegisterPage').then(
    (module) => ({
      default: module.RegisterPage,
    }),
  ),
);

const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then(
    (module) => ({
      default: module.ResetPasswordPage,
    }),
  ),
);

const SessionsPage = lazy(() =>
  import('../pages/SessionsPage').then(
    (module) => ({
      default: module.SessionsPage,
    }),
  ),
);

const UserManagementPage = lazy(() =>
  import('../pages/UserManagementPage').then(
    (module) => ({
      default: module.UserManagementPage,
    }),
  ),
);

export const AppRoutes = () => {
  return (
    <Suspense
      fallback={
        <LoadingSpinner
          message="Loading page..."
          minHeight="50vh"
        />
      }
    >
      <Routes>
        {/* =========================
            PUBLIC ROUTES
        ========================== */}
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

        {/* =========================
            PRIVATE ROUTES
        ========================== */}
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

          {/* =========================
              ADMIN ROUTES
          ========================== */}
          <Route element={<AdminRoute />}>
            <Route
              path="/admin/users"
              element={<UserManagementPage />}
            />
          </Route>
        </Route>

        {/* =========================
            FALLBACK
        ========================== */}
        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Routes>
    </Suspense>
  );
};