CREATE TABLE IF NOT EXISTS exchange_rates (
  id smallint PRIMARY KEY CHECK (id = 1),
  rate numeric(12, 2) NOT NULL CHECK (rate > 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO exchange_rates (id, rate)
VALUES (1, 700)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS game_overrides (
  game_slug text PRIMARY KEY,
  image text,
  name text,
  description text,
  custom boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_overrides (
  game_slug text NOT NULL,
  product_label text NOT NULL,
  usd numeric(12, 2) NOT NULL CHECK (usd >= 0),
  stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  deleted boolean NOT NULL DEFAULT false,
  bs numeric(12, 2),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_slug, product_label)
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  game_slug text NOT NULL,
  game_name text NOT NULL,
  player_id text NOT NULL,
  payment_method text NOT NULL,
  receipt_url text NOT NULL,
  status text NOT NULL,
  product_label text NOT NULL,
  product_usd numeric(12, 2) NOT NULL,
  product_bs numeric(12, 2) NOT NULL,
  product_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_game_slug ON orders (game_slug);
CREATE INDEX IF NOT EXISTS idx_product_overrides_game_slug ON product_overrides (game_slug);
CREATE INDEX IF NOT EXISTS idx_game_overrides_deleted ON game_overrides (deleted);