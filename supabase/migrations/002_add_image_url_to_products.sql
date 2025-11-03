-- products テーブルに image_url カラムを追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- コメント追加
COMMENT ON COLUMN products.image_url IS 'Supabase Storage のサムネイル画像パス（例: gh-public/thumbnails/...)';
