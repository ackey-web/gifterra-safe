# Supabase マイグレーション実行ガイド

## 📋 概要

GIFT HUB 購入システムを Supabase 正本に統一するためのマイグレーションガイドです。

## ✅ 前提条件

- Supabase プロジェクトが作成済み
- 環境変数が設定済み（`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`）
- マイグレーション `001_create_products_and_purchases.sql` が実行済み

## 🔄 マイグレーション手順

### 1. Supabase SQL Editor にアクセス

1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択
3. 左サイドバーから **SQL Editor** を選択

### 2. マイグレーション実行

以下の順番で SQL を実行してください：

#### ステップ 1: `image_url` カラム追加

```sql
-- supabase/migrations/002_add_image_url_to_products.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
COMMENT ON COLUMN products.image_url IS 'Supabase Storage のサムネイル画像パス（例: gh-public/thumbnails/...)';
```

**実行方法:**
1. SQL Editor で新しいクエリを作成
2. 上記 SQL をコピー＆ペースト
3. **Run** ボタンをクリック
4. 成功メッセージを確認

#### ステップ 2: サンプル商品データ投入

```sql
-- supabase/migrations/003_insert_sample_product.sql
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
  '50000000000000000000', -- 50 tNHT
  0,
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
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  '25000000000000000000', -- 25 tNHT
  10,
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
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  '100000000000000000000', -- 100 tNHT
  0,
  false,
  true
) ON CONFLICT DO NOTHING;
```

**実行方法:**
1. SQL Editor で新しいクエリを作成
2. 上記 SQL をコピー＆ペースト
3. **Run** ボタンをクリック
4. 3件のレコードが挿入されたことを確認

### 3. データ確認

```sql
-- 商品一覧を確認
SELECT
  id,
  tenant_id,
  name,
  price_amount_wei,
  stock,
  is_unlimited,
  is_active,
  created_at
FROM products
ORDER BY created_at DESC;
```

**確認ポイント:**
- ✅ 3件のサンプル商品が表示される
- ✅ `image_url` カラムが存在する
- ✅ `is_unlimited` が true/false で設定されている
- ✅ `stock` が適切に設定されている

## 🧪 動作確認

### 1. Supabase 版 GIFT HUB UI を表示

開発サーバーを起動して、以下の URL にアクセス：

```
http://localhost:5174/?tenant=default
```

**注意:** 既存の `App.tsx` ではなく、新しく作成した `AppSupabase.tsx` を使用する必要があります。

`src/main.tsx` を一時的に変更：

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { PolygonAmoyTestnet } from '@thirdweb-dev/chains';
import VendingAppSupabase from './vending-ui/AppSupabase'; // ← 変更
import './index.css';

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThirdwebProvider
      activeChain={PolygonAmoyTestnet}
      clientId={clientId}
    >
      <VendingAppSupabase /> {/* ← 変更 */}
    </ThirdwebProvider>
  </StrictMode>,
);
```

### 2. 表示確認

- ✅ 3つの商品ボタンが表示される（A, B, C）
- ✅ 各ボタンに価格と在庫状態が表示される
  - A: 50 tNHT, ∞ 在庫あり
  - B: 25 tNHT, 在庫: 10
  - C: 100 tNHT, SOLD OUT（グレーアウト）
- ✅ SOLD OUT の商品はクリックできない

### 3. 購入フロー確認（オプション）

**必要なもの:**
- Polygon Amoy Testnet のウォレット
- tNHT トークン残高（テスト用）

**手順:**
1. ウォレット接続
2. 商品 A または B をクリック
3. 購入確認ダイアログで OK
4. MetaMask でトランザクション承認
5. ダウンロードトークンが発行される
6. （注意: 実際のファイルはまだアップロードしていないため、ダウンロードは404になります）

## 📊 Admin API 確認

### GET: 商品一覧取得

```bash
curl "http://localhost:5174/api/admin/products?tenantId=default&isActive=true"
```

**期待される出力:**
```json
{
  "products": [
    {
      "id": "...",
      "tenant_id": "default",
      "name": "ベーシックアバター.glb",
      ...
    },
    ...
  ]
}
```

### POST: 商品作成

```bash
curl -X POST http://localhost:5174/api/admin/products \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default",
    "name": "テスト商品",
    "contentPath": "downloads/default/test.glb",
    "priceToken": "0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea",
    "priceAmountWei": "10000000000000000000",
    "stock": 5,
    "isUnlimited": false,
    "isActive": true
  }'
```

## 🚨 トラブルシューティング

### エラー: "Failed to fetch products"

**原因:** RLS ポリシーまたは環境変数の問題

**解決策:**
1. Supabase Dashboard → Authentication → Policies で RLS を確認
2. 環境変数 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` が正しく設定されているか確認

### エラー: "CORS error"

**原因:** API Base URL の設定ミス

**解決策:**
```bash
# .env
VITE_API_BASE_URL=http://localhost:5174
```

### エラー: "Product not found"

**原因:** Supabase にデータが投入されていない

**解決策:**
マイグレーション `003_insert_sample_product.sql` を再実行

## 📝 次のステップ

1. ✅ マイグレーション実行完了
2. ✅ サンプル商品の表示確認
3. ⏳ **VendingDashboard の Supabase 統合**（次の作業）
4. ⏳ 実際のファイルを Supabase Storage へアップロード
5. ⏳ End-to-End 購入フローのテスト

## 🔗 関連ファイル

- API: `api/admin/products/index.ts`, `api/admin/products/[id].ts`
- フロント: `src/vending-ui/AppSupabase.tsx`
- Hook: `src/hooks/useSupabaseProducts.ts`
- クライアント: `src/lib/adminApi.ts`
