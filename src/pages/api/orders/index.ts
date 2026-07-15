import type { APIRoute } from 'astro';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getMergedGames } from '../../../data/catalog';

export const prerender = false;

interface OrderInput {
  gameSlug?: unknown;
  productLabel?: unknown;
  playerId?: unknown;
  paymentMethod?: unknown;
  receiptFile?: File | null;
}

const ordersFilePath = join(process.cwd(), 'data', 'orders.json');
const receiptsDirPath = join(process.cwd(), 'public', 'receipts');
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const ORDER_ID_PREFIX = 'JP-';
const ORDER_ID_DIGITS = 5;
const ORDER_ID_MAX = Number('9'.repeat(ORDER_ID_DIGITS));
const ORDER_ID_REGEX = /^JP-(\d{5})$/;

const SAMPLE_ORDERS = [
  {
    id: 'JP-00001',
    createdAt: '2026-07-15T14:00:00.000Z',
    gameSlug: 'free-fire',
    gameName: 'Free Fire',
    playerId: '123456789',
    paymentMethod: 'pago_movil',
    receiptUrl: '/receipts/sample-jp-00001.png',
    status: 'pendiente-validacion',
    product: {
      label: '310 Diamantes',
      usd: 5,
      bs: 500,
      active: true,
    },
  },
  {
    id: 'JP-00002',
    createdAt: '2026-07-15T16:30:00.000Z',
    gameSlug: 'roblox',
    gameName: 'Roblox',
    playerId: '99887766',
    paymentMethod: 'pago_movil',
    receiptUrl: '/receipts/sample-jp-00002.png',
    status: 'pendiente-validacion',
    product: {
      label: '800 Robux',
      usd: 10,
      bs: 1000,
      active: true,
    },
  },
];

const ALLOWED_RECEIPT_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

const getStringField = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseOrderBody = async (request: Request): Promise<OrderInput | null> => {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const receipt = form.get('receipt');

    return {
      gameSlug: form.get('gameSlug'),
      productLabel: form.get('productLabel'),
      playerId: form.get('playerId'),
      paymentMethod: form.get('paymentMethod'),
      receiptFile: receipt instanceof File ? receipt : null,
    };
  }

  try {
    return (await request.json()) as OrderInput;
  } catch {
    return null;
  }
};

const saveReceipt = async (receiptFile: File, orderId: string): Promise<string> => {
  if (receiptFile.size <= 0) {
    throw new Error('Debes subir una captura valida del comprobante.');
  }

  if (receiptFile.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new Error('La captura supera el limite de 5 MB.');
  }

  const extension = ALLOWED_RECEIPT_TYPES.get(receiptFile.type);
  if (!extension) {
    throw new Error('Formato de captura no permitido. Usa JPG, PNG o WEBP.');
  }

  await mkdir(receiptsDirPath, { recursive: true });
  const fileName = `receipt-${orderId}.${extension}`;
  const destinationPath = join(receiptsDirPath, fileName);

  const buffer = Buffer.from(await receiptFile.arrayBuffer());
  await writeFile(destinationPath, buffer);

  return `/receipts/${fileName}`;
};

const parseOrdersFile = async () => {
  try {
    const content = await readFile(ordersFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const generateOrderId = (orders: Array<{ id?: unknown }>) => {
  const usedIds = new Set(
    orders
      .map((order) => (typeof order?.id === 'string' ? order.id.trim() : ''))
      .filter((id) => id.length > 0),
  );

  let maxSequence = 0;
  for (const id of usedIds) {
    const match = ORDER_ID_REGEX.exec(id);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  let nextSequence = maxSequence + 1;

  while (nextSequence <= ORDER_ID_MAX) {
    const candidate = `${ORDER_ID_PREFIX}${String(nextSequence).padStart(ORDER_ID_DIGITS, '0')}`;
    if (!usedIds.has(candidate)) {
      return candidate;
    }

    nextSequence += 1;
  }

  throw new Error('Se alcanzo el limite de IDs de orden disponibles (JP-99999).');
};

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: corsHeaders });

export const GET: APIRoute = async () => {
  const orders = await parseOrdersFile();

  if (!Array.isArray(orders) || orders.length === 0) {
    return jsonResponse({ success: true, orders: SAMPLE_ORDERS }, 200);
  }

  return jsonResponse({ success: true, orders }, 200);
};

export const POST: APIRoute = async ({ request }) => {
  const payload = await parseOrderBody(request);
  if (!payload) {
    return jsonResponse({ success: false, message: 'Body invalido.' }, 400);
  }

  const gameSlug = getStringField(payload.gameSlug);
  const productLabel = getStringField(payload.productLabel);
  const playerId = getStringField(payload.playerId);
  const paymentMethod = getStringField(payload.paymentMethod);
  const receiptFile = payload.receiptFile instanceof File ? payload.receiptFile : null;

  if (!gameSlug || !productLabel || !playerId || !paymentMethod) {
    return jsonResponse({ success: false, message: 'Faltan campos obligatorios.' }, 400);
  }

  if (!receiptFile) {
    return jsonResponse({ success: false, message: 'Debes subir la captura del comprobante.' }, 400);
  }

  const { mergedGames } = await getMergedGames();
  const game = mergedGames.find((item) => item.slug === gameSlug);
  if (!game) {
    return jsonResponse({ success: false, message: 'Juego no encontrado.' }, 404);
  }

  const product = game.products.find((item) => item.label === productLabel && item.active);
  if (!product) {
    return jsonResponse({ success: false, message: 'Producto no valido para este juego.' }, 400);
  }

  const orders = await parseOrdersFile();
  let orderId = '';
  try {
    orderId = generateOrderId(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el ID de la orden.';
    return jsonResponse({ success: false, message }, 500);
  }

  let receiptUrl = '';

  try {
    receiptUrl = await saveReceipt(receiptFile, orderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la captura.';
    return jsonResponse({ success: false, message }, 400);
  }

  const order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    gameSlug,
    gameName: game.name,
    playerId,
    paymentMethod,
    receiptUrl,
    status: 'pendiente-validacion',
    product,
  };

  orders.push(order);
  await writeFile(ordersFilePath, `${JSON.stringify(orders, null, 2)}\n`, 'utf-8');

  return jsonResponse(
    {
      success: true,
      message: 'Orden creada exitosamente.',
      orderId: order.id,
      receiptUrl,
    },
    201,
  );
};