// frontend/src/api/axios.config.ts

import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';

import { API_ENDPOINTS } from './endpoints';
import { tokenStorage } from './tokenStorage';

const API_URL = (
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/v1'
).replace(/\/$/, '');

interface RetryAxiosRequestConfig
  extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

interface FailedQueueItem {
  resolve: (accessToken: string) => void;
  reject: (error: unknown) => void;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// ================================================================
// REFRESH STATE
// ================================================================

let isRefreshing = false;

let failedQueue: FailedQueueItem[] = [];

// ================================================================
// HELPERS
// ================================================================

const processQueue = (
  error: unknown,
  accessToken?: string,
): void => {
  failedQueue.forEach(
    ({ resolve, reject }) => {
      if (error || !accessToken) {
        reject(error);
        return;
      }

      resolve(accessToken);
    },
  );

  failedQueue = [];
};

const setAuthorizationHeader = (
  config: InternalAxiosRequestConfig,
  accessToken: string,
): void => {
  config.headers = AxiosHeaders.from(
    config.headers,
  );

  config.headers.set(
    'Authorization',
    `Bearer ${accessToken}`,
  );
};

const redirectToLogin = (): void => {
  if (
    window.location.pathname !== '/login'
  ) {
    window.location.assign('/login');
  }
};

const normalizePath = (
  path: string,
): string => {
  const normalized = path.startsWith('/')
    ? path
    : `/${path}`;

  return normalized.replace(/\/$/, '');
};

// ================================================================
// PUBLIC AUTH ENDPOINTS
//
// 401 nga këto endpoints NUK duhet të shkaktojë refresh.
// ================================================================

const PUBLIC_AUTH_ENDPOINTS = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.REGISTER,
  API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
  API_ENDPOINTS.AUTH.RESET_PASSWORD,
  API_ENDPOINTS.AUTH.REFRESH,
].map(normalizePath);

const isPublicAuthRequest = (
  requestUrl?: string,
): boolean => {
  if (!requestUrl) {
    return false;
  }

  const normalizedRequestUrl =
    requestUrl.replace(/\/$/, '');

  return PUBLIC_AUTH_ENDPOINTS.some(
    (endpoint) => {
      return (
        normalizedRequestUrl === endpoint ||
        normalizedRequestUrl ===
          `${API_URL}${endpoint}`
      );
    },
  );
};

// ================================================================
// REQUEST INTERCEPTOR
// ================================================================

apiClient.interceptors.request.use(
  (
    config: InternalAxiosRequestConfig,
  ) => {
    const accessToken =
      tokenStorage.getAccessToken();

    if (accessToken) {
      setAuthorizationHeader(
        config,
        accessToken,
      );
    }

    return config;
  },

  (error: unknown) =>
    Promise.reject(error),
);

// ================================================================
// RESPONSE INTERCEPTOR
// ================================================================

apiClient.interceptors.response.use(
  (response) => response,

  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const axiosError =
      error as AxiosError<unknown>;

    const originalRequest =
      axiosError.config as
        | RetryAxiosRequestConfig
        | undefined;

    const requestUrl =
      originalRequest?.url;

    // ------------------------------------------------------------
    // 1. Login/register/forgot/reset/refresh duhet ta kthejnë
    //    error-in direkt te component-i.
    //
    //    P.sh. login me password gabim:
    //    POST /auth/login -> 401
    //
    //    Nuk duhet të provojmë /auth/refresh.
    // ------------------------------------------------------------

    if (
      isPublicAuthRequest(requestUrl)
    ) {
      return Promise.reject(error);
    }

    // ------------------------------------------------------------
    // 2. Vetëm 401 nga endpoint-et protected mund të tentojë
    //    token refresh.
    // ------------------------------------------------------------

    if (
      axiosError.response?.status !==
        401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    const refreshToken =
      tokenStorage.getRefreshToken();

    // ------------------------------------------------------------
    // 3. Nuk ka refresh token
    // ------------------------------------------------------------

    if (!refreshToken) {
      tokenStorage.clear();

      redirectToLogin();

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // ------------------------------------------------------------
    // 4. Nëse një refresh është tashmë duke u bërë,
    //    request-et e tjera presin në queue.
    // ------------------------------------------------------------

    if (isRefreshing) {
      return new Promise<string>(
        (resolve, reject) => {
          failedQueue.push({
            resolve,
            reject,
          });
        },
      ).then((accessToken) => {
        setAuthorizationHeader(
          originalRequest,
          accessToken,
        );

        return apiClient(
          originalRequest,
        );
      });
    }

    isRefreshing = true;

    try {
      const refreshPath =
        normalizePath(
          API_ENDPOINTS.AUTH.REFRESH,
        );

      // Përdor axios direkt që refresh request-i
      // të mos hyjë në këtë interceptor.
      const response =
        await axios.post<RefreshTokenResponse>(
          `${API_URL}${refreshPath}`,
          {
            refreshToken,
          },
          {
            headers: {
              'Content-Type':
                'application/json',
            },

            timeout: 30000,
          },
        );

      const {
        accessToken,
        refreshToken:
          newRefreshToken,
      } = response.data;

      if (
        typeof accessToken !==
          'string' ||
        accessToken.trim().length ===
          0
      ) {
        throw new Error(
          'Invalid refresh response',
        );
      }

      tokenStorage.setTokens(
        accessToken,
        newRefreshToken,
      );

      processQueue(
        null,
        accessToken,
      );

      setAuthorizationHeader(
        originalRequest,
        accessToken,
      );

      return apiClient(
        originalRequest,
      );
    } catch (
      refreshError: unknown
    ) {
      processQueue(refreshError);

      tokenStorage.clear();

      redirectToLogin();

      return Promise.reject(
        refreshError,
      );
    } finally {
      isRefreshing = false;
    }
  },
);