-- PaymentSplitter統合：商品ごとの分配設定とマルチトークン対応

-- 1. products テーブルに payment_split 列を追加
-- 商品ごとの収益分配設定を保存
ALTER TABLE products
ADD COLUMN payment_split JSONB DEFAULT NULL;

-- payment_split の構造:
-- {
--   "payees": ["0xCreatorAddress", "0xTenantOwner"],
--   "shares": [10, 90],
--   "royalty_source": "EIP2981" | "manual" | "none",
--   "nft_address": "0x..." (optional, for EIP-2981 detection)
-- }

COMMENT ON COLUMN products.payment_split IS '
商品ごとの収益分配設定 (JSONB)
- payees: 受益者アドレスの配列
- shares: 各受益者のシェア（合計値は任意、比率のみ重要）
- royalty_source: ロイヤリティソース ("EIP2981", "manual", "none")
- nft_address: NFTコントラクトアドレス（EIP-2981用、オプショナル）

例:
{
  "payees": ["0x123...", "0x456..."],
  "shares": [10, 90],
  "royalty_source": "EIP2981",
  "nft_address": "0xNFT..."
}

NULL の場合はテナントオーナーへ100%分配
';

-- 2. purchases テーブルに payment_token 列を追加
-- どのトークンで支払われたかを記録（マルチトークン対応）
ALTER TABLE purchases
ADD COLUMN payment_token TEXT DEFAULT NULL;

COMMENT ON COLUMN purchases.payment_token IS '
支払いに使用されたERC20トークンアドレス
- NULL: レガシー購入（tNHTと仮定）
- "0x...": 支払いに使用されたトークンアドレス（JPYC, tNHT, etc.）
';

-- 3. インデックス追加（payment_token での検索用）
CREATE INDEX IF NOT EXISTS idx_purchases_payment_token ON purchases(payment_token);

-- 4. payment_split の妥当性チェック用関数
CREATE OR REPLACE FUNCTION validate_payment_split(split JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  payees_count INTEGER;
  shares_count INTEGER;
BEGIN
  -- NULL は許容（テナントオーナー100%）
  IF split IS NULL THEN
    RETURN TRUE;
  END IF;

  -- payees と shares が配列であることを確認
  IF jsonb_typeof(split->'payees') != 'array' OR
     jsonb_typeof(split->'shares') != 'array' THEN
    RETURN FALSE;
  END IF;

  -- payees と shares の要素数が一致することを確認
  payees_count := jsonb_array_length(split->'payees');
  shares_count := jsonb_array_length(split->'shares');

  IF payees_count != shares_count THEN
    RETURN FALSE;
  END IF;

  -- 最低1人の受益者が必要
  IF payees_count < 1 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. products テーブルに妥当性チェック制約を追加
ALTER TABLE products
ADD CONSTRAINT valid_payment_split
CHECK (validate_payment_split(payment_split));

-- 6. 既存商品のデフォルト設定（NULL = テナントオーナー100%）
-- 既存データはそのまま（payment_split = NULL）

COMMENT ON TABLE products IS '
GIFT HUB 商品情報テーブル
- PaymentSplitter統合により、商品ごとに収益分配設定を保持
- マルチトークン対応（JPYC, tNHT, etc.）
- EIP-2981 NFTロイヤリティ自動検出対応
';
