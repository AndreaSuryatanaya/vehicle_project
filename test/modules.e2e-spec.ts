import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { CategoriesRepository } from '../src/module/categories/repositories/categories.repository.js';
import { ListingsRepository } from '../src/module/listings/repositories/listings.repository.js';
import type {
  CategoryRecord,
  CreateCategoryRecord,
  UpdateCategoryRecord,
} from '../src/module/categories/interface/categories.interface.js';
import type {
  CreateListingRecord,
  ListingRow,
  UpdateListingRecord,
} from '../src/module/listings/interface/listings.interface.js';

const category: CategoryRecord = {
  id: '1',
  parentId: null,
  name: 'Cars',
  slug: 'cars',
  sortOrder: 1,
  isActive: true,
};

const childCategory: CategoryRecord = {
  id: '2',
  parentId: '1',
  name: 'SUV',
  slug: 'suv',
  sortOrder: 1,
  isActive: true,
};

const listing: ListingRow = {
  id: '10',
  categoryId: '1',
  modelId: '7',
  year: 2022,
  mileage: 10000,
  price: '25000000',
  condition: 'used',
  transmission: 'automatic',
  fuelType: 'petrol',
  color: 'white',
  city: 'Semarang',
  region: 'Central Java',
  status: 'available',
  title: 'Honda Vario 160',
  description: 'Well maintained',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  makeName: 'Honda',
  modelName: 'Vario 160',
  categoryName: 'Cars',
  images: [],
};

function databaseError(code: string): DatabaseError {
  const error = new DatabaseError('simulated database error', 0, 'error');
  error.code = code;
  return error;
}

describe('Categories and Listings API (e2e)', () => {
  let app: INestApplication;
  let categoriesRepository: Record<string, any>;
  let listingsRepository: Record<string, any>;

  beforeEach(async () => {
    categoriesRepository = {
      findAllActiveTree: vi.fn(async () => [category, childCategory]),
      findWithActiveChildren: vi.fn(async (id: string) => id === '999' ? [] : [category, childCategory]),
      findListingsInCategoryTree: vi.fn(async () => ({ data: [listing], total: 1 })),
      hasActiveCategory: vi.fn(async (id: string) => id !== '999'),
      findById: vi.fn(async (id: string) => id === '999' ? undefined : category),
      create: vi.fn(async (input: CreateCategoryRecord) => ({ ...category, ...input, id: '3' })),
      update: vi.fn(async (id: string, input: UpdateCategoryRecord) =>
        id === '999' ? undefined : { ...category, ...input }),
      delete: vi.fn(async (id: string) => id === '999' ? undefined : category),
    };

    listingsRepository = {
      create: vi.fn(async (_input: CreateListingRecord) => listing),
      findMany: vi.fn(async () => [listing]),
      count: vi.fn(async () => 1),
      search: vi.fn(async () => [{ ...listing, rank: 0.5 }]),
      countSearch: vi.fn(async () => 1),
      searchFacets: vi.fn(async () => [
        { facet: 'make', value: '1', label: 'Honda', count: 1 },
        { facet: 'fuelType', value: 'petrol', label: 'petrol', count: 1 },
      ]),
      findSuggestions: vi.fn(async () => [{ type: 'make', value: 'Honda' }]),
      findAllFilterOptions: vi.fn(async () => [
        { facet: 'make', value: '1', label: 'Honda', count: 1 },
      ]),
      findCategoryFilters: vi.fn(async () => [
        {
          id: '11', key: 'engine_size', label: 'Engine size', type: 'range',
          unit: 'cc', range: { min: 110, max: 250 },
        },
      ]),
      findById: vi.fn(async (id: string) => id === '999' ? undefined : listing),
      update: vi.fn(async (id: string, _input: UpdateListingRecord) => id === '999' ? undefined : listing),
      softDelete: vi.fn(async (id: string) =>
        id === '999' ? undefined : { id, status: 'removed', deletedAt: new Date('2025-01-02T00:00:00.000Z') }),
    };

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CategoriesRepository)
      .useValue(categoriesRepository)
      .overrideProvider(ListingsRepository)
      .useValue(listingsRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Categories', () => {
    it('GET /categories returns a nested category tree', async () => {
      const response = await request(app.getHttpServer()).get('/categories').expect(200);
      expect(response.body.data[0].children[0].id).toBe('2');
    });

    it('GET /categories/:id returns details, validates ids, and returns 404 for missing rows', async () => {
      await request(app.getHttpServer()).get('/categories/1').expect(200);
      await request(app.getHttpServer()).get('/categories/abc').expect(400);
      await request(app.getHttpServer()).get('/categories/999').expect(404);
    });

    it('GET /categories/:id/listings paginates and rejects invalid query values or inactive categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories/1/listings?page=2&limit=10')
        .expect(200);
      expect(response.body.pagination.page).toBe(2);
      expect(categoriesRepository.findListingsInCategoryTree).toHaveBeenCalledWith('1', 10, 10);
      await request(app.getHttpServer()).get('/categories/1/listings?page=0').expect(400);
      await request(app.getHttpServer()).get('/categories/1/listings?limit=101').expect(400);
      await request(app.getHttpServer()).get('/categories/999/listings').expect(404);
    });

    it('POST /categories validates payload and maps duplicate or missing-reference database errors', async () => {
      const payload = { name: 'Motorcycles' };
      const response = await request(app.getHttpServer()).post('/categories').send(payload).expect(201);
      expect(response.body.data.slug).toBe('motorcycles');
      await request(app.getHttpServer()).post('/categories').send({ name: '' }).expect(400);
      await request(app.getHttpServer()).post('/categories').send({ name: '---' }).expect(400);

      categoriesRepository.create.mockRejectedValueOnce(databaseError('23505'));
      await request(app.getHttpServer()).post('/categories').send(payload).expect(409);
      categoriesRepository.create.mockRejectedValueOnce(databaseError('23503'));
      await request(app.getHttpServer()).post('/categories').send({ ...payload, parentId: '999' }).expect(409);
    });

    it('PATCH /categories/:id validates payload and maps not-found and conflict errors', async () => {
      await request(app.getHttpServer()).patch('/categories/1').send({ name: 'Cars revised' }).expect(200);
      await request(app.getHttpServer()).patch('/categories/1').send({}).expect(400);
      await request(app.getHttpServer()).patch('/categories/1').send({ unknown: true }).expect(400);
      await request(app.getHttpServer()).patch('/categories/999').send({ name: 'Missing' }).expect(404);

      categoriesRepository.update.mockRejectedValueOnce(databaseError('23505'));
      await request(app.getHttpServer()).patch('/categories/1').send({ slug: 'cars' }).expect(409);
    });

    it('DELETE /categories/:id handles invalid, missing, referenced, and successful deletes', async () => {
      await request(app.getHttpServer()).delete('/categories/nope').expect(400);
      await request(app.getHttpServer()).delete('/categories/999').expect(404);
      categoriesRepository.delete.mockRejectedValueOnce(databaseError('23503'));
      await request(app.getHttpServer()).delete('/categories/1').expect(409);
      await request(app.getHttpServer()).delete('/categories/1').expect(200);
    });
  });

  describe('Listings', () => {
    const createPayload = {
      categoryId: '1',
      modelId: '7',
      year: 2022,
      mileage: 10000,
      price: 25000000,
      condition: 'used',
      transmission: 'automatic',
      fuelType: 'petrol',
      color: 'white',
      city: 'Semarang',
      region: 'Central Java',
      title: 'Honda Vario 160',
      images: [{ url: 'https://example.test/vario.jpg', position: 0, isPrimary: true }],
      attributes: [{ attributeId: '11', valueNumber: 160 }],
    };

    it('POST /listings creates a listing and DTO rejects invalid body or nested values', async () => {
      const response = await request(app.getHttpServer()).post('/listings').send(createPayload).expect(201);
      expect(response.body.data.id).toBe('10');
      await request(app.getHttpServer()).post('/listings').send({ ...createPayload, year: 1800 }).expect(400);
      await request(app.getHttpServer()).post('/listings').send({ ...createPayload, extra: true }).expect(400);
      await request(app.getHttpServer()).post('/listings').send({
        ...createPayload,
        attributes: [{ attributeId: '11', valueText: 'one', valueNumber: 2 }],
      }).expect(400);
      await request(app.getHttpServer()).post('/listings').send({
        ...createPayload,
        images: [{ url: '', position: -1 }],
      }).expect(400);
    });

    it('POST /listings maps foreign-key, check, type, range, and unique errors', async () => {
      for (const code of ['23503', '23514', '22P02', '22003', '23505']) {
        listingsRepository.create.mockRejectedValueOnce(databaseError(code));
        await request(app.getHttpServer()).post('/listings').send(createPayload).expect(400);
      }
    });

    it('GET /listings paginates and validates query filters and cursors', async () => {
      const response = await request(app.getHttpServer()).get('/listings?limit=10').expect(200);
      expect(response.body.pagination).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
      await request(app.getHttpServer()).get('/listings?limit=101').expect(400);
      await request(app.getHttpServer()).get('/listings?minPrice=100&maxPrice=10').expect(400);
      await request(app.getHttpServer()).get('/listings?minYear=2024&maxYear=2020').expect(400);
      await request(app.getHttpServer()).get('/listings?fuelType=kerosene').expect(400);
      await request(app.getHttpServer()).get('/listings?sort=unknown').expect(400);
      await request(app.getHttpServer()).get('/listings?cursor=not-a-cursor').expect(400);
    });

    it('GET /listings/search returns facets and full pagination metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/search?q=Honda&limit=10')
        .expect(200);
      expect(response.body.pagination).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        nextCursor: null,
        previousCursor: null,
      });
      expect(response.body.facets.make[0].label).toBe('Honda');
      await request(app.getHttpServer()).get('/listings/search?minPrice=100&maxPrice=10').expect(400);
      await request(app.getHttpServer()).get('/listings/search?cursor=invalid').expect(400);
    });

    it('GET /listings/search/suggest requires q and returns suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/search/suggest?q=Hon')
        .expect(200);
      expect(response.body.data).toEqual([{ type: 'make', value: 'Honda' }]);
      await request(app.getHttpServer()).get('/listings/search/suggest').expect(400);
      await request(app.getHttpServer()).get('/listings/search/suggest?q=').expect(400);
    });

    it('GET /listings/:id returns a listing or expected validation/not-found errors', async () => {
      await request(app.getHttpServer()).get('/listings/10').expect(200);
      await request(app.getHttpServer()).get('/listings/abc').expect(400);
      await request(app.getHttpServer()).get('/listings/999').expect(404);
    });

    it('PATCH /listings/:id validates and maps update errors', async () => {
      await request(app.getHttpServer()).patch('/listings/10').send({ price: 30000000 }).expect(200);
      await request(app.getHttpServer()).patch('/listings/10').send({}).expect(400);
      await request(app.getHttpServer()).patch('/listings/10').send({ price: -1 }).expect(400);
      await request(app.getHttpServer()).patch('/listings/10').send({ unexpected: true }).expect(400);
      await request(app.getHttpServer()).patch('/listings/999').send({ title: 'Missing' }).expect(404);
      listingsRepository.update.mockRejectedValueOnce(databaseError('23503'));
      await request(app.getHttpServer()).patch('/listings/10').send({ modelId: '999' }).expect(400);
    });

    it('DELETE /listings/:id handles invalid ids, missing rows, and success', async () => {
      await request(app.getHttpServer()).delete('/listings/invalid').expect(400);
      await request(app.getHttpServer()).delete('/listings/999').expect(404);
      await request(app.getHttpServer()).delete('/listings/10').expect(200);
    });
  });

  describe('Filters', () => {
    it('GET /filters returns available facet options', async () => {
      const response = await request(app.getHttpServer()).get('/filters').expect(200);
      expect(response.body.data[0].label).toBe('Honda');
    });

    it('GET /filters/:categoryId returns attributes and validates the category id', async () => {
      const response = await request(app.getHttpServer()).get('/filters/1').expect(200);
      expect(response.body.data[0].key).toBe('engine_size');
      await request(app.getHttpServer()).get('/filters/invalid').expect(400);
    });
  });
});
