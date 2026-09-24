import type { PaginationMetadata } from '../pagination/pagination.js';

export interface BaseResponse<T> {
  message: string;
  statusCode: number;
  isSuccess: boolean;
  data: T;
}

export interface PaginatedBaseResponse<T> extends BaseResponse<T[]> {
  pagination: PaginationMetadata;
}

export interface MessageResponse {
  message: string;
}
