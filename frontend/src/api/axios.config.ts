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

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

const processQueue = (
  error: unknown,
  accessToken?: string,
): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !accessToken) {
      reject(error);
      return;
    }

    resolve(accessToken);
  });

  failedQueue = [];
};

const setAuthorizationHeader = (
  config: InternalAxiosRequestConfig,
  accessToken: string,
): void => {
  config.headers = AxiosHeaders.from(config.headers);
  config.headers.set('Authorization', `Bearer ${accessToken}`);
};

const redirectToLogin = (): void => {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const accessToken = tokenStorage.getAccessToken();

    if (accessToken) {
      setAuthorizationHeader(config, accessToken);
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const axiosError = error as AxiosError<unknown>;

    const originalRequest = axiosError.config as
      | RetryAxiosRequestConfig
      | undefined;

    // Ndërtim i sigurt i URL-së për krahasim
    const refreshPath = API_ENDPOINTS.AUTH.REFRESH.startsWith('/')
      ? API_ENDPOINTS.AUTH.REFRESH
      : `/${API_ENDPOINTS.AUTH.REFRESH}`;

    const refreshUrl = refreshPath.replace(/\/$/, '');
    const fullRefreshUrl = `${API_URL}${refreshUrl}`;

    const requestUrl = originalRequest?.url?.replace(/\/$/, '');

    if (
      requestUrl === refreshUrl ||
      requestUrl === fullRefreshUrl
    ) {
      return Promise.reject(error);
    }

    if (
      axiosError.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) {
      tokenStorage.clear();
      redirectToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((accessToken) => {
        setAuthorizationHeader(originalRequest, accessToken);
        return apiClient(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const response = await axios.post<RefreshTokenResponse>(
        `${API_URL}${refreshPath}`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Validim i rreptë – refuzohet nëse është vetëm hapësirë
      if (
        typeof accessToken !== 'string' ||
        accessToken.trim().length === 0
      ) {
        throw new Error('Invalid refresh response');
      }

      tokenStorage.setTokens(accessToken, newRefreshToken);

      processQueue(null, accessToken);

      setAuthorizationHeader(originalRequest, accessToken);

      return apiClient(originalRequest);
    } catch (refreshError: unknown) {
      processQueue(refreshError);
      tokenStorage.clear();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);