import type { PaginatedResponse } from '../../../common/pagination/pagination.js';

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  depth?: number;
}

export interface CategoryTreeNode extends Omit<CategoryRecord, 'depth'> {
  children: CategoryTreeNode[];
}

export interface CategoryListingRecord {
  id: string;
  categoryId: string;
  categoryName: string;
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
  makeName: string;
  modelName: string;
}

export interface CreateCategoryRecord {
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface UpdateCategoryRecord {
  parentId?: string | null;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type CategoryListingsPage = PaginatedResponse<CategoryListingRecord>;
