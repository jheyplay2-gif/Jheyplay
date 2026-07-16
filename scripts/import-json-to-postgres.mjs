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
const projectRoot = resolve(scriptDir, '..');
const dataDir = resolve(projectRoot, 'data');

const readJson = async (filePath, fallbackValue) => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
};

const asNumber = (value, fallbackValue = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const exchangeRateFile = resolve(dataDir, 'exchange-rate.json');
const productsFile = resolve(dataDir, 'products-override.json');
const gamesFile = resolve(dataDir, 'games-override.json');
const ordersFile = resolve(dataDir, 'orders.json');

const exchangeRateContent = await readJson(exchangeRateFile, { rate: 700 });
const productOverrides = await readJson(productsFile, []);
const gameOverrides = await readJson(gamesFile, []);
const orders = await readJson(ordersFile, []);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query('TRUNCATE TABLE orders, product_overrides, game_overrides, exchange_rates RESTART IDENTITY');

  const rate = asNumber(exchangeRateContent?.rate, 700);
  await client.query('INSERT INTO exchange_rates (id, rate) VALUES (1, $1)', [rate > 0 ? rate : 700]);

  for (const item of Array.isArray(gameOverrides) ? gameOverrides : []) {
    if (!item || typeof item !== 'object' || typeof item.gameSlug !== 'string') {
      continue;
    }

    await client.query(
      `
        INSERT INTO game_overrides (game_slug, image, name, description, custom, deleted, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        item.gameSlug,
        typeof item.image === 'string' ? item.image : null,
        typeof item.name === 'string' ? item.name : null,
        typeof item.description === 'string' ? item.description : null,
        Boolean(item.custom),
        Boolean(item.deleted),
      ],
    );
  }

  for (const item of Array.isArray(productOverrides) ? productOverrides : []) {
    if (!item || typeof item !== 'object' || typeof item.gameSlug !== 'string' || typeof item.productLabel !== 'string') {
      continue;
    }

    await client.query(
      `
        INSERT INTO product_overrides (game_slug, product_label, usd, stock, active, deleted, bs, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      [
        item.gameSlug,
        item.productLabel,
        asNumber(item.usd, 0),
        Number.isInteger(item.stock) ? item.stock : 0,
        Boolean(item.active),
        Boolean(item.deleted),
        typeof item.bs === 'number' ? item.bs : null,
      ],
    );
  }

  for (const item of Array.isArray(orders) ? orders : []) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const product = item.product && typeof item.product === 'object' ? item.product : null;

    await client.query(
      `
        INSERT INTO orders (
          id,
          created_at,
          game_slug,
          game_name,
          player_id,
          payment_method,
          receipt_url,
          status,
          product_label,
          product_usd,
          product_bs,
          product_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        typeof item.id === 'string' ? item.id : '',
        typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        typeof item.gameSlug === 'string' ? item.gameSlug : '',
        typeof item.gameName === 'string' ? item.gameName : '',
        typeof item.playerId === 'string' ? item.playerId : '',
        typeof item.paymentMethod === 'string' ? item.paymentMethod : '',
        typeof item.receiptUrl === 'string' ? item.receiptUrl : '',
        typeof item.status === 'string' ? item.status : 'pendiente-validacion',
        typeof item.productLabel === 'string' ? item.productLabel : typeof product?.label === 'string' ? product.label : '',
        asNumber(item.productUsd ?? product?.usd, 0),
        asNumber(item.productBs ?? product?.bs, 0),
        typeof item.productActive === 'boolean' ? item.productActive : Boolean(product?.active ?? true),
      ],
    );
  }

  await client.query('COMMIT');
  console.log('Datos JSON importados correctamente a PostgreSQL.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('No se pudieron importar los datos JSON a PostgreSQL.');
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}