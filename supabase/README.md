# Supabase セットアップ手順

このドキュメントでは、GIFT HUB機能に必要なSupabaseのセットアップ手順を説明します。

## 🚨 重要：初回セットアップ

GIFT HUBで特典の受け取り機能を使用するには、以下のマイグレーションを**必ず実行**してください。

### 1. Supabaseダッシュボードを開く

https://app.supabase.com にアクセスし、プロジェクトを選択

### 2. SQL Editorを開く

左メニューから「SQL Editor」をクリック

### 3. マイグレーションを順番に実行

以下のファイルを**順番通り**に実行してください：

#### 3-1. 商品・購入履歴テーブルの作成

`supabase/migrations/001_create_products_and_purchases.sql` の内容をコピーして実行

このSQLで以下が作成されます：
- `products` テーブル（商品情報）
- `purchases` テーブル（購入履歴）
- `decrement_stock` RPC関数（在庫管理）

#### 3-2. ダウンロードトークンテーブルの作成

`supabase/migrations/002_create_download_tokens.sql` の内容をコピーして実行

このSQLで以下が作成されます：
- `download_tokens` テーブル（ワンタイムダウンロードトークン）
- `create_download_token` RPC関数（トークン生成）
- `consume_download_token` RPC関数（トークン検証・消費）
- `cleanup_expired_tokens` RPC関数（期限切れトークン削除）
- `get_user_purchases` RPC関数（購入履歴取得）

#### 3-3. 商品画像URLカラムの追加

`supabase/migrations/002_add_image_url_to_products.sql` の内容をコピーして実行

このSQLで以下が追加されます：
- `products.image_url` カラム（商品画像URL）

#### 3-4. サンプル商品の挿入（オプション）

`supabase/migrations/003_insert_sample_product.sql` の内容をコピーして実行

このSQLで以下が作成されます：
- サンプル商品データ

#### 3-5. トークン有効期限の更新

`supabase/migrations/004_update_token_expiration.sql` の内容をコピーして実行

このSQLで以下が更新されます：
- ダウンロードトークンの有効期限設定

#### 3-6. 購入履歴取得関数の修正

`supabase/migrations/005_fix_get_user_purchases_case_insensitive.sql` の内容をコピーして実行

このSQLで以下が修正されます：
- `get_user_purchases` RPC関数（大文字小文字を区別しない検索）

#### 3-7. ダウンロードトークンRLSポリシーの修正

`supabase/migrations/006_fix_download_tokens_rls_policy.sql` の内容をコピーして実行

このSQLで以下が修正されます：
- `download_tokens` テーブルのRLSポリシー（匿名ユーザーアクセス許可）

#### 3-8. 支払い分割機能の追加

`supabase/migrations/007_add_payment_split_to_products.sql` の内容をコピーして実行

このSQLで以下が追加されます：
- `products.payment_split` カラム（PaymentSplitter統合）

#### 3-9. 🎯 共通カタログ機能の追加（最新）

`supabase/migrations/008_create_vending_machines_and_hub_products.sql` の内容をコピーして実行

このSQLで以下が作成されます：
- `vending_machines` テーブル（GIFT HUB本体の設定）
- `hub_products` テーブル（HUBと商品の紐づけ）
- `products.category` カラム（共通カタログフラグ）
- `v_hub_products_full` ビュー（HUB商品一覧取得）
- `add_product_to_hub()` RPC関数（商品追加）
- `remove_product_from_hub()` RPC関数（商品削除）
- RLSポリシー（vending_machines, hub_products）

**注意**: このマイグレーションは共通カタログ管理機能に必須です。

#### 3-10. RLSポリシーの設定

`supabase/table-policies.sql` の内容をコピーして実行

このSQLで以下が設定されます：
- `products` テーブルのRLSポリシー（開発環境用）

#### 3-5. ストレージポリシーの設定

`supabase/storage-policies.sql` の内容をコピーして実行

このSQLで以下が設定されます：
- `gh-public` バケットの作成
- ストレージのRLSポリシー

### 4. 実行結果を確認

各マイグレーションが成功すると、以下のようなメッセージが表示されます：
```
Success. No rows returned
```

エラーが表示された場合は、エラーメッセージを確認して修正してください。

---

## トラブルシューティング

### 特典受け取り時に500エラーが発生する場合

**エラーメッセージ**: 「ダウンロードトークンの発行に失敗しました」

**原因**: `download_tokens` テーブルまたは `create_download_token` RPC関数が存在しない

**解決方法**:
1. 上記の「初回セットアップ」手順を実行
2. 特に `002_create_download_tokens.sql` が正しく実行されているか確認
3. Supabase Dashboard → Database → Tables で `download_tokens` テーブルが存在することを確認
4. Supabase Dashboard → Database → Functions で `create_download_token` 関数が存在することを確認

### 特典削除時に401エラーが発生する場合

**エラーメッセージ**: 401 Unauthorized

**原因**: RLSポリシーが `anon` ロールを許可していない

**解決方法**:
1. `supabase/table-policies.sql` の内容をSupabase SQL Editorで実行
2. ブラウザをリロード
3. 特典削除を再度試す

### RLSポリシーの内容

`table-policies.sql` で設定されるポリシー：

- **SELECT**: `anon`と`authenticated`ロールがすべての商品を読み取り可能
- **INSERT**: `anon`と`authenticated`ロールが商品を作成可能（開発環境用）
- **UPDATE**: `anon`と`authenticated`ロールが商品を更新可能（開発環境用）
- **DELETE**: `anon`と`authenticated`ロールが商品を削除可能（開発環境用）

**注意**: これらのポリシーは開発環境用です。本番環境では、より厳格なポリシーに変更する必要があります。

### ポリシーが既に存在するエラー

```
ERROR: policy "products: Public Read Access" for table "products" already exists
```

このエラーが出た場合、SQLの先頭にある`DROP POLICY IF EXISTS`文が実行されていません。
手動で既存ポリシーを削除してください：

1. Supabaseダッシュボードで「Database」→「Tables」→「products」を選択
2. 「Policies」タブを開く
3. 既存のポリシーを削除
4. 再度SQLを実行

### 401エラーが解決しない場合

1. ブラウザのキャッシュをクリア
2. ブラウザの開発者ツールを開き、Networkタブで実際のリクエストヘッダーを確認
3. Supabaseプロジェクトの環境変数（VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY）が正しく設定されているか確認

### GIFT HUB削除ボタンが表示されない場合

GIFT HUB削除ボタンは既に実装されています。各GIFT HUBカードの右側に赤い「削除」ボタンが表示されています。

表示されていない場合：
1. ブラウザをハードリフレッシュ（Mac: `Cmd + Shift + R`, Windows: `Ctrl + Shift + R`）
2. ブラウザのキャッシュをクリア
