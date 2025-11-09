# プロフィール機能のSupabase設定

プロフィールの保存と画像アップロードが失敗する場合は、以下の設定を確認してください。

## 1. `user_profiles` テーブルの作成

Supabase Dashboard → SQL Editor で以下を実行：

```sql
-- user_profilesテーブルを作成
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  tenant_id TEXT,
  display_name TEXT,
  name TEXT, -- 古いカラム名（互換性のため残す）
  bio TEXT,
  avatar_url TEXT,
  icon_url TEXT, -- 古いカラム名（互換性のため残す）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);

-- RLSを有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- 全ユーザーがプロフィールを閲覧可能
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  USING (true);

-- 全ユーザーが自分のプロフィールを作成可能
CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (true);

-- 全ユーザーが自分のプロフィールを更新可能
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (true);
```

## 2. `avatars` ストレージバケットの作成

Supabase Dashboard → Storage → New bucket

- **Name**: `avatars`
- **Public**: ✅ チェック（公開バケット）
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/gif,image/webp`

## 3. `avatars` バケットのポリシー設定

Supabase Dashboard → Storage → avatars → Policies

### 読み取りポリシー（全員が閲覧可能）

```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );
```

### アップロードポリシー（全員がアップロード可能）

```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
);
```

### 更新ポリシー（全員が更新可能）

```sql
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );
```

### 削除ポリシー（全員が削除可能）

```sql
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'avatars' );
```

## 4. 環境変数の確認

`.env` ファイルに以下が設定されているか確認：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## トラブルシューティング

### プロフィールが保存できない場合

ブラウザのコンソールを確認して、以下のエラーがないかチェック：

1. **`user_profiles` テーブルが存在しない**
   - 上記のSQLを実行してテーブルを作成

2. **RLSポリシーエラー**
   - ポリシーを再度作成（上記のSQL）

3. **認証エラー**
   - Supabase Anon Keyが正しいか確認

### 画像アップロードが失敗する場合

1. **`avatars` バケットが存在しない**
   - Storage → New bucket で作成

2. **ポリシーエラー**
   - 上記のポリシーを設定

3. **ファイルサイズエラー**
   - 5MB以下の画像を使用

4. **MIME typeエラー**
   - JPG, PNG, GIF, WebPのいずれかを使用

## 確認方法

1. Supabase Dashboard → Table Editor → `user_profiles` が表示されるか確認
2. Supabase Dashboard → Storage → `avatars` が表示されるか確認
3. ブラウザのコンソールでエラーメッセージを確認
