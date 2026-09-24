import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  depth?: number;
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

@Injectable()
export class CategoriesRepository {
  constructor(private readonly database: DatabaseService) {}

  async hasActiveCategory(id: string): Promise<boolean> {
    const result = await this.database.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM categories WHERE id = $1::BIGINT AND is_active = TRUE
      ) AS exists
    `, [id]);
    return result.rows[0].exists;
  }

  async findListingsInCategoryTree(
    id: string,
    limit: number,
    offset: number,
  ): Promise<{ data: CategoryListingRecord[]; total: number }> {
    const countResult = await this.database.query<{ total: string }>(`
      WITH RECURSIVE subtree AS (
        SELECT id, ARRAY[id]::BIGINT[] AS id_path
        FROM categories WHERE id = $1::BIGINT AND is_active = TRUE
        UNION ALL
        SELECT child.id, parent.id_path || child.id
        FROM categories child
        JOIN subtree parent ON child.parent_id = parent.id
        WHERE child.is_active = TRUE AND NOT child.id = ANY(parent.id_path)
      )
      SELECT COUNT(*)::TEXT AS total
      FROM listings l
      JOIN subtree s ON s.id = l.category_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
    `, [id]);
    const result = await this.database.query<CategoryListingRecord>(`
      WITH RECURSIVE subtree AS (
        SELECT id, ARRAY[id]::BIGINT[] AS id_path
        FROM categories WHERE id = $1::BIGINT AND is_active = TRUE
        UNION ALL
        SELECT child.id, parent.id_path || child.id
        FROM categories child
        JOIN subtree parent ON child.parent_id = parent.id
        WHERE child.is_active = TRUE AND NOT child.id = ANY(parent.id_path)
      )
      SELECT l.id, l.category_id AS "categoryId", l.model_id AS "modelId",
             c.name AS "categoryName",
             l.year, l.mileage, l.price, l.condition,
             l.transmission, l.fuel_type AS "fuelType", l.color,
             l.city, l.region, l.status, l.title, l.description,
             l.created_at AS "createdAt", l.updated_at AS "updatedAt",
             mk.name AS "makeName", md.name AS "modelName"
      FROM listings l
      JOIN subtree s ON s.id = l.category_id
      JOIN categories c ON c.id = l.category_id
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $2::INTEGER OFFSET $3::BIGINT
    `, [id, limit, offset]);
    return { data: result.rows, total: Number(countResult.rows[0].total) };
  }

  async findAllActiveTree(): Promise<CategoryRecord[]> {
    const result = await this.database.query<CategoryRecord>(`
      WITH RECURSIVE category_tree AS (
        SELECT c.id, c.parent_id AS "parentId", c.name, c.slug, c.sort_order AS "sortOrder",
               c.is_active AS "isActive", 0 AS depth,
               ARRAY[c.sort_order, c.id]::BIGINT[] AS sort_path
        FROM categories c
        WHERE c.parent_id IS NULL AND c.is_active = TRUE
        UNION ALL
        SELECT child.id, child.parent_id AS "parentId", child.name, child.slug,
               child.sort_order AS "sortOrder", child.is_active AS "isActive",
               parent.depth + 1, parent.sort_path || ARRAY[child.sort_order, child.id]::BIGINT[]
        FROM categories child
        JOIN category_tree parent ON parent.id = child.parent_id
        WHERE child.is_active = TRUE
      )
      SELECT id, "parentId", name, slug, "sortOrder", "isActive", depth
      FROM category_tree ORDER BY sort_path
    `);
    return result.rows;
  }

  async findWithActiveChildren(id: string): Promise<CategoryRecord[]> {
    const result = await this.database.query<CategoryRecord>(`
      WITH RECURSIVE category_tree AS (
        SELECT c.id, c.parent_id AS "parentId", c.name, c.slug,
               c.sort_order AS "sortOrder", c.is_active AS "isActive",
               ARRAY[c.sort_order, c.id]::BIGINT[] AS sort_path,
               ARRAY[c.id]::BIGINT[] AS id_path
        FROM categories c
        WHERE c.id = $1::BIGINT AND c.is_active = TRUE
        UNION ALL
        SELECT child.id, child.parent_id AS "parentId", child.name, child.slug,
               child.sort_order AS "sortOrder", child.is_active AS "isActive",
               parent.sort_path || ARRAY[child.sort_order, child.id]::BIGINT[],
               parent.id_path || child.id
        FROM categories child
        JOIN category_tree parent ON child.parent_id = parent.id
        WHERE child.is_active = TRUE AND NOT child.id = ANY(parent.id_path)
      )
      SELECT id, "parentId", name, slug, "sortOrder", "isActive"
      FROM category_tree ORDER BY sort_path
    `, [id]);
    return result.rows;
  }

  async findById(id: string): Promise<CategoryRecord | undefined> {
    const result = await this.database.query<CategoryRecord>(`
      SELECT id, parent_id AS "parentId", name, slug,
             sort_order AS "sortOrder", is_active AS "isActive"
      FROM categories WHERE id = $1::BIGINT
    `, [id]);
    return result.rows[0];
  }

  async create(input: CreateCategoryRecord): Promise<CategoryRecord> {
    const result = await this.database.query<CategoryRecord>(`
      INSERT INTO categories (parent_id, name, slug, sort_order, is_active)
      VALUES ($1::BIGINT, $2, $3, $4, TRUE)
      RETURNING id, parent_id AS "parentId", name, slug,
                sort_order AS "sortOrder", is_active AS "isActive"
    `, [input.parentId, input.name, input.slug, input.sortOrder]);
    return result.rows[0];
  }

  async update(id: string, input: UpdateCategoryRecord): Promise<CategoryRecord | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    const columns: Record<keyof UpdateCategoryRecord, string> = {
      parentId: 'parent_id',
      name: 'name',
      slug: 'slug',
      sortOrder: 'sort_order',
      isActive: 'is_active',
    };

    for (const key of Object.keys(columns) as (keyof UpdateCategoryRecord)[]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        fields.push(`${columns[key]} = $${values.length}`);
      }
    }
    if (fields.length === 0) return this.findById(id);

    const result = await this.database.query<CategoryRecord>(`
      UPDATE categories SET ${fields.join(', ')}
      WHERE id = $1::BIGINT
      RETURNING id, parent_id AS "parentId", name, slug,
                sort_order AS "sortOrder", is_active AS "isActive"
    `, values);
    return result.rows[0];
  }

  async delete(id: string): Promise<CategoryRecord | undefined> {
    const result = await this.database.query<CategoryRecord>(`
      DELETE FROM categories WHERE id = $1::BIGINT
      RETURNING id, parent_id AS "parentId", name, slug,
                sort_order AS "sortOrder", is_active AS "isActive"
    `, [id]);
    return result.rows[0];
  }
}
