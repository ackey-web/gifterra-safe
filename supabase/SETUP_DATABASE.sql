-- ==========================================
-- GIFTERRA Database Setup Script
-- ==========================================
-- This script sets up all tables, relationships, and functions
-- Run this in Supabase Dashboard > SQL Editor
-- ==========================================

-- ==========================================
-- 1. PRODUCTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  content_path TEXT NOT NULL,
  price_token TEXT NOT NULL DEFAULT '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  price_amount_wei TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- ==========================================
-- 2. PURCHASES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  amount_wei TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer);
CREATE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);

-- ==========================================
-- 3. DOWNLOAD_TOKENS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer TEXT NOT NULL,
  is_consumed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_purchase_id ON download_tokens(purchase_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_buyer ON download_tokens(buyer);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires_at ON download_tokens(expires_at);

-- ==========================================
-- 4. RLS POLICIES
-- ==========================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read active products" ON products;
DROP POLICY IF EXISTS "Service role can insert products" ON products;
DROP POLICY IF EXISTS "Service role can update products" ON products;
DROP POLICY IF EXISTS "Service role can delete products" ON products;
DROP POLICY IF EXISTS "Users can read their own purchases" ON purchases;
DROP POLICY IF EXISTS "Service role can insert purchases" ON purchases;
DROP POLICY IF EXISTS "Service role full access purchases" ON purchases;
DROP POLICY IF EXISTS "download_tokens: Service Role Full Access" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens: Buyers can read their own tokens" ON download_tokens;

-- Products policies
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role full access products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Purchases policies
CREATE POLICY "Service role full access purchases"
  ON purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Download tokens policies
CREATE POLICY "Service role full access download_tokens"
  ON download_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 5. TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 6. RPC FUNCTIONS
-- ==========================================

-- Decrement stock function
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID)
RETURNS TABLE(success BOOLEAN, remaining_stock INTEGER) AS $$
DECLARE
  v_is_unlimited BOOLEAN;
  v_current_stock INTEGER;
BEGIN
  SELECT is_unlimited, stock INTO v_is_unlimited, v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_is_unlimited THEN
    RETURN QUERY SELECT true, -1;
    RETURN;
  END IF;

  IF v_current_stock <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  UPDATE products
  SET stock = stock - 1
  WHERE id = p_product_id;

  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  RETURN QUERY SELECT true, v_current_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create download token function
CREATE OR REPLACE FUNCTION create_download_token(
  p_purchase_id UUID,
  p_product_id UUID,
  p_ttl_seconds INTEGER DEFAULT 900
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_buyer TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT buyer INTO v_buyer
  FROM purchases
  WHERE id = p_purchase_id;

  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Purchase not found: %', p_purchase_id;
  END IF;

  v_token := gen_random_uuid()::TEXT;
  v_expires_at := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;

  INSERT INTO download_tokens (
    token,
    purchase_id,
    product_id,
    buyer,
    expires_at
  ) VALUES (
    v_token,
    p_purchase_id,
    p_product_id,
    v_buyer,
    v_expires_at
  );

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consume download token function
CREATE OR REPLACE FUNCTION consume_download_token(p_token TEXT)
RETURNS TABLE(product_id UUID, buyer TEXT) AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM download_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;

  IF v_token_record.is_consumed THEN
    RAISE EXCEPTION 'Token already consumed';
  END IF;

  IF v_token_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'Token expired';
  END IF;

  UPDATE download_tokens
  SET
    is_consumed = true,
    consumed_at = NOW()
  WHERE token = p_token;

  RETURN QUERY
  SELECT v_token_record.product_id, v_token_record.buyer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired tokens function
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM download_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user purchases function
CREATE OR REPLACE FUNCTION get_user_purchases(p_buyer TEXT)
RETURNS TABLE(
  purchase_id UUID,
  product_id UUID,
  product_name TEXT,
  purchased_at TIMESTAMPTZ,
  has_valid_token BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS purchase_id,
    pr.id AS product_id,
    pr.name AS product_name,
    p.created_at AS purchased_at,
    EXISTS(
      SELECT 1
      FROM download_tokens dt
      WHERE dt.purchase_id = p.id
        AND dt.is_consumed = false
        AND dt.expires_at > NOW()
    ) AS has_valid_token
  FROM purchases p
  INNER JOIN products pr ON p.product_id = pr.id
  WHERE p.buyer = p_buyer
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- SETUP COMPLETE
-- ==========================================
-- Next steps:
-- 1. Verify tables exist: Check in Supabase Dashboard > Table Editor
-- 2. Verify RPC functions: Check in Supabase Dashboard > Database > Functions
-- 3. Test claim history API
-- ==========================================
