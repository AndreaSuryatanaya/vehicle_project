import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { ListingsRepository } from './repositories/listings.repository.js';
import type {
  CategoryFilterAttribute,
  CreateListingRecord,
  FilterOptionCount,
  ListingBrowseQuery,
  ListingCursorPage,
  ListingFilterRecord,
  ListingSearchFilterRecord,
  ListingSearchResponse,
  ListingSuggestion,
  ListingRow,
  SearchCursor,
  UpdateListingRecord,
} from './interface/listings.interface.js';

@Injectable()
export class ListingsService {
  constructor(private readonly listingsRepository: ListingsRepository) {}

  async create(input: CreateListingRecord): Promise<ListingRow> {
    try {
      const created = await this.listingsRepository.create(input);
      return (await this.listingsRepository.findById(created.id)) ?? created;
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async findMany(query: ListingBrowseQuery): Promise<ListingCursorPage> {
    const filters = this.parseFilters(query);
    const [rows, total] = await Promise.all([
      this.listingsRepository.findMany(filters),
      this.listingsRepository.count(filters),
    ]);
    const hasMore = rows.length > filters.limit;
    const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
    const isPrevious = filters.cursor?.direction === 'previous';
    const data = isPrevious
      ? pageRows.reverse()
      : pageRows;
    const offset = isPrevious
      ? Math.max(0, (filters.cursor?.offset ?? filters.limit) - data.length)
      : filters.cursor?.offset ?? 0;
    const page = Math.floor(offset / filters.limit) + 1;
    const first = data[0];
    const last = data[data.length - 1];
    const nextCursor = last && (hasMore || isPrevious)
      ? this.makeCursor(last, filters.sort, 'next', offset + data.length)
      : null;
    const previousCursor = first && (isPrevious ? hasMore : offset > 0)
      ? this.makeCursor(first, filters.sort, 'previous', offset)
      : null;
    return {
      data,
      pagination: {
        total,
        page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
        nextCursor,
        previousCursor,
      },
    };
  }

  async search(query: ListingBrowseQuery): Promise<ListingSearchResponse> {
    const baseFilters = this.parseFilters({
      ...query,
      sort: 'newest',
      status: 'available',
      cursor: undefined,
    });
    const filters: ListingSearchFilterRecord = {
      q: query.q?.trim() || undefined,
      categoryId: baseFilters.categoryId,
      makeId: baseFilters.makeId,
      minPrice: baseFilters.minPrice,
      maxPrice: baseFilters.maxPrice,
      minYear: baseFilters.minYear,
      maxYear: baseFilters.maxYear,
      fuelType: baseFilters.fuelType,
      status: 'available',
      limit: baseFilters.limit,
      cursor: query.cursor ? this.decodeSearchCursor(query.cursor) : undefined,
    };
    const [rows, total, facetRows] = await Promise.all([
      this.listingsRepository.search(filters),
      this.listingsRepository.countSearch(filters),
      this.listingsRepository.searchFacets(filters),
    ]);
    const hasMore = rows.length > filters.limit;
    const isPrevious = filters.cursor?.direction === 'previous';
    const selectedRows = hasMore ? rows.slice(0, filters.limit) : rows;
    const data = isPrevious ? selectedRows.reverse() : selectedRows;
    const page = filters.cursor?.page ?? 1;
    const totalPages = Math.ceil(total / filters.limit);
    const first = data[0];
    const last = data[data.length - 1];
    const nextCursor = page < totalPages && last
      ? this.encodeSearchCursor({
          rank: last.rank,
          createdAt: last.createdAt.toISOString(),
          id: last.id,
          direction: 'next',
          page: page + 1,
        })
      : null;
    const previousCursor = page > 1 && first
      ? this.encodeSearchCursor({
          rank: first.rank,
          createdAt: first.createdAt.toISOString(),
          id: first.id,
          direction: 'previous',
          page: page - 1,
        })
      : null;
    return {
      data,
      pagination: {
        total,
        page,
        limit: filters.limit,
        totalPages,
        nextCursor,
        previousCursor,
      },
      facets: {
        make: facetRows.filter((facet) => facet.facet === 'make'),
        fuelType: facetRows.filter((facet) => facet.facet === 'fuelType'),
      },
    };
  }

  async findSuggestions(query: string): Promise<ListingSuggestion[]> {
    return this.listingsRepository.findSuggestions(query);
  }

  findAllFilterOptions(): Promise<FilterOptionCount[]> {
    return this.listingsRepository.findAllFilterOptions();
  }

  async findCategoryFilters(categoryId: string): Promise<CategoryFilterAttribute[]> {
    return this.listingsRepository.findCategoryFilters(categoryId);
  }

  async findOne(id: string): Promise<ListingRow> {
    const listing = await this.listingsRepository.findById(id);
    if (!listing) throw new NotFoundException(`Listing with id ${id} not found`);
    return listing;
  }

  async update(id: string, input: UpdateListingRecord): Promise<ListingRow> {
    try {
      const updated = await this.listingsRepository.update(id, input);
      if (!updated) throw new NotFoundException(`Listing with id ${id} not found`);
      return updated;
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async remove(id: string): Promise<{ id: string; status: string; deletedAt: Date }> {
    const removed = await this.listingsRepository.softDelete(id);
    if (!removed) throw new NotFoundException(`Listing with id ${id} not found`);
    return removed;
  }

  private parseFilters(query: ListingBrowseQuery): ListingFilterRecord {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    const sort = query.sort ?? 'newest';
    const status = query.status ?? 'available';
    const cursor = query.cursor ? this.decodeCursor(query.cursor, limit) : undefined;

    return {
      categoryId: query.categoryId,
      makeId: query.makeId,
      minPrice: query.minPrice === undefined ? undefined : Number(query.minPrice),
      maxPrice: query.maxPrice === undefined ? undefined : Number(query.maxPrice),
      minYear: query.minYear === undefined ? undefined : Number(query.minYear),
      maxYear: query.maxYear === undefined ? undefined : Number(query.maxYear),
      fuelType: query.fuelType,
      status,
      sort: sort as ListingFilterRecord['sort'],
      limit,
      cursor,
    };
  }

  private decodeCursor(value: string, limit: number): {
    value: string;
    createdAt: string;
    id: string;
    direction: 'next' | 'previous';
    offset: number;
  } {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      value: string;
      createdAt: string;
      id: string;
      direction?: 'next' | 'previous';
      offset?: number;
    };
    const direction = parsed.direction ?? 'next';
    return {
      value: parsed.value,
      createdAt: parsed.createdAt,
      id: parsed.id,
      direction,
      offset: parsed.offset ?? (direction === 'next' ? limit : 0),
    };
  }

  private makeCursor(
    row: ListingRow,
    sort: ListingFilterRecord['sort'],
    direction: 'next' | 'previous',
    offset: number,
  ): string {
    const value = {
      value: sort.startsWith('price_') ? row.price : row.createdAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      direction,
      offset,
    };
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decodeSearchCursor(value: string): SearchCursor {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SearchCursor;
    return {
      ...parsed,
      direction: parsed.direction ?? 'next',
      page: parsed.page ?? 2,
    };
  }

  private encodeSearchCursor(cursor: SearchCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private mapDatabaseError(error: unknown): never {
    if (error instanceof DatabaseError) {
      if (error.code === '23503') {
        throw new BadRequestException('A referenced category, model, or attribute does not exist');
      }
      if (error.code === '23514' || error.code === '22P02' || error.code === '22003') {
        throw new BadRequestException('Listing contains an invalid field value');
      }
      if (error.code === '23505') {
        throw new BadRequestException('Listing images contain a duplicate position');
      }
    }
    throw error;
  }
}
