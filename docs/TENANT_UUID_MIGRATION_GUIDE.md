# テナントUUIDマイグレーションガイド

## 📋 概要

このガイドでは、GIFT HUBシステムにおける`tenant_id` (TEXT型)から`tenant_uuid` (UUID型)への移行について説明します。

## 🎯 目的

### 移行前の問題

1. **データの不整合**
   - `tenant_id`が3種類の値（`"default"`, `"machine-xxx"`, UUID文字列）で混在
   - テナントとGIFT HUB/商品の関連付けができない
   - ランクプランチェックが正しく動作しない

2. **テナント分離の欠如**
   - 複数テナントの商品が混在
   - テナントごとの統計・分析が困難

3. **パフォーマンス問題**
   - TEXT型での検索が非効率
   - インデックスの効果が低い

### 移行後のメリット

1. **正しいデータモデル**
   - UUID型による一貫した識別子
   - テナントとGIFT HUB/商品の正確な関連付け

2. **テナント分離の実現**
   - テナントごとのデータ管理
   - 正確な統計・分析

3. **パフォーマンス向上**
   - UUID型インデックスによる高速検索
   - 効率的なクエリ実行

## 🗄️ データベース変更

### 変更されるテーブル

#### 1. `vending_machines` テーブル

```sql
-- 追加されるカラム
tenant_uuid UUID  -- テナントUUID（tenant_applications.tenant_idから）

-- 既存カラム（非推奨化）
tenant_id TEXT   -- 後方互換性のため保持
```

#### 2. `products` テーブル

```sql
-- 追加されるカラム
tenant_uuid UUID  -- テナントUUID
hub_id UUID       -- GIFT HUB UUID（vending_machines.idへの参照）

-- 既存カラム（非推奨化）
tenant_id TEXT    -- 後方互換性のため保持
```

## 🚀 マイグレーション手順

### Step 1: マイグレーション実行

```bash
# Supabaseダッシュボード > SQL Editor で実行
# または
npx supabase db push
```

マイグレーションファイル: `supabase/migrations/20250301000000_add_tenant_uuid_columns.sql`

### Step 2: データ確認

```sql
-- マイグレーション状況を確認
SELECT * FROM v_migration_status;

-- 出力例:
-- table_name        | total_rows | migrated_rows | pending_rows | migration_percentage
-- -----------------|------------|---------------|--------------|--------------------
-- vending_machines |         10 |             7 |            3 |                70.00
-- products         |        100 |            85 |           15 |                85.00
```

### Step 3: 既存データの手動マイグレーション（必要に応じて）

LocalStorageから作成された古いGIFT HUBのデータを移行:

```sql
-- 例: machine-1234567890 を特定のテナントに紐付け
UPDATE vending_machines
SET tenant_uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
WHERE id = 'machine-1234567890'
  AND tenant_uuid IS NULL;

-- 関連する商品も更新
UPDATE products
SET
  tenant_uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  hub_id = 'machine-1234567890'::uuid
WHERE tenant_id = 'machine-1234567890'
  AND tenant_uuid IS NULL;
```

## 💻 アプリケーション変更

### TypeScript型定義の更新

```typescript
// src/types/vending.ts
export interface VendingMachine {
  // ... 既存フィールド

  // 新規追加
  tenantUuid?: string | null;  // 優先使用

  // 非推奨
  /** @deprecated Use tenantUuid instead */
  tenantId?: string;
}
```

### コード例

#### ✅ 正しい使用方法（推奨）

```typescript
// GIFT HUB作成時
const newMachine: VendingMachine = {
  id: crypto.randomUUID(),
  tenantUuid: tenant.id,  // ✅ UUID使用
  // ...
};

// ランクプランチェック
const { plan } = useTenantRankPlan(tenant.id);
const hubCount = machines.filter(m => m.tenantUuid === tenant.id).length;
canCreateHub(hubCount, plan);
```

#### ❌ 避けるべき使用方法

```typescript
// ハードコード（NG）
const DEMO_TENANT_ID = 1;
useTenantRankPlan(DEMO_TENANT_ID);

// machine.idをtenantIdとして使用（NG）
const tenantId = machine.id;
```

## 🔍 ヘルパー関数

マイグレーション後、以下の関数が利用可能です:

### 1. テナントのGIFT HUB数を取得

```sql
SELECT get_tenant_hub_count('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
-- 出力: 3
```

### 2. テナントの全商品を取得

```sql
SELECT * FROM get_tenant_products('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
-- テナントに属する全商品を返す
```

### 3. HUB商品一覧を取得（テナント情報付き）

```sql
SELECT * FROM v_hub_products_with_tenant
WHERE tenant_uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

## 🧪 テスト方法

### 1. マイグレーション確認

```sql
-- 全データがマイグレーション済みか確認
SELECT * FROM v_migration_status;

-- 100%になっていればOK
```

### 2. データ整合性チェック

```sql
-- tenant_uuid が NULL のレコードを確認
SELECT id, slug, tenant_id, tenant_uuid
FROM vending_machines
WHERE tenant_uuid IS NULL;

-- 孤立した商品（tenant_uuid も hub_id も NULL）
SELECT id, name, tenant_id
FROM products
WHERE tenant_uuid IS NULL AND hub_id IS NULL;
```

### 3. アプリケーションテスト

- [ ] GIFT HUB新規作成 → `tenantUuid`が設定されているか確認
- [ ] 商品追加 → `tenant_uuid`と`hub_id`が正しく設定されているか確認
- [ ] ランクプラン制限 → 正しくテナントのHUB数がカウントされているか確認
- [ ] テナント切り替え → 他のテナントの商品が表示されないか確認

## 📊 モニタリング

### ログ確認ポイント

```typescript
// VendingDashboardNew.tsx のコンソールログ
🎯 [VendingDashboard] Rank Plan Check:
  tenantId: "a1b2c3d4-e5f6-..."  ✅ UUID形式
  plan: { rank_plan: "STUDIO_PRO_MAX", ... }
  maxHubs: 10

// HubDetailPanelNew.tsx のコンソールログ
🛒 [HubDetail] Product Query:
  tenantId: "a1b2c3d4-e5f6-..."  ✅ UUID形式（tenant_uuidから取得）
```

## 🚨 トラブルシューティング

### 問題1: ランクプラン制限が効かない

**症状**: STUDIO_PRO_MAXなのにGIFT HUBを1個しか作れない

**原因**: `tenant_uuid`が設定されていない

**解決**:
```sql
-- 該当するGIFT HUBを確認
SELECT id, tenant_id, tenant_uuid FROM vending_machines WHERE id = '問題のHUB ID';

-- tenant_uuidを設定
UPDATE vending_machines
SET tenant_uuid = '正しいテナントUUID'
WHERE id = '問題のHUB ID';
```

### 問題2: 商品が表示されない

**症状**: GIFT HUBに商品を追加したのに表示されない

**原因**: `tenant_id`と`hub_id`の不一致

**解決**:
```sql
-- 商品のtenant_idとhub_idを確認
SELECT id, name, tenant_id, tenant_uuid, hub_id FROM products WHERE id = '商品ID';

-- 修正
UPDATE products
SET
  tenant_uuid = vm.tenant_uuid,
  hub_id = vm.id
FROM vending_machines vm
WHERE products.id = '商品ID'
  AND vm.id = '正しいHUB ID';
```

### 問題3: 古いLocalStorageデータが残っている

**症状**: リロード後、古いGIFT HUBデータが表示される

**解決**:
```javascript
// ブラウザコンソールで実行
localStorage.removeItem('vending_machines_data');
location.reload();
```

## 📝 チェックリスト

- [ ] マイグレーションSQL実行完了
- [ ] `v_migration_status`で100%確認
- [ ] 既存データの`tenant_uuid`設定完了
- [ ] アプリケーションコードで`tenantUuid`使用
- [ ] ランクプラン制限の動作確認
- [ ] 商品表示の確認
- [ ] テナント分離の確認
- [ ] LocalStorageデータのクリア（必要に応じて）

## 🔄 ロールバック手順

万が一問題が発生した場合:

```sql
-- 1. 新しいカラムを削除（データ損失注意！）
ALTER TABLE vending_machines DROP COLUMN IF EXISTS tenant_uuid;
ALTER TABLE products DROP COLUMN IF EXISTS tenant_uuid;
ALTER TABLE products DROP COLUMN IF EXISTS hub_id;

-- 2. ビューと関数を削除
DROP VIEW IF EXISTS v_hub_products_with_tenant;
DROP VIEW IF EXISTS v_migration_status;
DROP FUNCTION IF EXISTS get_tenant_hub_count;
DROP FUNCTION IF EXISTS get_tenant_products;
```

**注意**: ロールバック後は、アプリケーションコードも元に戻す必要があります。

## 📚 関連ドキュメント

- [Supabase Migration Guide](../SUPABASE_MIGRATION_GUIDE.md)
- [Tenant Application System](./TENANT-APPLICATION-SYSTEM.md)
- [GIFT HUB Architecture](./GIFT-HUB-ARCHITECTURE.md)

## 🙋 サポート

問題が発生した場合は、以下の情報を添えてお問い合わせください:

1. `SELECT * FROM v_migration_status;` の結果
2. エラーログ（コンソール、Supabaseログ）
3. 問題の再現手順
