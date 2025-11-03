-- Supabase Storage RLS ポリシー設定
-- 実行方法: Supabase Dashboard → SQL Editor → 新規クエリ → このSQLを貼り付けて実行

-- ==========================================
-- gh-public バケット（公開アセット用）
-- ==========================================

-- 誰でもアップロード可能
CREATE POLICY "gh-public: Public Upload Access"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'gh-public');

-- 誰でも読み取り可能
CREATE POLICY "gh-public: Public Read Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gh-public');

-- 誰でも更新可能
CREATE POLICY "gh-public: Public Update Access"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'gh-public')
WITH CHECK (bucket_id = 'gh-public');

-- 誰でも削除可能
CREATE POLICY "gh-public: Public Delete Access"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'gh-public');

-- ==========================================
-- gh-downloads バケット（非公開・購入者専用）
-- ==========================================

-- Service Role のみアップロード可能（管理者用）
CREATE POLICY "gh-downloads: Service Role Upload"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'gh-downloads');

-- Service Role のみ読み取り可能（署名URL生成用）
CREATE POLICY "gh-downloads: Service Role Read"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'gh-downloads');

-- Service Role のみ削除可能
CREATE POLICY "gh-downloads: Service Role Delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'gh-downloads');

-- ==========================================
-- gh-logos バケット（公開ロゴ用）
-- ==========================================

-- 誰でもアップロード可能
CREATE POLICY "gh-logos: Public Upload Access"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'gh-logos');

-- 誰でも読み取り可能
CREATE POLICY "gh-logos: Public Read Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gh-logos');

-- 誰でも更新可能
CREATE POLICY "gh-logos: Public Update Access"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'gh-logos')
WITH CHECK (bucket_id = 'gh-logos');

-- 誰でも削除可能
CREATE POLICY "gh-logos: Public Delete Access"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'gh-logos');

-- ==========================================
-- gh-avatars バケット（公開アバター用）
-- ==========================================

-- 誰でもアップロード可能
CREATE POLICY "gh-avatars: Public Upload Access"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'gh-avatars');

-- 誰でも読み取り可能
CREATE POLICY "gh-avatars: Public Read Access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gh-avatars');

-- 誰でも更新可能
CREATE POLICY "gh-avatars: Public Update Access"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'gh-avatars')
WITH CHECK (bucket_id = 'gh-avatars');

-- 誰でも削除可能
CREATE POLICY "gh-avatars: Public Delete Access"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'gh-avatars');

-- ==========================================
-- gh-temp バケット（一時ファイル用）
-- ==========================================

-- Service Role のみアップロード可能
CREATE POLICY "gh-temp: Service Role Upload"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'gh-temp');

-- Service Role のみ読み取り可能
CREATE POLICY "gh-temp: Service Role Read"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'gh-temp');

-- Service Role のみ削除可能
CREATE POLICY "gh-temp: Service Role Delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'gh-temp');

-- ==========================================
-- ポリシー確認用クエリ
-- ==========================================

-- 以下のクエリで設定されたポリシーを確認できます
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
