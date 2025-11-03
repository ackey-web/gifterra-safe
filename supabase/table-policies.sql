-- Supabase Table RLS ポリシー設定
-- 実行方法: Supabase Dashboard → SQL Editor → 新規クエリ → このSQLを貼り付けて実行

-- ==========================================
-- products テーブル（商品管理）
-- ==========================================

-- 既存ポリシーを削除（エラーを無視）
DROP POLICY IF EXISTS "products: Public Read Access" ON products;
DROP POLICY IF EXISTS "products: Public Insert Access (DEV ONLY)" ON products;
DROP POLICY IF EXISTS "products: Public Update Access (DEV ONLY)" ON products;
DROP POLICY IF EXISTS "products: Public Delete Access (DEV ONLY)" ON products;

-- RLSを有効化
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能（開発環境用）
-- 本番環境では is_active = true の条件を追加すべき
CREATE POLICY "products: Public Read Access"
ON products
FOR SELECT
TO anon, authenticated
USING (true);

-- 誰でも挿入可能（開発環境用 - 本番では削除すべき）
CREATE POLICY "products: Public Insert Access (DEV ONLY)"
ON products
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 誰でも更新可能（開発環境用 - 本番では削除すべき）
CREATE POLICY "products: Public Update Access (DEV ONLY)"
ON products
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 誰でも削除可能（開発環境用 - 本番では削除すべき）
CREATE POLICY "products: Public Delete Access (DEV ONLY)"
ON products
FOR DELETE
TO anon, authenticated
USING (true);

-- ==========================================
-- purchases テーブル（購入履歴）
-- ==========================================

-- Service Role のみ読み取り可能
CREATE POLICY "purchases: Service Role Read"
ON purchases
FOR SELECT
TO service_role
USING (true);

-- Service Role のみ挿入可能
CREATE POLICY "purchases: Service Role Insert"
ON purchases
FOR INSERT
TO service_role
WITH CHECK (true);

-- ==========================================
-- download_tokens テーブル（ダウンロードトークン）
-- ==========================================

-- Service Role のみ読み取り可能
CREATE POLICY "download_tokens: Service Role Read"
ON download_tokens
FOR SELECT
TO service_role
USING (true);

-- Service Role のみ挿入可能
CREATE POLICY "download_tokens: Service Role Insert"
ON download_tokens
FOR INSERT
TO service_role
WITH CHECK (true);

-- Service Role のみ更新可能
CREATE POLICY "download_tokens: Service Role Update"
ON download_tokens
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ==========================================
-- ポリシー確認用クエリ
-- ==========================================

-- 以下のクエリで設定されたポリシーを確認できます
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('products', 'purchases', 'download_tokens');
