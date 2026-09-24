import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const fixtureTitlePrefix = 'SEED-DEMO-';
const count = Number(process.env.SEED_LISTING_COUNT ?? 600);

if (!Number.isSafeInteger(count) || count < 500) {
  throw new Error('SEED_LISTING_COUNT must be an integer greater than or equal to 500');
}

const databaseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? process.env.USER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? 'vehicle_project',
    };
const pool = new Pool(databaseConfig);

const categoryDefinitions = [
  { name: 'Cars', slug: 'cars', parent: null, sortOrder: 1 },
  { name: 'Motorcycles', slug: 'motorcycles', parent: null, sortOrder: 2 },
  { name: 'SUV', slug: 'suv', parent: 'cars', sortOrder: 1 },
  { name: 'MPV', slug: 'mpv', parent: 'cars', sortOrder: 2 },
  { name: 'Sedan', slug: 'sedan', parent: 'cars', sortOrder: 3 },
  { name: 'Hatchback', slug: 'hatchback', parent: 'cars', sortOrder: 4 },
  { name: 'Pickup', slug: 'pickup', parent: 'cars', sortOrder: 5 },
  { name: 'Crossover', slug: 'crossover', parent: 'cars', sortOrder: 6 },
  { name: 'Electric Vehicles', slug: 'electric-vehicles', parent: 'cars', sortOrder: 7 },
  { name: 'Scooter', slug: 'scooter', parent: 'motorcycles', sortOrder: 1 },
  { name: 'Sport Bike', slug: 'sport-bike', parent: 'motorcycles', sortOrder: 2 },
  { name: 'Underbone', slug: 'underbone', parent: 'motorcycles', sortOrder: 3 },
];

// Filter metadata is category-specific; it is separate from each listing's values.
const categoryFilterDefinitions = {
  cars: [
    { key: 'body_type', label: 'Body type', type: 'enum', options: ['SUV', 'MPV', 'Sedan', 'Hatchback', 'Pickup', 'Crossover'] },
    { key: 'seat_capacity', label: 'Seat capacity', type: 'range', unit: 'seats' },
  ],
  suv: [
    { key: 'drivetrain', label: 'Drivetrain', type: 'enum', options: ['FWD', 'RWD', 'AWD', '4WD'] },
    { key: 'seat_capacity', label: 'Seat capacity', type: 'range', unit: 'seats' },
  ],
  mpv: [
    { key: 'seat_capacity', label: 'Seat capacity', type: 'range', unit: 'seats' },
    { key: 'sliding_door', label: 'Sliding doors', type: 'boolean' },
  ],
  motorcycles: [
    { key: 'engine_capacity', label: 'Engine capacity', type: 'range', unit: 'cc' },
    { key: 'motorcycle_style', label: 'Motorcycle style', type: 'enum', options: ['Scooter', 'Sport bike', 'Underbone'] },
  ],
  scooter: [
    { key: 'engine_capacity', label: 'Engine capacity', type: 'range', unit: 'cc' },
  ],
  'sport-bike': [
    { key: 'engine_capacity', label: 'Engine capacity', type: 'range', unit: 'cc' },
    { key: 'abs', label: 'ABS', type: 'boolean' },
  ],
  underbone: [
    { key: 'engine_capacity', label: 'Engine capacity', type: 'range', unit: 'cc' },
  ],
};

const catalog = [
  ['Toyota', 'Fortuner', 'suv', 'diesel', 'car', 560_000_000],
  ['Toyota', 'Avanza', 'mpv', 'petrol', 'car', 250_000_000],
  ['Toyota', 'Corolla Cross', 'crossover', 'hybrid', 'car', 480_000_000],
  ['Toyota', 'Hilux', 'pickup', 'diesel', 'car', 430_000_000],
  ['Toyota', 'Yaris Cross', 'crossover', 'hybrid', 'car', 390_000_000],
  ['Honda', 'CR-V', 'suv', 'hybrid', 'car', 620_000_000],
  ['Honda', 'HR-V', 'suv', 'petrol', 'car', 390_000_000],
  ['Honda', 'Brio', 'hatchback', 'petrol', 'car', 190_000_000],
  ['Honda', 'Civic', 'sedan', 'petrol', 'car', 590_000_000],
  ['Honda', 'Vario 160', 'scooter', 'petrol', 'motorcycle', 28_000_000],
  ['Daihatsu', 'Terios', 'suv', 'petrol', 'car', 280_000_000],
  ['Daihatsu', 'Xenia', 'mpv', 'petrol', 'car', 250_000_000],
  ['Daihatsu', 'Ayla', 'hatchback', 'petrol', 'car', 145_000_000],
  ['Daihatsu', 'Rocky', 'crossover', 'petrol', 'car', 230_000_000],
  ['Mitsubishi', 'Xpander', 'mpv', 'petrol', 'car', 320_000_000],
  ['Mitsubishi', 'Pajero Sport', 'suv', 'diesel', 'car', 590_000_000],
  ['Mitsubishi', 'Triton', 'pickup', 'diesel', 'car', 500_000_000],
  ['Mitsubishi', 'Xforce', 'crossover', 'petrol', 'car', 390_000_000],
  ['Suzuki', 'Ertiga', 'mpv', 'hybrid', 'car', 290_000_000],
  ['Suzuki', 'Jimny', 'suv', 'petrol', 'car', 460_000_000],
  ['Suzuki', 'Fronx', 'crossover', 'hybrid', 'car', 330_000_000],
  ['Suzuki', 'Satria F150', 'underbone', 'petrol', 'motorcycle', 30_000_000],
  ['Nissan', 'Livina', 'mpv', 'petrol', 'car', 280_000_000],
  ['Nissan', 'Terra', 'suv', 'diesel', 'car', 520_000_000],
  ['Hyundai', 'Creta', 'crossover', 'petrol', 'car', 350_000_000],
  ['Hyundai', 'Ioniq 5', 'electric-vehicles', 'electric', 'car', 780_000_000],
  ['Hyundai', 'Stargazer', 'mpv', 'petrol', 'car', 300_000_000],
  ['Kia', 'Seltos', 'suv', 'petrol', 'car', 390_000_000],
  ['Kia', 'EV6', 'electric-vehicles', 'electric', 'car', 1_300_000_000],
  ['Mazda', 'CX-5', 'suv', 'petrol', 'car', 620_000_000],
  ['Mazda', 'Mazda2', 'hatchback', 'petrol', 'car', 360_000_000],
  ['Wuling', 'Air ev', 'electric-vehicles', 'electric', 'car', 250_000_000],
  ['Wuling', 'Confero', 'mpv', 'petrol', 'car', 190_000_000],
  ['Yamaha', 'NMAX', 'scooter', 'petrol', 'motorcycle', 34_000_000],
  ['Yamaha', 'Aerox', 'scooter', 'petrol', 'motorcycle', 31_000_000],
  ['Yamaha', 'XMAX', 'scooter', 'petrol', 'motorcycle', 68_000_000],
  ['Yamaha', 'R15', 'sport-bike', 'petrol', 'motorcycle', 40_000_000],
  ['Yamaha', 'MT-15', 'sport-bike', 'petrol', 'motorcycle', 39_000_000],
  ['Kawasaki', 'Ninja 250', 'sport-bike', 'petrol', 'motorcycle', 68_000_000],
  ['Kawasaki', 'KLX 150', 'sport-bike', 'petrol', 'motorcycle', 38_000_000],
  ['Kawasaki', 'W175', 'underbone', 'petrol', 'motorcycle', 35_000_000],
  ['Vespa', 'Primavera', 'scooter', 'petrol', 'motorcycle', 55_000_000],
  ['Vespa', 'Sprint', 'scooter', 'petrol', 'motorcycle', 58_000_000],
];

const locations = [
  ['Jakarta', 'DKI Jakarta'],
  ['Bandung', 'West Java'],
  ['Surabaya', 'East Java'],
  ['Semarang', 'Central Java'],
  ['Yogyakarta', 'Special Region of Yogyakarta'],
  ['Denpasar', 'Bali'],
  ['Medan', 'North Sumatra'],
  ['Makassar', 'South Sulawesi'],
];
const colors = ['white', 'black', 'silver', 'gray', 'red', 'blue'];
const carTransmissions = ['automatic', 'cvt', 'manual'];
const motorcycleTransmissions = ['automatic', 'manual', 'cvt'];
const descriptions = [
  'Service record available, clean interior, and ready for inspection.',
  'Well maintained vehicle with complete documents and responsive owner.',
  'Carefully used, routinely serviced, and available for a test drive.',
  'Good daily driver condition with clear paperwork and detailed photos.',
];

async function ensureCategory(client, definition, ids) {
  const parentId = definition.parent ? ids.get(definition.parent) : null;
  const inserted = await client.query(
    `INSERT INTO categories (parent_id, name, slug, sort_order, is_active)
     VALUES ($1::BIGINT, $2, $3, $4, TRUE)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [parentId, definition.name, definition.slug, definition.sortOrder],
  );
  const id = inserted.rows[0]?.id ?? (await client.query(
    'SELECT id FROM categories WHERE slug = $1', [definition.slug],
  )).rows[0]?.id;
  if (!id) throw new Error(`Could not find or create category "${definition.slug}"`);
  ids.set(definition.slug, String(id));
}

async function ensureMake(client, name) {
  const inserted = await client.query(
    'INSERT INTO makes (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
    [name],
  );
  const id = inserted.rows[0]?.id ?? (await client.query(
    'SELECT id FROM makes WHERE name = $1', [name],
  )).rows[0]?.id;
  if (!id) throw new Error(`Could not find or create make "${name}"`);
  return String(id);
}

async function ensureModel(client, makeId, name) {
  const inserted = await client.query(
    `INSERT INTO models (make_id, name) VALUES ($1::BIGINT, $2)
     ON CONFLICT (make_id, name) DO NOTHING RETURNING id`,
    [makeId, name],
  );
  const id = inserted.rows[0]?.id ?? (await client.query(
    'SELECT id FROM models WHERE make_id = $1::BIGINT AND name = $2', [makeId, name],
  )).rows[0]?.id;
  if (!id) throw new Error(`Could not find or create model "${name}"`);
  return String(id);
}

async function ensureCategoryFilters(client, categoryId, definitions) {
  for (const [sortOrder, definition] of definitions.entries()) {
    const result = await client.query(`
      INSERT INTO category_attributes (
        category_id, key, label, type, unit, is_filterable, is_required, sort_order
      ) VALUES ($1::BIGINT, $2, $3, $4, $5, TRUE, FALSE, $6)
      ON CONFLICT (category_id, key) DO UPDATE SET
        label = EXCLUDED.label,
        type = EXCLUDED.type,
        unit = EXCLUDED.unit,
        is_filterable = TRUE,
        sort_order = EXCLUDED.sort_order
      RETURNING id
    `, [categoryId, definition.key, definition.label, definition.type, definition.unit ?? null, sortOrder + 1]);
    const attributeId = result.rows[0].id;

    for (const [optionOrder, option] of (definition.options ?? []).entries()) {
      await client.query(`
        INSERT INTO attribute_options (attribute_id, value, label, sort_order)
        VALUES ($1::BIGINT, $2, $2, $3)
        ON CONFLICT (attribute_id, value) DO UPDATE SET
          label = EXCLUDED.label,
          sort_order = EXCLUDED.sort_order
      `, [attributeId, option, optionOrder + 1]);
    }
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schema = await client.query(`
      SELECT
        to_regclass('public.listings') IS NOT NULL AS listings_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'search_vector'
        ) AS search_vector_exists
    `);
    if (!schema.rows[0].listings_exists) {
      throw new Error('The listings table is missing. Apply the project database schema before seeding.');
    }
    if (!schema.rows[0].search_vector_exists) {
      throw new Error('search_vector is missing. Run `psql -d "$PGDATABASE" -f src/database/search.sql` first.');
    }

    const categoryIds = new Map();
    for (const definition of categoryDefinitions.filter((item) => item.parent === null)) {
      await ensureCategory(client, definition, categoryIds);
    }
    for (const definition of categoryDefinitions.filter((item) => item.parent !== null)) {
      await ensureCategory(client, definition, categoryIds);
    }
    for (const [categorySlug, definitions] of Object.entries(categoryFilterDefinitions)) {
      await ensureCategoryFilters(client, categoryIds.get(categorySlug), definitions);
    }

    const makeIds = new Map();
    for (const [make] of catalog) {
      if (!makeIds.has(make)) makeIds.set(make, await ensureMake(client, make));
    }
    const modelIds = new Map();
    for (const [make, model] of catalog) {
      modelIds.set(`${make}|${model}`, await ensureModel(client, makeIds.get(make), model));
    }

    // Only replace this script's clearly marked fixtures; all user data is retained.
    await client.query('DELETE FROM listings WHERE title LIKE $1', [`${fixtureTitlePrefix}%`]);

    const rows = Array.from({ length: count }, (_, index) => {
      const sequence = index + 1;
      const [make, model, categorySlug, fuelType, vehicleKind, basePrice] = catalog[(index * 17) % catalog.length];
      const [city, region] = locations[(index * 5) % locations.length];
      const year = 2015 + ((index * 7) % 11);
      const mileage = vehicleKind === 'motorcycle'
        ? 1_200 + ((index * 1_873) % 98_000)
        : 4_500 + ((index * 7_391) % 185_000);
      const priceFactor = 0.84 + ((index * 13) % 33) / 100;
      const price = Math.round(basePrice * priceFactor / 100_000) * 100_000;
      const transmissionOptions = vehicleKind === 'motorcycle'
        ? motorcycleTransmissions
        : carTransmissions;
      const transmission = fuelType === 'electric'
        ? 'single_speed'
        : transmissionOptions[(index * 3) % transmissionOptions.length];
      const condition = year >= 2024 && index % 4 === 0 ? 'new' : 'used';
      const status = index % 20 === 0 ? 'pending' : index % 13 === 0 ? 'sold' : 'available';
      const color = colors[(index * 11) % colors.length];
      const title = `${fixtureTitlePrefix}${String(sequence).padStart(4, '0')} - ${year} ${make} ${model} - ${city}`;
      const description = `${descriptions[index % descriptions.length]} ${make} ${model} in ${city}, ${region}.`;
      const createdAt = new Date(Date.now() - (index % 730) * 86_400_000).toISOString();
      return {
        categoryId: categoryIds.get(categorySlug),
        categorySlug,
        modelId: modelIds.get(`${make}|${model}`),
        year,
        mileage,
        price,
        condition,
        transmission,
        fuelType,
        color,
        city,
        region,
        status,
        title,
        description,
        createdAt,
        updatedAt: createdAt,
      };
    });

    const inserted = await client.query(`
      INSERT INTO listings (
        category_id, model_id, year, mileage, price, condition, transmission,
        fuel_type, color, city, region, status, title, description, created_at, updated_at
      )
      SELECT * FROM unnest(
        $1::BIGINT[], $2::BIGINT[], $3::SMALLINT[], $4::INTEGER[], $5::NUMERIC[],
        $6::listing_condition[], $7::listing_transmission[], $8::listing_fuel_type[],
        $9::VARCHAR[], $10::VARCHAR[], $11::VARCHAR[], $12::listing_status[],
        $13::VARCHAR[], $14::TEXT[], $15::TIMESTAMPTZ[], $16::TIMESTAMPTZ[]
      )
      RETURNING id, title
    `, [
      rows.map((row) => row.categoryId),
      rows.map((row) => row.modelId),
      rows.map((row) => row.year),
      rows.map((row) => row.mileage),
      rows.map((row) => row.price),
      rows.map((row) => row.condition),
      rows.map((row) => row.transmission),
      rows.map((row) => row.fuelType),
      rows.map((row) => row.color),
      rows.map((row) => row.city),
      rows.map((row) => row.region),
      rows.map((row) => row.status),
      rows.map((row) => row.title),
      rows.map((row) => row.description),
      rows.map((row) => row.createdAt),
      rows.map((row) => row.updatedAt),
    ]);

    await client.query(`
      INSERT INTO listing_images (listing_id, url, position, is_primary)
      SELECT id, 'https://images.example.test/seed/' || id || '-front.jpg', 0, TRUE
      FROM listings WHERE title LIKE $1
    `, [`${fixtureTitlePrefix}%`]);

    const rangeAttributes = await client.query(`
      SELECT c.slug, ca.id, ca.key
      FROM category_attributes ca
      JOIN categories c ON c.id = ca.category_id
      WHERE ca.type = 'range' AND ca.is_filterable = TRUE
    `);
    const rangeAttributeIds = new Map(
      rangeAttributes.rows.map((attribute) => [`${attribute.slug}|${attribute.key}`, String(attribute.id)]),
    );
    const categoryBySlug = new Map(categoryDefinitions.map((category) => [category.slug, category]));
    const fixtureByTitle = new Map(rows.map((row) => [row.title, row]));
    const attributeValues = [];
    for (const listing of inserted.rows) {
      const fixture = fixtureByTitle.get(listing.title);
      const listingCategorySlug = fixture.categorySlug;
      let categorySlug = fixture.categorySlug;
      while (categorySlug) {
        const category = categoryBySlug.get(categorySlug);
        for (const [slugAndKey, attributeId] of rangeAttributeIds) {
          const [attributeCategorySlug, key] = slugAndKey.split('|');
          if (attributeCategorySlug !== categorySlug) continue;

          let value;
          if (key === 'engine_capacity') {
            const offset = Number(listing.id) % 97;
            value = listingCategorySlug === 'scooter'
              ? 110 + (offset % 191)
              : listingCategorySlug === 'sport-bike'
                ? 150 + (offset % 851)
                : 110 + (offset % 61);
          } else if (key === 'seat_capacity') {
            value = listingCategorySlug === 'mpv'
              ? 7 + (Number(listing.id) % 2)
              : 5 + (Number(listing.id) % 3 === 0 ? 2 : 0);
          }
          if (value !== undefined) {
            attributeValues.push([String(listing.id), attributeId, value]);
          }
        }
        categorySlug = category.parent;
      }
    }
    if (attributeValues.length > 0) {
      await client.query(`
        INSERT INTO listing_attribute_values (listing_id, attribute_id, value_number)
        SELECT * FROM unnest($1::BIGINT[], $2::BIGINT[], $3::NUMERIC[])
      `, [
        attributeValues.map(([listingId]) => listingId),
        attributeValues.map(([, attributeId]) => attributeId),
        attributeValues.map(([, , value]) => value),
      ]);
    }

    await client.query('COMMIT');
    console.log(`Seeded ${inserted.rowCount ?? rows.length} listings across ${categoryDefinitions.length - 2} subcategories.`);
    console.log(`Fixture titles use the prefix "${fixtureTitlePrefix}" and can be safely replaced by rerunning this script.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
});
