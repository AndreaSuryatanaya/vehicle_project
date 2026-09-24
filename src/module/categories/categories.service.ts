import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import {
  createPaginationMetadata,
  type PaginatedResponse,
  type PaginationParams,
} from '../../common/pagination/pagination.js';
import { CategoriesRepository } from './repositories/categories.repository.js';
import type {
  CategoryListingRecord,
  CategoryRecord,
  CategoryTreeNode,
  CreateCategoryInput,
  CreateCategoryRecord,
  UpdateCategoryInput,
  UpdateCategoryRecord,
} from './interface/categories.interface.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(): Promise<CategoryTreeNode[]> {
    const rows = await this.categoriesRepository.findAllActiveTree();
    return this.buildTree(rows);
  }

  private buildTree(rows: CategoryRecord[], rootId?: string): CategoryTreeNode[] {
    const nodes = new Map<string, CategoryTreeNode>();

    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const node of nodes.values()) {
      if (rootId === node.id || (rootId === undefined && node.parentId === null)) {
        roots.push(node);
      } else if (node.parentId !== null) {
        nodes.get(node.parentId)?.children.push(node);
      }
    }

    return roots;
  }

  async findOne(id: string): Promise<CategoryTreeNode> {
    const rows = await this.categoriesRepository.findWithActiveChildren(id);
    if (rows.length === 0) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return this.buildTree(rows, id)[0];
  }

  async findListings(
    categoryId: string,
    pageValue?: string,
    limitValue?: string,
  ): Promise<PaginatedResponse<CategoryListingRecord>> {
    if (!/^\d+$/.test(categoryId)) {
      throw new BadRequestException('category id must be a positive integer');
    }
    const pagination: PaginationParams = {
      page: pageValue === undefined ? 1 : Number(pageValue),
      limit: limitValue === undefined ? 20 : Number(limitValue),
    };
    if (!Number.isSafeInteger(pagination.page) || pagination.page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (!Number.isInteger(pagination.limit) || pagination.limit < 1 || pagination.limit > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    if (!Number.isSafeInteger((pagination.page - 1) * pagination.limit)) {
      throw new BadRequestException('page is too large');
    }

    if (!(await this.categoriesRepository.hasActiveCategory(categoryId))) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }

    const result = await this.categoriesRepository.findListingsInCategoryTree(
      categoryId,
      pagination.limit,
      (pagination.page - 1) * pagination.limit,
    );
    return {
      data: result.data,
      pagination: createPaginationMetadata(result.total, pagination),
    };
  }

  async create(input: CreateCategoryInput): Promise<CategoryRecord> {
    const name = input.name.trim();
    const record: CreateCategoryRecord = {
      name,
      slug: this.normalizeSlug(input.slug ?? name),
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    if (!record.name || !record.slug) {
      throw new ConflictException('Category name and slug cannot be empty');
    }
    try {
      return await this.categoriesRepository.create(record);
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryRecord> {
    if (!input || Object.keys(input).length === 0) {
      throw new BadRequestException('At least one category field is required');
    }
    const record: UpdateCategoryRecord = { ...input };
    if (input.name !== undefined) record.name = input.name.trim();
    if (input.slug !== undefined) record.slug = this.normalizeSlug(input.slug);
    if (record.name === '') throw new ConflictException('Category name cannot be empty');
    if (record.slug === '') throw new ConflictException('Category slug cannot be empty');

    try {
      const category = await this.categoriesRepository.update(id, record);
      if (!category) throw new NotFoundException(`Category with id ${id} not found`);
      return category;
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const category = await this.categoriesRepository.delete(id);
      if (!category) throw new NotFoundException(`Category with id ${id} not found`);
      return { message: 'Category deleted successfully' };
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapDatabaseError(error: unknown): never {
    if (error instanceof DatabaseError) {
      if (error.code === '23505') throw new ConflictException('Category slug already exists');
      if (error.code === '23503') {
        throw new ConflictException('Category is referenced by a child category or listing');
      }
    }
    throw error;
  }
}
