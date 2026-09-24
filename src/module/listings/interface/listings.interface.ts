import type { QueryResultRow } from 'pg';

export interface ListingImageInput {
  url: string;
  position?: number;
  isPrimary?: boolean;
}

export interface ListingAttributeInput {
  attributeId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
}

export interface CreateListingRecord {
  categoryId: string;
  modelId: string;
  year: number;
  mileage: number;
  price: number;
  condition: string;
  transmission: string;
  fuelType: string;
  color: string;
  city: string;
  region: string;
  status?: string;
  title: string;
  description?: string;
  images?: ListingImageInput[];
  attributes?: ListingAttributeInput[];
}

export type UpdateListingRecord = Partial<
  Omit<CreateListingRecord, 'images' | 'attributes'>
>;

export interface ListingBrowseQuery {
  q?: string;
  categoryId?: string;
  makeId?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  fuelType?: string;
  status?: string;
  sort?: string;
  limit?: string;
  cursor?: string;
}

export interface SearchCursor {
  rank: number;
  createdAt: string;
  id: string;
  direction: 'next' | 'previous';
  page: number;
}

export interface SearchListingRow extends ListingRow {
  rank: number;
}

export interface SearchFacetCount {
  facet: 'make' | 'fuelType';
  value: string;
  label: string;
  count: number;
}

export interface ListingSuggestion {
  type: 'make' | 'model' | 'city';
  value: string;
}

export interface FilterOptionCount {
  facet: 'make' | 'fuel_type' | 'transmission';
  value: string;
  label: string;
  count: number;
}

export interface CategoryFilterAttribute {
  id: string;
  key: string;
  label: string;
  type: 'enum' | 'range' | 'boolean';
  unit: string | null;
  isRequired: boolean;
  sortOrder: number;
  options: Array<{ value: string; label: string }>;
}

export interface ListingSearchResponse {
  data: SearchListingRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor: string | null;
    previousCursor: string | null;
  };
  facets: {
    make: SearchFacetCount[];
    fuelType: SearchFacetCount[];
  };
}

export interface ListingSearchFilterRecord extends Omit<ListingFilterRecord, 'sort' | 'cursor'> {
  q?: string;
  cursor?: SearchCursor;
}

export interface ListingCursorPage {
  data: ListingRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor: string | null;
    previousCursor: string | null;
  };
}

export interface ListingFilterRecord {
  categoryId?: string;
  makeId?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  fuelType?: string;
  status?: string;
  sort: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  limit: number;
  cursor?: {
    value: string;
    createdAt: string;
    id: string;
    direction: 'next' | 'previous';
    offset: number;
  };
}

export interface ListingRow extends QueryResultRow {
  id: string;
  categoryId: string;
  modelId: string;
  year: number;
  mileage: number;
  price: string;
  condition: string;
  transmission: string;
  fuelType: string;
  color: string;
  city: string;
  region: string;
  status: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  makeName?: string;
  modelName?: string;
  categoryName?: string;
  categorySlug?: string;
  images?: Array<{ url: string; position: number; isPrimary: boolean }>;
}
