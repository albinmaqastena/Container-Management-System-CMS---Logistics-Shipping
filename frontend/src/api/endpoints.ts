// frontend/src/api/endpoints.ts

// Funksion ndihmës për kodim të sigurt të path-eve të skedarëve
const encodePathSegments = (filePath: string): string =>
  filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    LOGOUT_ALL: '/auth/logout-all',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    SESSIONS: '/auth/sessions',
    SESSION_BY_ID: (sessionId: string) =>
      `/auth/sessions/${sessionId}`,
  },

  USERS: {
    DELETED: '/auth/users/deleted',
    BY_ID: (id: string) => `/auth/users/${id}`,
    RESTORE: (id: string) => `/auth/users/${id}/restore`,
    PERMANENT_DELETE: (id: string) =>
      `/auth/users/${id}/permanent`,
  },

  CONTAINERS: {
    BASE: '/containers',
    DELETED: '/containers/deleted',
    ACTIVE: '/containers/active',
    ARCHIVED: '/containers/archived',
    SEARCH: '/containers/search',
    BY_ID: (id: string) => `/containers/${id}`,
    RESTORE: (id: string) => `/containers/${id}/restore`,
    PERMANENT_DELETE: (id: string) =>
      `/containers/${id}/permanent`,
    STATUS: (id: string) => `/containers/${id}/status`,
  },

  ITEMS: {
    BASE: '/items',
    DELETED: '/items/deleted',
    SEARCH: '/items/search',
    BY_ID: (id: string) => `/items/${id}`,
    RESTORE: (id: string) => `/items/${id}/restore`,
    PERMANENT_DELETE: (id: string) =>
      `/items/${id}/permanent`,
  },

  REPORTS: {
    CONTAINERS_EXCEL: '/reports/containers/excel',
    CONTAINERS_PDF: '/reports/containers/pdf',
    CONTAINER_EXCEL: (id: string) =>
      `/reports/containers/${id}/excel`,
    CONTAINER_PDF: (id: string) =>
      `/reports/containers/${id}/pdf`,
  },

  DASHBOARD: {
    SUMMARY: '/dashboard/summary',
  },

  AUDIT: {
    BASE: '/audit',
    STATS: '/audit/stats',
    CLEANUP: '/audit/cleanup',
    BY_ID: (id: string) => `/audit/${id}`,
    BY_USER: (userId: string) => `/audit/users/${userId}`,
    BY_ACTION: (action: string) =>
      `/audit/actions/${action}`,
  },

  FILES: {
    UPLOAD: '/files/upload',
    UPLOAD_MULTIPLE: '/files/upload/multiple',
    DELETE: (path: string) => `/files/${encodePathSegments(path)}`,
  },

  HEALTH: '/health',
} as const;