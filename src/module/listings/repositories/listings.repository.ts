import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type {
  CategoryFilterAttribute,
  CreateListingRecord,
  FilterOptionCount,
  ListingSearchFilterRecord,
  ListingSuggestion,
  SearchFacetCount,
  SearchListingRow,
  ListingFilterRecord,
  ListingRow,
  UpdateListingRecord,
} from '../interface/listings.interface.js';

const imageAggregate = `
  SELECT jsonb_agg(
    jsonb_build_object('url', li.url, 'position', li.position, 'isPrimary', li.is_primary)
    ORDER BY li.position
  ) AS images
  FROM listing_images li WHERE li.listing_id = l.id
`;

// Keep the generated listing vector indexed, while also making the related
// make/model names searchable without duplicating them in listings.
const searchableVector = `l.search_vector || to_tsvector('simple', concat_ws(' ', mk.name, md.name))`;

@Injectable()
export class ListingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateListingRecord): Promise<ListingRow> {
    return this.database.transaction(async (client) => {
      const result = await client.query<ListingRow>(`
        INSERT INTO listings (
          category_id, model_id, year, mileage, price, condition,
          transmission, fuel_type, color, city, region, status, title, description
        ) VALUES (
          $1::BIGINT, $2::BIGINT, $3::SMALLINT, $4::INTEGER, $5::NUMERIC,
          $6::listing_condition, $7::listing_transmission, $8::listing_fuel_type,
          $9::VARCHAR, $10::VARCHAR, $11::VARCHAR,
          COALESCE($12::listing_status, 'available'), $13::VARCHAR, $14::TEXT
        )
        RETURNING id, category_id AS "categoryId", model_id AS "modelId",
          year, mileage, price, condition, transmission, fuel_type AS "fuelType",
          color, city, region, status, title, description,
          created_at AS "createdAt", updated_at AS "updatedAt"
      `, [
        input.categoryId,
        input.modelId,
        input.year,
        input.mileage,
        input.price,
        input.condition,
        input.transmission,
        input.fuelType,
        input.color,
        input.city,
        input.region,
        input.status ?? null,
        input.title,
        input.description ?? '',
      ]);
      const listing = result.rows[0];

      for (const [index, image] of (input.images ?? []).entries()) {
        await client.query(
          `INSERT INTO listing_images (listing_id, url, position, is_primary)
           VALUES ($1::BIGINT, $2, $3::INTEGER, $4::BOOLEAN)`,
          [listing.id, image.url, image.position ?? index, image.isPrimary ?? index === 0],
        );
      }

      for (const attribute of input.attributes ?? []) {
        await client.query(
          `INSERT INTO listing_attribute_values
            (listing_id, attribute_id, value_text, value_number, value_boolean)
           VALUES ($1::BIGINT, $2::BIGINT, $3, $4, $5)`,
          [
            listing.id,
            attribute.attributeId,
            attribute.valueText ?? null,
            attribute.valueNumber ?? null,
            attribute.valueBoolean ?? null,
          ],
        );
      }
      return listing;
    });
  }

  async findMany(filters: ListingFilterRecord): Promise<ListingRow[]> {
    const sortConfig = {
      newest: {
        order: 'l.created_at DESC, l.id DESC',
        reverseOrder: 'l.created_at ASC, l.id ASC',
        operator: '<',
      },
      oldest: {
        order: 'l.created_at ASC, l.id ASC',
        reverseOrder: 'l.created_at DESC, l.id DESC',
        operator: '>',
      },
      price_asc: {
        order: 'l.price ASC, l.created_at ASC, l.id ASC',
        reverseOrder: 'l.price DESC, l.created_at DESC, l.id DESC',
        operator: '>',
      },
      price_desc: {
        order: 'l.price DESC, l.created_at DESC, l.id DESC',
        reverseOrder: 'l.price ASC, l.created_at ASC, l.id ASC',
        operator: '<',
      },
    }[filters.sort];
    const isPreviousPage = filters.cursor?.direction === 'previous';
    const operator = isPreviousPage
      ? sortConfig.operator === '<' ? '>' : '<'
      : sortConfig.operator;
    const cursorCondition = filters.cursor
      ? filters.sort === 'newest' || filters.sort === 'oldest'
        ? `(l.created_at, l.id) ${operator} ($10::TIMESTAMPTZ, $11::BIGINT)`
        : `(l.price, l.created_at, l.id) ${operator} ($12::NUMERIC, $10::TIMESTAMPTZ, $11::BIGINT)`
      : 'TRUE';
    const values = [
      filters.categoryId ?? null,
      filters.makeId ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.minYear ?? null,
      filters.maxYear ?? null,
      filters.fuelType ?? null,
      filters.status ?? 'available',
      filters.limit + 1,
      filters.cursor?.createdAt ?? null,
      filters.cursor?.id ?? null,
      filters.cursor?.value ?? null,
    ];
    const parameterCount = !filters.cursor
      ? 9
      : filters.sort.startsWith('price_')
        ? 12
        : 11;

    const result = await this.database.query<ListingRow>(`
      SELECT l.id, l.category_id AS "categoryId", l.model_id AS "modelId",
        l.year, l.mileage, l.price, l.condition, l.transmission,
        l.fuel_type AS "fuelType", l.color, l.city, l.region, l.status,
        l.title, l.description, l.created_at AS "createdAt", l.updated_at AS "updatedAt",
        mk.name AS "makeName", md.name AS "modelName",
        COALESCE(img.images, '[]'::JSONB) AS images
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      LEFT JOIN LATERAL (${imageAggregate}) img ON TRUE
      WHERE l.deleted_at IS NULL
        AND ($1::BIGINT IS NULL OR l.category_id = $1)
        AND ($2::BIGINT IS NULL OR md.make_id = $2)
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($7::listing_fuel_type IS NULL OR l.fuel_type = $7)
        AND ($8::listing_status IS NULL OR l.status = $8)
        AND ${cursorCondition}
      ORDER BY ${isPreviousPage ? sortConfig.reverseOrder : sortConfig.order}
      LIMIT $9::INTEGER
    `, values.slice(0, parameterCount));
    return result.rows;
  }

  async count(filters: ListingFilterRecord): Promise<number> {
    const result = await this.database.query<{ total: string }>(`
      SELECT COUNT(*)::TEXT AS total
      FROM listings l
      JOIN models md ON md.id = l.model_id
      WHERE l.deleted_at IS NULL
        AND ($1::BIGINT IS NULL OR l.category_id = $1)
        AND ($2::BIGINT IS NULL OR md.make_id = $2)
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($7::listing_fuel_type IS NULL OR l.fuel_type = $7)
        AND ($8::listing_status IS NULL OR l.status = $8)
    `, [
      filters.categoryId ?? null,
      filters.makeId ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.minYear ?? null,
      filters.maxYear ?? null,
      filters.fuelType ?? null,
      filters.status ?? 'available',
    ]);
    return Number(result.rows[0].total);
  }

  async search(filters: ListingSearchFilterRecord): Promise<SearchListingRow[]> {
    const isPrevious = filters.cursor?.direction === 'previous';
    const cursorOperator = isPrevious ? '>' : '<';
    const orderDirection = isPrevious ? 'ASC' : 'DESC';
    const result = await this.database.query<SearchListingRow>(`
      SELECT l.id, l.category_id AS "categoryId", l.model_id AS "modelId",
        l.year, l.mileage, l.price, l.condition, l.transmission,
        l.fuel_type AS "fuelType", l.color, l.city, l.region, l.status,
        l.title, l.description, l.created_at AS "createdAt", l.updated_at AS "updatedAt",
        mk.name AS "makeName", md.name AS "modelName",
        COALESCE(img.images, '[]'::JSONB) AS images,
        CASE WHEN $1::TEXT IS NULL THEN 0::REAL
          ELSE ts_rank(${searchableVector}, websearch_to_tsquery('simple', $1)) END AS rank
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      LEFT JOIN LATERAL (${imageAggregate}) img ON TRUE
      WHERE l.status = 'available' AND l.deleted_at IS NULL
        AND ($1::TEXT IS NULL OR ${searchableVector} @@ websearch_to_tsquery('simple', $1))
        AND ($2::BIGINT IS NULL OR md.make_id = $2)
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($7::listing_fuel_type IS NULL OR l.fuel_type = $7)
        AND ($8::BIGINT IS NULL OR l.category_id = $8)
        AND ($11::TIMESTAMPTZ IS NULL OR
          ($1::TEXT IS NOT NULL AND
            (ts_rank(${searchableVector}, websearch_to_tsquery('simple', $1)), l.created_at, l.id) ${cursorOperator}
              ($10::REAL, $11::TIMESTAMPTZ, $12::BIGINT)) OR
          ($1::TEXT IS NULL AND (l.created_at, l.id) ${cursorOperator} ($11::TIMESTAMPTZ, $12::BIGINT)))
      ORDER BY rank ${orderDirection}, l.created_at ${orderDirection}, l.id ${orderDirection}
      LIMIT $9::INTEGER
    `, [
      filters.q ?? null,
      filters.makeId ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.minYear ?? null,
      filters.maxYear ?? null,
      filters.fuelType ?? null,
      filters.categoryId ?? null,
      filters.limit + 1,
      filters.cursor?.rank ?? null,
      filters.cursor?.createdAt ?? null,
      filters.cursor?.id ?? null,
    ]);
    return result.rows;
  }

  async countSearch(filters: ListingSearchFilterRecord): Promise<number> {
    const result = await this.database.query<{ total: string }>(`
      SELECT COUNT(*)::TEXT AS total
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
        AND ($1::TEXT IS NULL OR ${searchableVector} @@ websearch_to_tsquery('simple', $1))
        AND ($2::BIGINT IS NULL OR md.make_id = $2)
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($7::listing_fuel_type IS NULL OR l.fuel_type = $7)
        AND ($8::BIGINT IS NULL OR l.category_id = $8)
    `, [
      filters.q ?? null,
      filters.makeId ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.minYear ?? null,
      filters.maxYear ?? null,
      filters.fuelType ?? null,
      filters.categoryId ?? null,
    ]);
    return Number(result.rows[0].total);
  }

  async searchFacets(filters: ListingSearchFilterRecord): Promise<SearchFacetCount[]> {
    const result = await this.database.query<SearchFacetCount>(`
      SELECT 'fuelType' AS facet, l.fuel_type::TEXT AS value,
        l.fuel_type::TEXT AS label, COUNT(*)::INTEGER AS count
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
        AND ($1::TEXT IS NULL OR ${searchableVector} @@ websearch_to_tsquery('simple', $1))
        AND ($2::BIGINT IS NULL OR md.make_id = $2)
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($8::BIGINT IS NULL OR l.category_id = $8)
      GROUP BY l.fuel_type
      UNION ALL
      SELECT 'make' AS facet, mk.id::TEXT AS value, mk.name AS label,
        COUNT(*)::INTEGER AS count
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
        AND ($1::TEXT IS NULL OR ${searchableVector} @@ websearch_to_tsquery('simple', $1))
        AND ($3::NUMERIC IS NULL OR l.price >= $3)
        AND ($4::NUMERIC IS NULL OR l.price <= $4)
        AND ($5::SMALLINT IS NULL OR l.year >= $5)
        AND ($6::SMALLINT IS NULL OR l.year <= $6)
        AND ($7::listing_fuel_type IS NULL OR l.fuel_type = $7)
        AND ($8::BIGINT IS NULL OR l.category_id = $8)
      GROUP BY mk.id, mk.name
      ORDER BY facet, count DESC, label
    `, [
      filters.q ?? null,
      filters.makeId ?? null,
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.minYear ?? null,
      filters.maxYear ?? null,
      filters.fuelType ?? null,
      filters.categoryId ?? null,
    ]);
    return result.rows;
  }

  async findSuggestions(query: string): Promise<ListingSuggestion[]> {
    const result = await this.database.query<ListingSuggestion>(`
      SELECT type, value
      FROM (
        (SELECT 'make'::TEXT AS type, name AS value
         FROM makes WHERE name ILIKE $1::TEXT || '%' ORDER BY name LIMIT 5)
        UNION ALL
        (SELECT 'model'::TEXT AS type, name AS value
         FROM models WHERE name ILIKE $1::TEXT || '%' ORDER BY name LIMIT 5)
        UNION ALL
        (SELECT 'city'::TEXT AS type, city AS value
         FROM listings
         WHERE deleted_at IS NULL AND status = 'available'
           AND city ILIKE $1::TEXT || '%'
         GROUP BY city ORDER BY city LIMIT 5)
      ) AS suggestions
      ORDER BY type, value
      LIMIT 15
    `, [query]);
    return result.rows;
  }

  async findAllFilterOptions(): Promise<FilterOptionCount[]> {
    const result = await this.database.query<FilterOptionCount>(`
      SELECT 'make' AS facet, mk.id::TEXT AS value, mk.name AS label,
        COUNT(*)::INTEGER AS count
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      WHERE l.status = 'available' AND l.deleted_at IS NULL
      GROUP BY mk.id, mk.name
      UNION ALL
      SELECT 'fuel_type' AS facet, l.fuel_type::TEXT AS value,
        l.fuel_type::TEXT AS label, COUNT(*)::INTEGER AS count
      FROM listings l
      WHERE l.status = 'available' AND l.deleted_at IS NULL
      GROUP BY l.fuel_type
      UNION ALL
      SELECT 'transmission' AS facet, l.transmission::TEXT AS value,
        l.transmission::TEXT AS label, COUNT(*)::INTEGER AS count
      FROM listings l
      WHERE l.status = 'available' AND l.deleted_at IS NULL
      GROUP BY l.transmission
      ORDER BY facet, count DESC, label
    `);
    return result.rows;
  }

  async findCategoryFilters(categoryId: string): Promise<CategoryFilterAttribute[]> {
    const result = await this.database.query<CategoryFilterAttribute>(`
      SELECT ca.id, ca.key, ca.label, ca.type, ca.unit,
        ca.is_required AS "isRequired", ca.sort_order AS "sortOrder",
        COALESCE(
          jsonb_agg(jsonb_build_object('value', ao.value, 'label', ao.label)
            ORDER BY ao.sort_order) FILTER (WHERE ao.id IS NOT NULL),
          '[]'::JSONB
        ) AS options
      FROM category_attributes ca
      JOIN categories c ON c.id = ca.category_id AND c.is_active = TRUE
      LEFT JOIN attribute_options ao ON ao.attribute_id = ca.id
      WHERE ca.category_id = $1::BIGINT AND ca.is_filterable = TRUE
      GROUP BY ca.id
      ORDER BY ca.sort_order, ca.id
    `, [categoryId]);
    return result.rows;
  }

  async findById(id: string): Promise<ListingRow | undefined> {
    const result = await this.database.query<ListingRow>(`
      SELECT l.id, l.category_id AS "categoryId", l.model_id AS "modelId",
        l.year, l.mileage, l.price, l.condition, l.transmission,
        l.fuel_type AS "fuelType", l.color, l.city, l.region, l.status,
        l.title, l.description, l.created_at AS "createdAt", l.updated_at AS "updatedAt",
        mk.name AS "makeName", md.name AS "modelName",
        c.name AS "categoryName", c.slug AS "categorySlug",
        COALESCE(img.images, '[]'::JSONB) AS images
      FROM listings l
      JOIN models md ON md.id = l.model_id
      JOIN makes mk ON mk.id = md.make_id
      JOIN categories c ON c.id = l.category_id
      LEFT JOIN LATERAL (${imageAggregate}) img ON TRUE
      WHERE l.id = $1::BIGINT AND l.deleted_at IS NULL
    `, [id]);
    return result.rows[0];
  }

  async update(id: string, input: UpdateListingRecord): Promise<ListingRow | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    const columns: Record<keyof UpdateListingRecord, { column: string; cast?: string }> = {
      categoryId: { column: 'category_id', cast: 'BIGINT' },
      modelId: { column: 'model_id', cast: 'BIGINT' },
      year: { column: 'year', cast: 'SMALLINT' },
      mileage: { column: 'mileage', cast: 'INTEGER' },
      price: { column: 'price', cast: 'NUMERIC' },
      condition: { column: 'condition', cast: 'listing_condition' },
      transmission: { column: 'transmission', cast: 'listing_transmission' },
      fuelType: { column: 'fuel_type', cast: 'listing_fuel_type' },
      color: { column: 'color' },
      city: { column: 'city' },
      region: { column: 'region' },
      status: { column: 'status', cast: 'listing_status' },
      title: { column: 'title' },
      description: { column: 'description' },
    };
    for (const key of Object.keys(columns) as (keyof UpdateListingRecord)[]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        const { column, cast } = columns[key];
        fields.push(`${column} = $${values.length}${cast ? `::${cast}` : ''}`);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push('updated_at = now()');
    const result = await this.database.query<ListingRow>(`
      UPDATE listings SET ${fields.join(', ')}
      WHERE id = $1::BIGINT AND deleted_at IS NULL
      RETURNING id, category_id AS "categoryId", model_id AS "modelId",
        year, mileage, price, condition, transmission, fuel_type AS "fuelType",
        color, city, region, status, title, description,
        created_at AS "createdAt", updated_at AS "updatedAt"
    `, values);
    return result.rows[0];
  }

  async softDelete(
    id: string,
  ): Promise<{ id: string; status: string; deletedAt: Date } | undefined> {
    const result = await this.database.query(`
      UPDATE listings
      SET status = 'removed', deleted_at = now(), updated_at = now()
      WHERE id = $1::BIGINT AND deleted_at IS NULL
      RETURNING id, status, deleted_at AS "deletedAt"
    `, [id]);
    return result.rows[0] as
      | { id: string; status: string; deletedAt: Date }
      | undefined;
  }
}
