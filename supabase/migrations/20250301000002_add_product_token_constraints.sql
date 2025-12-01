-- ========================================
-- トークン種別による商品分離制約
-- ========================================
-- 目的: NHT HUBとJPYC HUBで同一商品が登録されることを防ぐ
--
-- 実装内容:
-- 1. products.accepted_token カラム追加
-- 2. HUBのトークンと商品のトークンが一致するかチェックするトリガー
-- 3. 既存データへのaccepted_token設定
-- ========================================

-- ========================================
-- 1. products テーブルに accepted_token カラムを追加
-- ========================================

DO $$
BEGIN
  -- accepted_token カラムを追加（存在しない場合のみ）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'accepted_token'
  ) THEN
    ALTER TABLE products ADD COLUMN accepted_token TEXT;
    RAISE NOTICE 'Added accepted_token column to products';
  ELSE
    RAISE NOTICE 'Column accepted_token already exists in products';
  END IF;

  -- インデックス作成（検索パフォーマンス向上）
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND indexname = 'idx_products_accepted_token'
  ) THEN
    CREATE INDEX idx_products_accepted_token ON products(accepted_token);
    RAISE NOTICE 'Created index idx_products_accepted_token';
  ELSE
    RAISE NOTICE 'Index idx_products_accepted_token already exists';
  END IF;
END $$;

-- カラムにコメント追加
COMMENT ON COLUMN products.accepted_token IS 'Token type this product accepts (NHT or JPYC). Must match the HUB accepted token.';

-- ========================================
-- 2. HUBのトークンと商品のトークンが一致するかチェックする関数
-- ========================================

CREATE OR REPLACE FUNCTION check_product_token_match()
RETURNS TRIGGER AS $$
DECLARE
  v_hub_token TEXT;
BEGIN
  -- hub_idが設定されている場合のみチェック
  IF NEW.hub_id IS NOT NULL THEN
    -- HUBの受け入れトークンを取得
    SELECT settings->>'acceptedToken'
    INTO v_hub_token
    FROM vending_machines
    WHERE id = NEW.hub_id;

    -- HUBが見つからない場合
    IF v_hub_token IS NULL THEN
      RAISE EXCEPTION 'HUB with id % not found', NEW.hub_id;
    END IF;

    -- 商品のaccepted_tokenが設定されていない場合、HUBのトークンを自動設定
    IF NEW.accepted_token IS NULL THEN
      NEW.accepted_token := v_hub_token;
      RAISE NOTICE 'Auto-set product accepted_token to % (from HUB)', v_hub_token;
    END IF;

    -- 商品のトークンとHUBのトークンが一致しない場合はエラー
    IF NEW.accepted_token != v_hub_token THEN
      RAISE EXCEPTION 'Product token (%) does not match HUB accepted token (%). Cannot assign % product to % HUB.',
        NEW.accepted_token, v_hub_token, NEW.accepted_token, v_hub_token;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_product_token_match IS 'Ensures product accepted_token matches HUB accepted token';

-- ========================================
-- 3. トリガーを設定
-- ========================================

DO $$
BEGIN
  -- 既存のトリガーを削除（存在する場合）
  DROP TRIGGER IF EXISTS trigger_check_product_token_match ON products;

  -- トリガーを作成
  CREATE TRIGGER trigger_check_product_token_match
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION check_product_token_match();

  RAISE NOTICE 'Created trigger trigger_check_product_token_match';
END $$;

-- ========================================
-- 4. 既存データへの accepted_token 設定
-- ========================================

-- hub_idが設定されている商品に対して、HUBのacceptedTokenを設定
UPDATE products p
SET accepted_token = vm.settings->>'acceptedToken'
FROM vending_machines vm
WHERE p.hub_id = vm.id
  AND p.accepted_token IS NULL
  AND vm.settings->>'acceptedToken' IS NOT NULL;

-- ========================================
-- 5. 商品の重複チェック用ビュー
-- ========================================

CREATE OR REPLACE VIEW v_product_token_conflicts AS
SELECT
  p1.id as product1_id,
  p1.name as product_name,
  p1.image_url,
  p1.accepted_token as token1,
  p1.hub_id as hub1_id,
  vm1.name as hub1_name,
  p2.id as product2_id,
  p2.accepted_token as token2,
  p2.hub_id as hub2_id,
  vm2.name as hub2_name
FROM products p1
JOIN products p2 ON (
  p1.name = p2.name
  AND p1.image_url = p2.image_url
  AND p1.id < p2.id  -- 重複を避けるため
  AND p1.accepted_token != p2.accepted_token  -- 異なるトークン
)
LEFT JOIN vending_machines vm1 ON p1.hub_id = vm1.id
LEFT JOIN vending_machines vm2 ON p2.hub_id = vm2.id
WHERE p1.is_active = true AND p2.is_active = true;

COMMENT ON VIEW v_product_token_conflicts IS 'Shows products that exist in both NHT and JPYC HUBs (potential conflicts)';

-- ========================================
-- 6. 検証用クエリ
-- ========================================

-- 実行例:
-- SELECT * FROM v_product_token_conflicts;
-- （重複商品がある場合は手動で対応が必要）

-- ========================================
-- 完了メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Product token constraints migration completed';
  RAISE NOTICE 'Check for conflicts: SELECT * FROM v_product_token_conflicts;';
END $$;
