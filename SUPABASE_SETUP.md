# Supabase セットアップガイド

GIFT HUBで画像・ファイル保存と購入システムを運用するためにSupabaseを使用します。

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://app.supabase.com/)にアクセス
2. 「New Project」をクリック
3. プロジェクト名、データベースパスワードを設定
4. リージョンを選択（推奨：Northeast Asia (Tokyo)）
5. 「Create new project」をクリック

## 2. ストレージバケットの作成

プロジェクト作成後、以下のバケットを作成します：

### 2.1 Storage > Create a new bucket

以下の5つのバケットを作成してください：

1. **vending-images** - GIFT HUBのヘッダー・背景画像
   - Public bucket: ✅ ON

2. **product-images** - 商品のサムネイル画像
   - Public bucket: ✅ ON

3. **product-files** - 商品の配布ファイル（GLB、ZIP等）
   - Public bucket: ✅ ON

4. **ad-images** - リワードUIの広告画像
   - Public bucket: ✅ ON

5. **downloads** - 購入後のコンテンツ配布用（署名付きURL）
   - Public bucket: ❌ OFF（プライベート）

### 2.2 各バケットの設定

各バケットで「Policies」タブを開き、以下のポリシーを追加：

**INSERT ポリシー（アップロード許可）:**
```sql
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'バケット名');
```

**SELECT ポリシー（読み取り許可）:**
```sql
CREATE POLICY "Allow public access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'バケット名');
```

## 3. データベーステーブルの作成（購入システム用）

### 3.1 SQL Editorでマイグレーション実行

1. Supabaseの「SQL Editor」を開く
2. `supabase/migrations/001_create_products_and_purchases.sql` の内容をコピー
3. SQL Editorに貼り付けて「Run」をクリック

これにより以下が作成されます：
- `products` テーブル（商品情報）
- `purchases` テーブル（購入履歴）
- `decrement_stock()` 関数（在庫の原子的減少）
- Row Level Security ポリシー

### 3.2 テーブル構造の確認

**products テーブル:**
- `id`: UUID（主キー）
- `tenant_id`: テナントID
- `name`: 商品名
- `content_path`: ダウンロードファイルのパス（downloads/{tenantId}/...）
- `price_token`: 支払いトークンアドレス（デフォルト: tNHT）
- `price_amount_wei`: 価格（wei単位、文字列）
- `stock`: 在庫数
- `is_unlimited`: 在庫無制限フラグ
- `is_active`: 有効/無効

**purchases テーブル:**
- `id`: UUID（主キー）
- `product_id`: 商品ID（外部キー）
- `buyer`: 購入者ウォレットアドレス
- `tx_hash`: トランザクションハッシュ（UNIQUE制約で冪等性保証）
- `amount_wei`: 支払額

## 4. 環境変数の設定

### 4.1 フロントエンド（.env）

1. Supabaseの「Settings」→「API」ページを開く
2. 以下の情報をコピー：
   - Project URL
   - anon public key

3. `.env`ファイルに追加：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
VITE_API_BASE_URL=https://your-vercel-app.vercel.app
```

### 4.2 サーバーサイド（Vercel環境変数）

Vercelプロジェクトの「Settings」→「Environment Variables」で以下を設定：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ALCHEMY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
```

⚠️ **重要**: `SUPABASE_SERVICE_ROLE_KEY`は絶対にフロントエンドに露出させないでください
⚠️ **重要**: サーバーサイド変数には `VITE_` prefix を付けないでください

## 5. 動作確認

1. 開発サーバーを再起動
2. GIFT HUB管理画面で画像をアップロード
3. Supabaseの「Storage」で画像がアップロードされているか確認

## トラブルシューティング

### 画像がアップロードできない

1. バケットが「Public」になっているか確認
2. ポリシーが正しく設定されているか確認
3. ブラウザのコンソールでエラーメッセージを確認

### 画像が表示されない

1. バケットの「Public」設定を確認
2. SELECTポリシーが設定されているか確認
3. 画像URLが正しいか確認（ブラウザで直接アクセス）

## 次のステップ

将来的には、以下の機能を追加予定：

- [ ] GIFT HUB商品データをSupabase Databaseに保存
- [ ] ユーザー認証とファイルアクセス制限
- [ ] 画像の自動リサイズ・最適化
- [ ] ファイルの容量制限チェック
