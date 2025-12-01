# テナントUUIDマイグレーション - 手動実行手順

## エラーの原因

Supabase SQL Editorでファイル全体を実行すると、PostgreSQLのパーサーが誤検知してエラーになります。
そのため、以下のステップを**1つずつ順番に**実行してください。

---

## Step 1: vending_machines テーブルへのカラム追加

以下のSQLを実行:

```sql
-- vending_machines に tenant_uuid を追加
ALTER TABLE vending_machines ADD COLUMN IF NOT EXISTS tenant_uuid UUID;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_vending_machines_tenant_uuid
ON vending_machines(tenant_uuid);

-- コメント追加
COMMENT ON COLUMN vending_machines.tenant_id IS 'DEPRECATED: Use tenant_uuid instead. Legacy TEXT column for backward compatibility.';
COMMENT ON COLUMN vending_machines.tenant_uuid IS 'Tenant UUID from tenant_applications.tenant_id. NULL for legacy data.';
```

✅ 成功したら次へ

---

## Step 2: products テーブルへのカラム追加

以下のSQLを実行:

```sql
-- products に tenant_uuid を追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_uuid UUID;

-- products に hub_id を追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS hub_id UUID;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_products_tenant_uuid ON products(tenant_uuid);
CREATE INDEX IF NOT EXISTS idx_products_hub_id ON products(hub_id);

-- コメント追加
COMMENT ON COLUMN products.tenant_id IS 'DEPRECATED: Use tenant_uuid instead. Legacy TEXT column containing machine ID or tenant UUID as text.';
COMMENT ON COLUMN products.tenant_uuid IS 'Tenant UUID from tenant_applications.tenant_id. Links products to tenants.';
COMMENT ON COLUMN products.hub_id IS 'GIFT HUB UUID from vending_machines.id. Links products to specific hubs.';
```

✅ 成功したら次へ

---

## Step 3: 外部キー制約の追加

以下のSQLを実行:

```sql
-- 外部キー制約追加
DO $$
BEGIN
    ALTER TABLE products
    ADD CONSTRAINT products_hub_id_fkey
    FOREIGN KEY (hub_id) REFERENCES vending_machines(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- 既に存在する場合は無視
END $$;
```

✅ 成功したら次へ

---

## Step 4: 既存データのマイグレーション

以下のSQLを実行:

```sql
-- vending_machines: tenant_id が UUID 形式の場合は tenant_uuid にコピー
UPDATE vending_machines
SET tenant_uuid = tenant_id::uuid
WHERE tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND tenant_uuid IS NULL;

-- products: tenant_id が UUID 形式の場合は tenant_uuid にコピー
UPDATE products
SET tenant_uuid = tenant_id::uuid
WHERE tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND tenant_uuid IS NULL;

-- products: tenant_id が vending_machines.id と一致する場合は hub_id を設定
UPDATE products p
SET
  hub_id = vm.id,
  tenant_uuid = vm.tenant_uuid
FROM vending_machines vm
WHERE p.tenant_id = vm.id::text
  AND p.hub_id IS NULL
  AND vm.tenant_uuid IS NOT NULL;
```

✅ 成功したら次へ

---

## Step 5: ビューの作成

以下のSQLを実行:

```sql
CREATE OR REPLACE VIEW v_hub_products_with_tenant AS
SELECT
  p.*,
  vm.tenant_uuid,
  vm.slug as hub_slug,
  vm.name as hub_name,
  CASE
    WHEN p.category = 'common_catalog' THEN 'common'
    WHEN p.hub_id IS NOT NULL THEN 'hub_specific'
    ELSE 'legacy'
  END as product_source
FROM products p
LEFT JOIN vending_machines vm ON p.hub_id = vm.id
WHERE p.is_active = true;

COMMENT ON VIEW v_hub_products_with_tenant IS 'Products with tenant UUID and hub information for proper tenant isolation';
```

✅ 成功したら次へ

---

## Step 6: ヘルパー関数の作成

以下のSQLを実行:

```sql
-- テナントのGIFT HUB数取得
CREATE OR REPLACE FUNCTION get_tenant_hub_count(p_tenant_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM vending_machines
  WHERE tenant_uuid = p_tenant_uuid
    AND is_active = true;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_hub_count IS 'Get active GIFT HUB count for a tenant by UUID';

-- テナントの全商品取得
CREATE OR REPLACE FUNCTION get_tenant_products(p_tenant_uuid UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  hub_id UUID,
  hub_name TEXT,
  price_token TEXT,
  price_amount_wei TEXT,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name as product_name,
    p.hub_id,
    vm.name as hub_name,
    p.price_token,
    p.price_amount_wei,
    p.category
  FROM products p
  LEFT JOIN vending_machines vm ON p.hub_id = vm.id
  WHERE p.tenant_uuid = p_tenant_uuid
    AND p.is_active = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_products IS 'Get all active products for a tenant by UUID';
```

✅ 成功したら次へ

---

## Step 7: マイグレーション検証ビューの作成

以下のSQLを実行:

```sql
CREATE OR REPLACE VIEW v_migration_status AS
SELECT
  'vending_machines' as table_name,
  COUNT(*) as total_rows,
  COUNT(tenant_uuid) as migrated_rows,
  COUNT(*) - COUNT(tenant_uuid) as pending_rows,
  ROUND(100.0 * COUNT(tenant_uuid) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM vending_machines
UNION ALL
SELECT
  'products' as table_name,
  COUNT(*) as total_rows,
  COUNT(tenant_uuid) as migrated_rows,
  COUNT(*) - COUNT(tenant_uuid) as pending_rows,
  ROUND(100.0 * COUNT(tenant_uuid) / NULLIF(COUNT(*), 0), 2) as migration_percentage
FROM products;

COMMENT ON VIEW v_migration_status IS 'Check migration progress from tenant_id (TEXT) to tenant_uuid (UUID)';
```

✅ 成功したら次へ

---

## Step 8: 確認

以下のSQLを実行して、マイグレーションが成功したか確認:

```sql
SELECT * FROM v_migration_status;
```

**期待される結果**:
| table_name | total_rows | migrated_rows | pending_rows | migration_percentage |
|------------|------------|---------------|--------------|---------------------|
| vending_machines | X | X | 0 | 100.00 |
| products | Y | Y | 0 | 100.00 |

---

## トラブルシューティング

### Step 1 で "column already exists" エラーが出る場合

すでに追加されています。次のステップに進んでください。

### Step 2 で "column already exists" エラーが出る場合

すでに追加されています。次のステップに進んでください。

### Step 3 で "constraint already exists" エラーが出る場合

すでに追加されています。次のステップに進んでください。

### migration_percentage が 100% にならない場合

既存データに `tenant_id` が UUID 形式でないデータがあります。
手動でテナントを割り当てる必要があります。

---

## 完了

全ステップが完了したら、アプリケーションで GIFT HUB の作成とランクプラン制限が正しく動作することを確認してください。
