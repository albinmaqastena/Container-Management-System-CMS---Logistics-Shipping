// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface PaginationState {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}