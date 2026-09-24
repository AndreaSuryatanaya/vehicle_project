import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { ListingsRepository } from './repositories/listings.repository.js';
import type {
  CreateListingRecord,
  ListingBrowseQuery,
  ListingCursorPage,
  ListingFilterRecord,
  ListingRow,
  UpdateListingRecord,
} from './interface/listings.interface.js';

@Injectable()
export class ListingsService {
  constructor(private readonly listingsRepository: ListingsRepository) {}

  async create(input: CreateListingRecord): Promise<ListingRow> {
    this.validateCreateInput(input);
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

  async findOne(id: string): Promise<ListingRow> {
    this.validateId(id);
    const listing = await this.listingsRepository.findById(id);
    if (!listing) throw new NotFoundException(`Listing with id ${id} not found`);
    return listing;
  }

  async update(id: string, input: UpdateListingRecord): Promise<ListingRow> {
    this.validateId(id);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Listing body must be an object');
    }
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one listing field is required');
    }
    if (input.categoryId !== undefined) this.validateId(input.categoryId);
    if (input.modelId !== undefined) this.validateId(input.modelId);
    if (input.year !== undefined && (!Number.isInteger(input.year) || input.year < 1886 || input.year > 2200)) {
      throw new BadRequestException('year must be an integer between 1886 and 2200');
    }
    if (input.mileage !== undefined && (!Number.isInteger(input.mileage) || input.mileage < 0)) {
      throw new BadRequestException('mileage must be a non-negative integer');
    }
    if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
      throw new BadRequestException('price must be zero or greater');
    }
    try {
      const updated = await this.listingsRepository.update(id, input);
      if (!updated) throw new NotFoundException(`Listing with id ${id} not found`);
      return updated;
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async remove(id: string): Promise<{ id: string; status: string; deletedAt: Date }> {
    this.validateId(id);
    const removed = await this.listingsRepository.softDelete(id);
    if (!removed) throw new NotFoundException(`Listing with id ${id} not found`);
    return removed;
  }

  private parseFilters(query: ListingBrowseQuery): ListingFilterRecord {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    for (const id of [query.categoryId, query.makeId]) {
      if (id !== undefined) this.validateId(id);
    }

    const minPrice = this.numberFilter(query.minPrice, 'minPrice');
    const maxPrice = this.numberFilter(query.maxPrice, 'maxPrice');
    const minYear = this.integerFilter(query.minYear, 'minYear');
    const maxYear = this.integerFilter(query.maxYear, 'maxYear');
    if (minPrice !== undefined && minPrice < 0 || maxPrice !== undefined && maxPrice < 0) {
      throw new BadRequestException('Price filters must be zero or greater');
    }
    if (minYear !== undefined && (minYear < 1886 || minYear > 2200) ||
        maxYear !== undefined && (maxYear < 1886 || maxYear > 2200)) {
      throw new BadRequestException('Year filters must be between 1886 and 2200');
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }
    if (minYear !== undefined && maxYear !== undefined && minYear > maxYear) {
      throw new BadRequestException('minYear cannot be greater than maxYear');
    }

    const sort = query.sort ?? 'newest';
    if (!['newest', 'oldest', 'price_asc', 'price_desc'].includes(sort)) {
      throw new BadRequestException('sort must be newest, oldest, price_asc, or price_desc');
    }
    const status = query.status ?? 'available';
    if (!['available', 'pending', 'sold', 'removed'].includes(status)) {
      throw new BadRequestException('status is invalid');
    }
    const fuelType = query.fuelType;
    if (fuelType !== undefined && ![
      'petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'cng', 'lpg',
    ].includes(fuelType)) {
      throw new BadRequestException('fuelType is invalid');
    }

    const cursor = query.cursor ? this.decodeCursor(query.cursor, limit) : undefined;
    if (cursor && sort.startsWith('price_') && !Number.isFinite(Number(cursor.value))) {
      throw new BadRequestException('cursor is invalid for price sorting');
    }
    if (cursor && !sort.startsWith('price_') && Number.isNaN(Date.parse(cursor.value))) {
      throw new BadRequestException('cursor is invalid for date sorting');
    }

    return {
      categoryId: query.categoryId,
      makeId: query.makeId,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      fuelType,
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
    try {
      const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (
        typeof parsed !== 'object' || parsed === null ||
        !('value' in parsed) || !('createdAt' in parsed) || !('id' in parsed) ||
        typeof parsed.value !== 'string' || typeof parsed.createdAt !== 'string' ||
        typeof parsed.id !== 'string' || !/^[1-9]\d*$/.test(parsed.id) ||
        Number.isNaN(Date.parse(parsed.createdAt))
      ) throw new Error('Malformed cursor');
      const direction = 'direction' in parsed ? parsed.direction : 'next';
      if (direction !== 'next' && direction !== 'previous') {
        throw new Error('Malformed cursor direction');
      }
      const offset = 'offset' in parsed ? parsed.offset : direction === 'next' ? limit : 0;
      if (!Number.isSafeInteger(offset) || typeof offset !== 'number' || offset < 0) {
        throw new Error('Malformed cursor offset');
      }
      return {
        value: parsed.value,
        createdAt: parsed.createdAt,
        id: parsed.id,
        direction,
        offset,
      };
    } catch {
      throw new BadRequestException('cursor is invalid');
    }
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

  private numberFilter(value: string | undefined, name: string): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(`${name} must be a number`);
    return parsed;
  }

  private integerFilter(value: string | undefined, name: string): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new BadRequestException(`${name} must be an integer`);
    }
    return parsed;
  }

  private validateCreateInput(input: CreateListingRecord): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Listing body is required');
    }
    this.validateId(input.categoryId);
    this.validateId(input.modelId);
    if (!Number.isInteger(input.year) || input.year < 1886 || input.year > 2200) {
      throw new BadRequestException('year must be an integer between 1886 and 2200');
    }
    if (!Number.isInteger(input.mileage) || input.mileage < 0) {
      throw new BadRequestException('mileage must be a non-negative integer');
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new BadRequestException('price must be zero or greater');
    }
    for (const field of [
      'condition', 'transmission', 'fuelType', 'color', 'city', 'region', 'title',
    ] as const) {
      if (typeof input[field] !== 'string' || input[field].trim() === '') {
        throw new BadRequestException(`${field} is required`);
      }
    }
    for (const image of input.images ?? []) {
      if (!image.url || typeof image.url !== 'string') {
        throw new BadRequestException('Each image requires a url');
      }
    }
    for (const attribute of input.attributes ?? []) {
      this.validateId(attribute.attributeId);
      const valueCount = [attribute.valueText, attribute.valueNumber, attribute.valueBoolean]
        .filter((value) => value !== undefined && value !== null).length;
      if (valueCount !== 1) {
        throw new BadRequestException('Each attribute must have exactly one value');
      }
    }
  }

  private validateId(value: string): void {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException('id must be a positive integer');
    }
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
