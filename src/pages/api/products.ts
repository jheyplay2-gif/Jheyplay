import type { APIRoute } from 'astro';
import { writeFile } from 'node:fs/promises';
import { games } from '../../data/games';
import { getMergedGames, getProductsOverrideFilePath, type ProductOverride } from '../../data/catalog';

interface UpdateProductInput {
  gameSlug?: unknown;
  productLabel?: unknown;
  usd?: unknown;
  active?: unknown;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

const parseOverrideBody = async (request: Request): Promise<UpdateProductInput | null> => {
  try {
    return (await request.json()) as UpdateProductInput;
  } catch {
    return null;
  }
};

const getStringField = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getBooleanField = (value: unknown) => (typeof value === 'boolean' ? value : null);

const writeOverrides = async (overrides: ProductOverride[]) => {
  const overrideFilePath = getProductsOverrideFilePath();
  await writeFile(overrideFilePath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
};

const getProductContext = async (gameSlug: string, productLabel: string) => {
  const { mergedGames, overrides } = await getMergedGames();
  const game = mergedGames.find((item) => item.slug === gameSlug);

  if (!game) {
    return { mergedGames, overrides, game: null, product: null };
  }

  const product = game.products.find((item) => item.label === productLabel) ?? null;
  return { mergedGames, overrides, game, product };
};

export const POST: APIRoute = async ({ request }) => {
  const payload = await parseOverrideBody(request);
  if (!payload) {
    return jsonResponse({ success: false, message: 'Body JSON invalido.' }, 400);
  }

  const gameSlug = getStringField(payload.gameSlug);
  const productLabel = getStringField(payload.productLabel);
  const usd = typeof payload.usd === 'number' ? payload.usd : Number.NaN;
  const active = getBooleanField(payload.active);

  if (!gameSlug || !productLabel || !Number.isFinite(usd) || active === null) {
    return jsonResponse({ success: false, message: 'Datos invalidos para crear producto.' }, 400);
  }

  const { game, overrides } = await getProductContext(gameSlug, productLabel);
  if (!game) {
    return jsonResponse({ success: false, message: 'Juego no encontrado.' }, 404);
  }

  const duplicatedProduct = game.products.find((item) => item.label.toLowerCase() === productLabel.toLowerCase());
  if (duplicatedProduct) {
    return jsonResponse({ success: false, message: 'Ya existe un producto con ese nombre en este juego.' }, 409);
  }

  const nextOverrides = overrides.filter(
    (item) => !(item.gameSlug === gameSlug && item.productLabel === productLabel),
  );

  const newProduct: ProductOverride = {
    gameSlug,
    productLabel,
    usd,
    stock: 0,
    active,
  };

  nextOverrides.push(newProduct);
  await writeOverrides(nextOverrides);

  return jsonResponse({ success: true, message: 'Producto creado.', product: newProduct }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const payload = await parseOverrideBody(request);
  if (!payload) {
    return jsonResponse({ success: false, message: 'Body JSON invalido.' }, 400);
  }

  const gameSlug = getStringField(payload.gameSlug);
  const productLabel = getStringField(payload.productLabel);
  const usd = typeof payload.usd === 'number' ? payload.usd : Number.NaN;
  const active = getBooleanField(payload.active);

  if (!gameSlug || !productLabel || !Number.isFinite(usd) || active === null) {
    return jsonResponse({ success: false, message: 'Datos invalidos para actualizar producto.' }, 400);
  }

  const { overrides, game, product } = await getProductContext(gameSlug, productLabel);
  if (!game) {
    return jsonResponse({ success: false, message: 'Juego no encontrado.' }, 404);
  }

  if (!product) {
    return jsonResponse({ success: false, message: 'Producto no encontrado para este juego.' }, 404);
  }

  const updatedOverride: ProductOverride = {
    gameSlug,
    productLabel,
    usd,
    stock: 0,
    active,
  };

  const nextOverrides = [...overrides];
  const existingIndex = nextOverrides.findIndex(
    (item) => item.gameSlug === gameSlug && item.productLabel === productLabel,
  );

  if (existingIndex >= 0) {
    nextOverrides[existingIndex] = updatedOverride;
  } else {
    nextOverrides.push(updatedOverride);
  }

  await writeOverrides(nextOverrides);

  return jsonResponse({ success: true, message: 'Producto actualizado.', product: updatedOverride }, 200);
};

export const DELETE: APIRoute = async ({ request }) => {
  const payload = await parseOverrideBody(request);
  if (!payload) {
    return jsonResponse({ success: false, message: 'Body JSON invalido.' }, 400);
  }

  const gameSlug = getStringField(payload.gameSlug);
  const productLabel = getStringField(payload.productLabel);

  if (!gameSlug || !productLabel) {
    return jsonResponse({ success: false, message: 'Datos invalidos para eliminar producto.' }, 400);
  }

  const { overrides, game, product } = await getProductContext(gameSlug, productLabel);
  if (!game) {
    return jsonResponse({ success: false, message: 'Juego no encontrado.' }, 404);
  }

  if (!product) {
    return jsonResponse({ success: false, message: 'Producto no encontrado para este juego.' }, 404);
  }

  const baseGame = games.find((item) => item.slug === gameSlug);
  const isBaseProduct = baseGame?.products.some((item) => item.label === productLabel) ?? false;

  const nextOverrides = overrides.filter(
    (item) => !(item.gameSlug === gameSlug && item.productLabel === productLabel),
  );

  if (isBaseProduct) {
    nextOverrides.push({
      gameSlug,
      productLabel,
      usd: product.usd,
      stock: 0,
      active: false,
      deleted: true,
    });
  }

  await writeOverrides(nextOverrides);

  return jsonResponse({ success: true, message: 'Producto eliminado.' }, 200);
};
