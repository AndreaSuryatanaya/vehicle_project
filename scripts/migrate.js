import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(scriptDirectory, '../docs/database/migration');
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

async function main() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('SELECT pg_advisory_lock($1)', [7_261_202_609]);
    lockAcquired = true;

    const migrationFiles = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    if (migrationFiles.length === 0) {
      console.log(`No SQL migrations found in ${migrationDirectory}`);
      return;
    }

    // Existing project databases may have the initial schema already applied
    // manually. Record that baseline instead of trying to recreate its tables.
    if (migrationFiles.includes('schema.sql')) {
      const schemaMigration = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE name = $1',
        ['schema.sql'],
      );
      const baseline = await client.query(`
        SELECT to_regclass('public.listings') IS NOT NULL
          AND to_regclass('public.categories') IS NOT NULL
          AND to_regclass('public.models') IS NOT NULL
          AND to_regclass('public.makes') IS NOT NULL AS exists
      `);
      if (schemaMigration.rowCount === 0 && baseline.rows[0].exists) {
        await client.query(
          `INSERT INTO public.schema_migrations (name) VALUES ('schema.sql')
           ON CONFLICT (name) DO NOTHING`,
        );
        console.log('Baselined schema.sql (core tables already exist)');
      }
    }

    for (const name of migrationFiles) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE name = $1',
        [name],
      );
      if (alreadyApplied.rowCount > 0) {
        console.log(`Skipping ${name} (already applied)`);
        continue;
      }

      const sql = await readFile(path.join(migrationDirectory, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [7_261_202_609]);
    }
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
