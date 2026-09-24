export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPage: number;
  nextPage: number | null;
  previousPage: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export function createPaginationMetadata(
  total: number,
  { page, limit }: PaginationParams,
): PaginationMetadata {
  const totalPage = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPage,
    nextPage: page < totalPage ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
}
