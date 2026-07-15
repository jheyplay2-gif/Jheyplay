import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { games, type Game, type GameProduct } from './games';

export interface ProductOverride {
  gameSlug: string;
  productLabel: string;
  usd: number;
  stock?: number;
  active: boolean;
  deleted?: boolean;
  bs?: number;
}

export interface GameOverride {
  gameSlug: string;
  image?: string;
  name?: string;
  description?: string;
  custom?: boolean;
  deleted?: boolean;
}

interface ExchangeRateConfig {
  rate: number;
}

const productsOverridePath = join(process.cwd(), 'data', 'products-override.json');
const gamesOverridePath = join(process.cwd(), 'data', 'games-override.json');
const exchangeRatePath = join(process.cwd(), 'data', 'exchange-rate.json');
const DEFAULT_EXCHANGE_RATE = 700;
const DEFAULT_GAME_IMAGE = '/games/default-game-cover.svg';

const parseProductsOverride = async (): Promise<ProductOverride[]> => {
  try {
    const content = await readFile(productsOverridePath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is ProductOverride => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const value = item as Record<string, unknown>;
      return (
        typeof value.gameSlug === 'string' &&
        typeof value.productLabel === 'string' &&
        typeof value.usd === 'number' &&
        Number.isFinite(value.usd) &&
        (typeof value.bs === 'undefined' || (typeof value.bs === 'number' && Number.isFinite(value.bs))) &&
        (typeof value.stock === 'undefined' || (typeof value.stock === 'number' && Number.isInteger(value.stock))) &&
        typeof value.active === 'boolean' &&
        (typeof value.deleted === 'undefined' || typeof value.deleted === 'boolean')
      );
    });
  } catch {
    return [];
  }
};

const parseGamesOverride = async (): Promise<GameOverride[]> => {
  try {
    const content = await readFile(gamesOverridePath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is GameOverride => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const value = item as Record<string, unknown>;
      if (typeof value.gameSlug !== 'string' || value.gameSlug.trim().length === 0) {
        return false;
      }

      if (typeof value.image !== 'undefined' && (typeof value.image !== 'string' || value.image.trim().length === 0)) {
        return false;
      }

      if (typeof value.name !== 'undefined' && (typeof value.name !== 'string' || value.name.trim().length === 0)) {
        return false;
      }

      if (
        typeof value.description !== 'undefined' &&
        (typeof value.description !== 'string' || value.description.trim().length === 0)
      ) {
        return false;
      }

      return (
        (typeof value.deleted === 'undefined' || typeof value.deleted === 'boolean') &&
        (typeof value.custom === 'undefined' || typeof value.custom === 'boolean')
      );
    });
  } catch {
    return [];
  }
};

export const getProductsOverrideFilePath = () => productsOverridePath;
export const getGamesOverrideFilePath = () => gamesOverridePath;
export const getExchangeRateFilePath = () => exchangeRatePath;

export const getExchangeRate = async (): Promise<number> => {
  try {
    const content = await readFile(exchangeRatePath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ExchangeRateConfig>;

    if (typeof parsed.rate === 'number' && Number.isFinite(parsed.rate) && parsed.rate > 0) {
      return parsed.rate;
    }
  } catch {
    return DEFAULT_EXCHANGE_RATE;
  }

  return DEFAULT_EXCHANGE_RATE;
};

const calculateBs = (usd: number, exchangeRate: number) => Math.round(usd * exchangeRate * 100) / 100;

export const getMergedGames = async () => {
  const [overrides, gameOverrides] = await Promise.all([parseProductsOverride(), parseGamesOverride()]);
  const exchangeRate = await getExchangeRate();

  interface MutableMergedGame {
    slug: string;
    name: string;
    image: string;
    description: string;
    productMap: Map<string, GameProduct & { stock: number; active: boolean }>;
  }

  const gameMap = new Map<string, MutableMergedGame>();

  for (const game of games) {
    const productMap = new Map<string, GameProduct & { stock: number; active: boolean }>();

    for (const product of game.products) {
      productMap.set(product.label, {
        ...product,
        bs: calculateBs(product.usd, exchangeRate),
        stock: 0,
        active: true,
      });
    }

    gameMap.set(game.slug, {
      slug: game.slug,
      name: game.name,
      image: game.image,
      description: game.description,
      productMap,
    });
  }

  for (const gameOverride of gameOverrides) {
    const slug = gameOverride.gameSlug;
    const existingGame = gameMap.get(slug);

    if (gameOverride.deleted) {
      gameMap.delete(slug);
      continue;
    }

    if (existingGame) {
      if (typeof gameOverride.name === 'string') {
        existingGame.name = gameOverride.name;
      }

      if (typeof gameOverride.description === 'string') {
        existingGame.description = gameOverride.description;
      }

      if (typeof gameOverride.image === 'string') {
        existingGame.image = gameOverride.image;
      }

      continue;
    }

    if (!gameOverride.custom || typeof gameOverride.name !== 'string' || typeof gameOverride.description !== 'string') {
      continue;
    }

    gameMap.set(slug, {
      slug,
      name: gameOverride.name,
      description: gameOverride.description,
      image: gameOverride.image ?? DEFAULT_GAME_IMAGE,
      productMap: new Map<string, GameProduct & { stock: number; active: boolean }>(),
    });
  }

  for (const override of overrides) {
    const game = gameMap.get(override.gameSlug);
    if (!game) {
      continue;
    }

    if (override.deleted) {
      game.productMap.delete(override.productLabel);
      continue;
    }

    game.productMap.set(override.productLabel, {
      label: override.productLabel,
      usd: override.usd,
      bs: calculateBs(override.usd, exchangeRate),
      stock: typeof override.stock === 'number' ? override.stock : 0,
      active: override.active,
    });
  }

  const mergedGames = Array.from(gameMap.values()).map((game) => ({
    slug: game.slug,
    name: game.name,
    image: game.image,
    description: game.description,
    products: Array.from(game.productMap.values()),
  }));

  return { mergedGames, overrides, exchangeRate, gameOverrides };
};

export type MergedGame = Omit<Game, 'products'> & {
  products: Array<GameProduct & { stock: number; active: boolean }>;
};
