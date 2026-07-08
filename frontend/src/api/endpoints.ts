// src/api/endpoints.ts
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    SESSIONS: '/auth/sessions',
    SESSIONS_DETAILED: '/auth/sessions/detailed',
    USERS: '/auth/users',
    USERS_DELETED: '/auth/users/deleted',
    BASE: '/auth/users',
    DELETED: '/auth/users/deleted',
  },
  // Users
  USERS: {
    BASE: '/auth/users',
    DELETED: '/auth/users/deleted',
  },
  // Containers
  CONTAINERS: {
    BASE: '/containers',
    ACTIVE: '/containers/active',
    ARCHIVED: '/containers/archived',
    DELETED: '/containers/deleted',
    SEARCH: '/containers/search',
  },
  // Items
  ITEMS: {
    BASE: '/items',
    DELETED: '/items/deleted',
    SEARCH: '/items/search',
  },
  // Files
  FILES: {
    UPLOAD: '/files/upload',
    UPLOAD_MULTIPLE: '/files/upload/multiple',
  },
  // Health
  HEALTH: '/health',
};