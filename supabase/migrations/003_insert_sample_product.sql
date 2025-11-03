-- サンプル商品データの投入（テスト用）
-- 実行前に Supabase SQL Editor で 002_add_image_url_to_products.sql を実行してください

-- サンプル商品1: 在庫無制限のGLBファイル
INSERT INTO products (
  tenant_id,
  name,
  description,
  content_path,
  image_url,
  price_token,
  price_amount_wei,
  stock,
  is_unlimited,
  is_active
) VALUES (
  'default',
  'ベーシックアバター.glb',
  '初心者向けの3Dアバターモデル',
  'downloads/default/avatar-basic-001.glb',
  'https://via.placeholder.com/300x300.png?text=Avatar',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea', -- tNHT
  '50000000000000000000', -- 50 tNHT (50 * 10^18)
  0, -- is_unlimited=true の場合、stockは無視される
  true,
  true
) ON CONFLICT DO NOTHING;

-- サンプル商品2: 在庫制限ありのMP3ファイル
INSERT INTO products (
  tenant_id,
  name,
  description,
  content_path,
  image_url,
  price_token,
  price_amount_wei,
  stock,
  is_unlimited,
  is_active
) VALUES (
  'default',
  'ウェルカムサウンド.mp3',
  'ギフテラへようこそのBGM',
  'downloads/default/welcome-sound-001.mp3',
  'https://via.placeholder.com/300x300.png?text=Music',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea', -- tNHT
  '25000000000000000000', -- 25 tNHT
  10, -- 在庫10個
  false,
  true
) ON CONFLICT DO NOTHING;

-- サンプル商品3: SOLD OUT状態の商品
INSERT INTO products (
  tenant_id,
  name,
  description,
  content_path,
  image_url,
  price_token,
  price_amount_wei,
  stock,
  is_unlimited,
  is_active
) VALUES (
  'default',
  '限定アート作品.glb',
  '著名アーティストの3D作品（完売）',
  'downloads/default/art-glb-001.glb',
  'https://via.placeholder.com/300x300.png?text=SOLD+OUT',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea', -- tNHT
  '100000000000000000000', -- 100 tNHT
  0, -- 在庫0 = SOLD OUT
  false,
  true
) ON CONFLICT DO NOTHING;
