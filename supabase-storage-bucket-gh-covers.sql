-- カバー画像バケットのセットアップ
-- 実行方法: Supabase Dashboard → SQL Editor → このSQLを貼り付けて実行

-- 1. gh-covers バケットを作成（既存の場合はスキップ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gh-covers',
  'gh-covers',
  true, -- 公開バケット
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS ポリシーを適用

-- 誰でもアップロード可能
DROP POLICY IF EXISTS "gh-covers: Public Upload Access" ON storage.objects;
CREATE POLICY "gh-covers: Public Upload Access"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'gh-covers');

-- 誰でも読み取り可能
DROP POLICY IF EXISTS "gh-covers: Public Read Access" ON storage.objects;
CREATE POLICY "gh-covers: Public Read Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gh-covers');

-- 誰でも更新可能
DROP POLICY IF EXISTS "gh-covers: Public Update Access" ON storage.objects;
CREATE POLICY "gh-covers: Public Update Access"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'gh-covers')
WITH CHECK (bucket_id = 'gh-covers');

-- 誰でも削除可能
DROP POLICY IF EXISTS "gh-covers: Public Delete Access" ON storage.objects;
CREATE POLICY "gh-covers: Public Delete Access"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'gh-covers');

-- 3. 確認用クエリ
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'gh-covers';
