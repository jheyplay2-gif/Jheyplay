import type { APIRoute } from 'astro';
import { getExchangeRate } from '../../data/store';
import { saveExchangeRate } from '../../data/store';

const jsonHeaders = { 'Content-Type': 'application/json' };

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

export const GET: APIRoute = async () => {
  const rate = await getExchangeRate();

  return jsonResponse({ success: true, rate }, 200);
};

export const PUT: APIRoute = async ({ request }) => {
  let payload: { rate?: unknown };

  try {
    payload = (await request.json()) as { rate?: unknown };
  } catch {
    return jsonResponse({ success: false, message: 'Body JSON invalido.' }, 400);
  }

  const rate = typeof payload.rate === 'number' ? payload.rate : Number.NaN;
  if (!Number.isFinite(rate) || rate <= 0) {
    return jsonResponse({ success: false, message: 'La tasa debe ser un numero mayor que cero.' }, 400);
  }

  await saveExchangeRate(rate);

  return jsonResponse({ success: true, message: 'Tasa actualizada.', rate }, 200);
};