// ============================================
// API RESPONSE TYPES
// ============================================
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sort?: string;
}