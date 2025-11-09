-- フラグNFTテーブルに自動配布とバーン機能フィールドを追加
-- Migration: add_auto_distribution_fields.sql

-- バーン機能フラグを追加
ALTER TABLE public.flag_nfts
ADD COLUMN IF NOT EXISTS is_burnable BOOLEAN NOT NULL DEFAULT FALSE;

-- 自動配布設定フィールドを追加
ALTER TABLE public.flag_nfts
ADD COLUMN IF NOT EXISTS auto_distribution_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.flag_nfts
ADD COLUMN IF NOT EXISTS required_tip_amount NUMERIC(20, 6); -- JPYC/tNHT換算額（小数点対応）

ALTER TABLE public.flag_nfts
ADD COLUMN IF NOT EXISTS target_token TEXT CHECK (target_token IN ('JPYC', 'tNHT', 'both'));

-- インデックスを追加（自動配布が有効なNFTの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_flag_nfts_auto_distribution
ON public.flag_nfts(auto_distribution_enabled, is_active)
WHERE auto_distribution_enabled = true AND is_active = true;

-- コメント追加
COMMENT ON COLUMN public.flag_nfts.is_burnable IS 'ユーザーがNFTをバーン（焼却）できるか';
COMMENT ON COLUMN public.flag_nfts.auto_distribution_enabled IS '投げ銭累積による自動配布を有効化';
COMMENT ON COLUMN public.flag_nfts.required_tip_amount IS '自動配布に必要な累積チップ額（JPYC/tNHT換算）';
COMMENT ON COLUMN public.flag_nfts.target_token IS '自動配布の対象トークン（JPYC, tNHT, both）';
