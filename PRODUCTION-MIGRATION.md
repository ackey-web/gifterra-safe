# 本番環境移行ガイド（Production Migration Guide）

## 現状の開発環境の問題点

現在の実装は **開発環境専用** であり、以下のセキュリティリスクがあります：

### 🚨 セキュリティリスク

1. **配布ファイルが公開バケットに保存されている**
   - 現状: `gh-public` バケット（誰でもアクセス可能）
   - 問題: URLが分かれば購入していない人でもダウンロード可能
   - 影響: 商品の不正ダウンロード、収益損失

2. **データベースへの直接書き込みが許可されている**
   - 現状: `products` テーブルへの public INSERT/UPDATE/DELETE が許可
   - 問題: 悪意のあるユーザーが商品を改ざん・削除可能
   - 影響: データ破壊、価格改ざん、在庫操作

3. **サーバーサイド検証がない**
   - 現状: クライアントサイドから直接 Supabase にアクセス
   - 問題: 入力値検証・権限チェックをバイパス可能
   - 影響: 不正データ挿入、権限昇格

4. **ダウンロードトークンが機能していない**
   - 現状: トークンチェックはあるが、公開URLを返却
   - 問題: トークンなしでも直接URLアクセスで入手可能
   - 影響: 購入確認の無効化

---

## 本番環境への移行手順

### ステップ1: RLSポリシーの厳格化

#### 1.1 Storage ポリシーの更新

**ファイル**: `supabase/storage-policies-production.sql`（新規作成推奨）

```sql
-- ==========================================
-- 本番環境用 Storage RLS ポリシー
-- ==========================================

-- gh-public: 読み取りのみ許可（書き込みは Service Role のみ）
DROP POLICY IF EXISTS "gh-public: Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "gh-public: Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "gh-public: Public Delete Access" ON storage.objects;

CREATE POLICY "gh-public: Service Role Write"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'gh-public');

CREATE POLICY "gh-public: Public Read Only"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gh-public');

-- gh-downloads: 完全に Service Role のみに制限（現状維持）
-- gh-logos, gh-avatars: 必要に応じて Service Role のみに制限
```

#### 1.2 Table ポリシーの更新

**ファイル**: `supabase/table-policies-production.sql`（新規作成推奨）

```sql
-- ==========================================
-- 本番環境用 Table RLS ポリシー
-- ==========================================

-- 開発環境用ポリシーを削除
DROP POLICY IF EXISTS "products: Public Insert Access (DEV ONLY)" ON products;
DROP POLICY IF EXISTS "products: Public Update Access (DEV ONLY)" ON products;
DROP POLICY IF EXISTS "products: Public Delete Access (DEV ONLY)" ON products;

-- Service Role のみ書き込み可能
CREATE POLICY "products: Service Role Write"
ON products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 公開読み取りは維持（商品一覧表示用）
CREATE POLICY "products: Public Read Active Products"
ON products
FOR SELECT
TO public
USING (is_active = true);
```

---

### ステップ2: サーバーサイドAPI実装

すでに作成済みのファイルを有効化・改善します。

#### 2.1 管理者用アップロードAPI

**ファイル**: `api/admin/upload.ts`（既存・改善必要）

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bucket, bucketForKind, type BucketType } from '../src/lib/storageBuckets';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 環境変数名を変更
);

// TODO: 本番環境では認証ミドルウェアを追加
// 例: JWT検証、管理者権限チェック
async function verifyAdmin(req: VercelRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;

  // JWT検証ロジック（実装必要）
  // const token = authHeader.replace('Bearer ', '');
  // const { data, error } = await supabase.auth.getUser(token);
  // return data?.user?.role === 'admin';

  return true; // 一時的に許可（実装後に削除）
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 認証チェック
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 既存のアップロードロジック...
  // （現在の実装をそのまま使用）
}
```

#### 2.2 商品管理API

**ファイル**: `api/admin/products.ts`（新規作成）

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 認証チェック（2.1と同様）

  if (req.method === 'POST') {
    // 商品作成
    const productData = req.body;

    // バリデーション
    if (!productData.name || !productData.price_amount_wei) {
      return res.status(400).json({ error: 'Invalid product data' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    // 商品更新
    const { id, ...productData } = req.body;

    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    // 商品削除
    const { id } = req.query;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

#### 2.3 ダウンロードAPI修正

**ファイル**: `api/download/[token].ts`（既存・修正必要）

```typescript
// 現在の実装:
// const { data: publicUrlData } = supabase.storage
//   .from(bucket('PUBLIC'))
//   .getPublicUrl(product.content_path);

// 本番環境用に戻す:
const { data: signedUrlData, error: signedUrlError } = await supabase.storage
  .from(bucket('DOWNLOADS')) // gh-downloads（非公開バケット）に変更
  .createSignedUrl(product.content_path, 600); // 10分間有効

if (signedUrlError || !signedUrlData) {
  return res.status(500).json({
    success: false,
    error: 'ダウンロードURLの生成に失敗しました',
  });
}

return res.status(200).json({
  success: true,
  downloadUrl: signedUrlData.signedUrl,
  expiresIn: 600,
});
```

---

### ステップ3: フロントエンド修正

#### 3.1 ProductManager.tsx の修正

**ファイル**: `src/admin/products/ProductManager.tsx`

```typescript
// 配布ファイルアップロードを API 経由に変更
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files?.[0]) return;

  setIsUploading(true);
  try {
    const file = e.target.files[0];

    // サーバーサイドAPI経由でアップロード
    const result = await uploadFileViaAPI(file, 'DOWNLOADS');

    if (result.success) {
      // パスのみを保存（署名URL生成時に使用）
      handleChange('contentPath', result.path);
      setUploadMessage('✅ アップロード成功');
    }
  } catch (error) {
    console.error('アップロードエラー:', error);
    setUploadMessage('❌ アップロード失敗');
  } finally {
    setIsUploading(false);
  }
};

// 商品保存をAPI経由に変更
const handleSave = async () => {
  setIsSaving(true);
  try {
    const productData = {
      tenant_id: tenantId,
      name: editingProduct.name,
      description: editingProduct.description,
      content_path: editingProduct.contentPath,
      image_url: editingProduct.imageUrl,
      price_token: DEFAULT_TOKEN,
      price_amount_wei: editingProduct.priceAmountWei,
      stock: editingProduct.stock,
      is_unlimited: editingProduct.isUnlimited,
      is_active: true,
    };

    const response = await fetch('/api/admin/products', {
      method: editingProduct.id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: 認証トークンを追加
        // 'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(
        editingProduct.id
          ? { id: editingProduct.id, ...productData }
          : productData
      ),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '保存に失敗しました');
    }

    const savedProduct = await response.json();
    console.log('保存成功:', savedProduct);

    // UIリフレッシュ
    await loadProducts();
    setEditingProduct(null);
    alert('保存しました');
  } catch (error) {
    console.error('保存エラー:', error);
    alert('保存に失敗しました');
  } finally {
    setIsSaving(false);
  }
};
```

#### 3.2 クライアント直接アクセスの削除

以下のファイルから `adminSupabase` の使用を削除：
- `src/admin/products/ProductManager.tsx`
- その他管理画面コンポーネント

```typescript
// 削除対象
import { adminSupabase } from '../../lib/adminSupabase';
const { error } = await adminSupabase.from('products').insert([...]);

// 代わりに API 経由に統一
const response = await fetch('/api/admin/products', { ... });
```

---

### ステップ4: 環境変数設定

#### 4.1 Vercel環境変数（本番環境）

Vercel Dashboard → Settings → Environment Variables で設定：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (公開用・anonキー)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (サーバーサイド専用・Service Roleキー)
```

**重要**:
- `VITE_SUPABASE_SERVICE_ROLE_KEY` は削除（クライアントに露出させない）
- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用

#### 4.2 開発環境（.env.local）

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

### ステップ5: 認証・認可の実装

#### 5.1 管理者認証フロー

**オプション1: Supabase Auth + カスタムクレーム**
```typescript
// 管理者ロールをユーザーメタデータに追加
await supabase.auth.admin.updateUserById(userId, {
  user_metadata: { role: 'admin' }
});

// API側で検証
const { data: { user } } = await supabase.auth.getUser(token);
if (user?.user_metadata?.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**オプション2: 簡易パスワード認証**
```typescript
// 環境変数で管理者パスワード設定
ADMIN_PASSWORD=your-secure-password

// API側でチェック
const password = req.headers['x-admin-password'];
if (password !== process.env.ADMIN_PASSWORD) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

#### 5.2 フロントエンド認証UI

`src/admin/AdminLogin.tsx`（新規作成推奨）

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    // パスワードを localStorage に保存（簡易実装）
    // または Supabase Auth でログイン
    localStorage.setItem('adminPassword', password);
    navigate('/admin/products');
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-bold mb-4">管理者ログイン</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        className="w-full p-2 border rounded mb-4"
      />
      <button onClick={handleLogin} className="w-full bg-blue-500 text-white p-2 rounded">
        ログイン
      </button>
    </div>
  );
}
```

---

## 移行チェックリスト

### デプロイ前の確認事項

- [ ] `supabase/storage-policies-production.sql` を実行
- [ ] `supabase/table-policies-production.sql` を実行
- [ ] Vercel環境変数に `SUPABASE_SERVICE_ROLE_KEY` を設定
- [ ] `.env.local` から `VITE_SUPABASE_SERVICE_ROLE_KEY` を削除
- [ ] `src/lib/adminSupabase.ts` の使用を全削除
- [ ] `ProductManager.tsx` を API 経由に書き換え
- [ ] `api/download/[token].ts` を署名URL方式に戻す
- [ ] 管理者認証を実装
- [ ] 既存の配布ファイルを `gh-public` → `gh-downloads` に移行

### デプロイ後の確認事項

- [ ] 管理画面にログインできるか
- [ ] 商品登録・更新・削除が動作するか
- [ ] 配布ファイルが非公開バケットに保存されるか
- [ ] 購入後のダウンロードが署名URLで動作するか
- [ ] 署名URLの有効期限（10分）が機能するか
- [ ] 未購入者が直接URLでアクセスできないか（テスト必須）

---

## リスク評価

### 高リスク（即対応必要）

1. **配布ファイルの公開バケット保存**: 不正ダウンロード可能
2. **データベース直接書き込み許可**: データ改ざん可能

### 中リスク（短期対応推奨）

3. **認証なし管理画面**: 誰でもアクセス可能
4. **入力値検証なし**: 不正データ挿入可能

### 低リスク（長期改善）

5. **エラーハンドリング不足**: ユーザー体験の低下
6. **監査ログなし**: 不正操作の追跡困難

---

## サポートが必要な場合

以下の実装について追加のサポートが必要な場合は、お知らせください：

1. 管理者認証の実装（Supabase Auth vs 簡易認証）
2. 既存データの移行スクリプト
3. E2Eテストの作成
4. セキュリティ監査

本番環境移行は段階的に進めることを推奨します。まずはステージング環境で十分にテストしてください。
