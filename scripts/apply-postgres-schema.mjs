import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error('DATABASE_URL no esta configurada.');
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(scriptDir, '../database/postgres-schema.sql');
const schema = await readFile(schemaPath, 'utf-8');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();

try {
  await client.query(schema);
  console.log('Esquema PostgreSQL aplicado correctamente.');
} finally {
  client.release();
  await pool.end();
}