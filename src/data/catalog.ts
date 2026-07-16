import { games, type Game, type GameProduct } from './games';
import { getExchangeRate, listGameOverrides, listProductOverrides } from './store';

export type { GameOverride, ProductOverride } from './store';

const DEFAULT_GAME_IMAGE = '/games/default-game-cover.svg';

const calculateBs = (usd: number, exchangeRate: number) => Math.round(usd * exchangeRate * 100) / 100;

export const getMergedGames = async () => {
  const [overrides, gameOverrides] = await Promise.all([listProductOverrides(), listGameOverrides()]);
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
