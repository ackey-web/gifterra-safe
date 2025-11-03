# 🚀 GIFT HUB Supabase 統合 - クイックスタートガイド

## ✅ 完成した機能

### 1. **Admin API（Vercel Serverless Functions）**
- `GET /api/admin/products` - 商品一覧取得
- `POST /api/admin/products` - 商品作成/更新（楽観ロック付き）
- `PUT /api/admin/products/:id` - 商品更新
- `DELETE /api/admin/products/:id` - 論理削除（is_active=false）

### 2. **商品管理画面（Supabase 正本版）**
- ✅ Supabase から商品データをリアルタイム取得
- ✅ 新規商品追加・編集・削除
- ✅ 画像・ファイルアップロード（Supabase Storage）
- ✅ 在庫管理（無制限/制限あり）
- ✅ ドラフト機能（localStorage で一時保存）
- ✅ 楽観ロックによる競合検知

### 3. **購入UI（Supabase 正本版）**
- ✅ Supabase から商品一覧を表示
- ✅ 在庫状態表示（∞ / 在庫数 / SOLD OUT）
- ✅ 購入フロー統合（投げ銭 → API呼び出し → ダウンロードトークン）
- ✅ SOLD OUT 商品の無効化

---

## 📝 ステップ1: Supabase マイグレーション実行

### 1-1. image_url カラム追加

Supabase Dashboard → SQL Editor で以下を実行：

```sql
-- 002_add_image_url_to_products.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
COMMENT ON COLUMN products.image_url IS 'Supabase Storage のサムネイル画像パス';
```

### 1-2. サンプル商品データ投入

```sql
-- 003_insert_sample_product.sql
-- サンプル商品1: 在庫無制限
INSERT INTO products (
  tenant_id, name, description, content_path, image_url,
  price_token, price_amount_wei, stock, is_unlimited, is_active
) VALUES (
  'default',
  'ベーシックアバター.glb',
  '初心者向けの3Dアバターモデル',
  'downloads/default/avatar-basic-001.glb',
  'https://via.placeholder.com/300x300.png?text=Avatar',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  '50000000000000000000', -- 50 tNHT
  0, true, true
) ON CONFLICT DO NOTHING;

-- サンプル商品2: 在庫制限あり
INSERT INTO products (
  tenant_id, name, description, content_path, image_url,
  price_token, price_amount_wei, stock, is_unlimited, is_active
) VALUES (
  'default',
  'ウェルカムサウンド.mp3',
  'ギフテラへようこそのBGM',
  'downloads/default/welcome-sound-001.mp3',
  'https://via.placeholder.com/300x300.png?text=Music',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  '25000000000000000000', -- 25 tNHT
  10, false, true
) ON CONFLICT DO NOTHING;

-- サンプル商品3: SOLD OUT
INSERT INTO products (
  tenant_id, name, description, content_path, image_url,
  price_token, price_amount_wei, stock, is_unlimited, is_active
) VALUES (
  'default',
  '限定アート作品.glb',
  '著名アーティストの3D作品（完売）',
  'downloads/default/art-glb-001.glb',
  'https://via.placeholder.com/300x300.png?text=SOLD+OUT',
  '0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea',
  '100000000000000000000', -- 100 tNHT
  0, false, true
) ON CONFLICT DO NOTHING;
```

---

## 📦 ステップ2: 商品管理画面で動作確認

### 2-1. 管理画面にアクセス

```
http://localhost:5174/admin
```

### 2-2. ウォレット接続

MetaMask で Polygon Amoy Testnet に接続

### 2-3. 「📦 商品管理（Supabase）」ボタンをクリック

ナビゲーションバーの新しいボタンから Supabase 版の商品管理画面を開く

### 2-4. 商品一覧を確認

✅ サンプル商品3件が表示されることを確認：
- ベーシックアバター.glb（∞ 在庫無制限）
- ウェルカムサウンド.mp3（在庫: 10）
- 限定アート作品.glb（SOLD OUT）

### 2-5. 新規商品を追加してみる（オプション）

1. 「＋ 新規商品追加」ボタンをクリック
2. フォームに入力：
   - 商品名: `テスト商品`
   - 説明: `テスト用の商品です`
   - 価格（Wei）: `10000000000000000000` (= 10 tNHT)
   - 在庫無制限: チェック
   - サムネイル画像: 任意の画像をアップロード
   - 配布ファイル: 任意のファイルをアップロード
3. 「保存」ボタンをクリック
4. 成功メッセージを確認

---

## 🛒 ステップ3: 購入UIで動作確認（Supabase版）

### 3-1. AppSupabase を有効化

`src/main.tsx` を一時的に編集：

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

### 3-2. GIFT HUB UI にアクセス

```
http://localhost:5174/?tenant=default
```

### 3-3. 商品表示を確認

✅ 期待される表示：
- 商品A: `50 tNHT` / `∞ 在庫あり` （グラデーションボタン）
- 商品B: `25 tNHT` / `在庫: 10` （グラデーションボタン）
- 商品C: `100 tNHT` / `SOLD OUT` （グレーアウト、クリック不可）

### 3-4. マウスオーバーでプレビュー確認

商品ボタンにマウスを乗せると、ディスプレイ窓に画像が表示される

---

## 🧪 ステップ4: Admin API の動作確認（オプション）

### 4-1. 商品一覧取得

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
      "price_amount_wei": "50000000000000000000",
      "is_unlimited": true,
      ...
    },
    ...
  ]
}
```

### 4-2. 商品作成

```bash
curl -X POST http://localhost:5174/api/admin/products \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default",
    "name": "API経由テスト",
    "description": "API経由で作成した商品",
    "contentPath": "downloads/default/test.glb",
    "priceToken": "0xdB738C7A83FE7738299a67741Ae2AbE42B3BA2Ea",
    "priceAmountWei": "10000000000000000000",
    "stock": 5,
    "isUnlimited": false,
    "isActive": true
  }'
```

---

## 🔐 セキュリティチェック

### ✅ 確認済み項目

1. **環境変数の分離**
   - ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → クライアント露出OK
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` → サーバーサイドのみ使用
   - ✅ VITE_ prefix で service_role を参照していない（grep で確認済み）

2. **RLS (Row Level Security)**
   - ✅ products テーブル: 全ユーザーが is_active=true を読み取り可能
   - ✅ INSERT/UPDATE: service_role のみ実行可能

3. **楽観ロック**
   - ✅ updated_at の一致チェックで競合検知
   - ✅ 409 Conflict エラーでユーザーに通知

---

## 🎯 次のステップ

### 優先度: 高
1. ✅ Supabase マイグレーション実行
2. ✅ 商品管理画面で商品追加・編集
3. ⏳ **実際のファイルを Supabase Storage `gh-downloads` バケットにアップロード**
4. ⏳ **End-to-End 購入フローのテスト**（投げ銭 → ダウンロード）

### 優先度: 中
5. ⏳ VendingDashboard の完全移行（既存の localStorage 版を Supabase に統合）
6. ⏳ テナント設定テーブルの作成（デザイン色、displayName など）

---

## 📋 トラブルシューティング

### Q1: 商品が表示されない

**原因:** マイグレーションが実行されていない、または環境変数が設定されていない

**解決策:**
1. Supabase SQL Editor でマイグレーション（002, 003）を実行
2. `.env` と Vercel の環境変数を確認

### Q2: 画像アップロードに失敗する

**原因:** Supabase Storage バケットが作成されていない

**解決策:**
Supabase Dashboard → Storage で以下のバケットを作成：
- `gh-public` (Public)
- `gh-downloads` (Private)
- `product-images` (Public)
- `product-files` (Private)

### Q3: 保存時に 409 Conflict エラー

**原因:** 他のユーザー/タブで同じ商品が更新された

**解決策:**
アラートダイアログの指示に従ってページを再読み込み

---

## 📂 主要ファイル

```
api/admin/products/
├── index.ts          # GET, POST
└── [id].ts           # PUT, DELETE

src/
├── admin/products/
│   └── ProductManager.tsx  # 商品管理画面（Supabase版）
├── vending-ui/
│   └── AppSupabase.tsx     # 購入UI（Supabase版）
├── hooks/
│   └── useSupabaseProducts.ts  # 商品取得フック
└── lib/
    ├── adminApi.ts         # Admin API クライアント
    └── supabase.ts         # Supabase クライアント

supabase/migrations/
├── 001_create_products_and_purchases.sql  # 基本スキーマ
├── 002_add_image_url_to_products.sql      # image_url カラム追加
└── 003_insert_sample_product.sql          # サンプルデータ
```

---

🎉 **これで Supabase 正本版の GIFT HUB 購入システムが稼働します！**
