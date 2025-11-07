-- フラグNFT機能のSupabaseテーブルスキーマ
-- 法務対応: 「商品」「購入」などの表現を使用せず、「特典」「チップ」で統一

-- ===================================
-- 1. flag_nfts テーブル（フラグNFT基本情報）
-- ===================================
CREATE TABLE IF NOT EXISTS public.flag_nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL, -- Supabase Storage URL

  -- カテゴリ
  category TEXT NOT NULL CHECK (category IN ('BENEFIT', 'MEMBERSHIP', 'ACHIEVEMENT', 'CAMPAIGN', 'ACCESS_PASS', 'COLLECTIBLE')),

  -- 使用制限
  usage_limit INTEGER NOT NULL DEFAULT -1, -- -1=無制限, 0=表示のみ, N=N回まで
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE, -- NULLで無期限

  -- ステータス
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_transferable BOOLEAN NOT NULL DEFAULT FALSE,

  -- フラグ・属性（柔軟な拡張用JSONB）
  flags JSONB DEFAULT '[]'::jsonb,

  -- 発行・使用統計
  total_minted INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  max_supply INTEGER, -- NULLで無制限

  -- カテゴリ別詳細設定（JSONB）
  benefit_config JSONB,
  stamp_rally_config JSONB,
  membership_config JSONB,
  achievement_config JSONB,
  collectible_config JSONB, -- レアリティ機能は法務リスクのため実装しない

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_flag_nfts_tenant_id ON public.flag_nfts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flag_nfts_category ON public.flag_nfts(category);
CREATE INDEX IF NOT EXISTS idx_flag_nfts_is_active ON public.flag_nfts(is_active);

-- RLS (Row Level Security)
ALTER TABLE public.flag_nfts ENABLE ROW LEVEL SECURITY;

-- テナント管理者のみがCRUD可能
CREATE POLICY "Tenant admins can manage their flag NFTs"
  ON public.flag_nfts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true));

-- 全ユーザーが読み取り可能（アクティブなもののみ）
CREATE POLICY "Anyone can view active flag NFTs"
  ON public.flag_nfts
  FOR SELECT
  USING (is_active = true);

-- ===================================
-- 2. user_flag_nfts テーブル（ユーザー保有NFT）
-- ===================================
CREATE TABLE IF NOT EXISTS public.user_flag_nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- ウォレットアドレス
  flag_nft_id UUID NOT NULL REFERENCES public.flag_nfts(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL, -- オンチェーンNFTのトークンID

  -- 使用状況
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- スタンプラリー進捗（JSONB）
  stamp_progress JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,

  -- タイムスタンプ
  minted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ユニーク制約（同じユーザーが同じNFTを複数保有できないように）
  UNIQUE(user_id, flag_nft_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_flag_nfts_user_id ON public.user_flag_nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flag_nfts_flag_nft_id ON public.user_flag_nfts(flag_nft_id);

-- RLS
ALTER TABLE public.user_flag_nfts ENABLE ROW LEVEL SECURITY;

-- ユーザー自身のNFTのみ閲覧・更新可能
CREATE POLICY "Users can view their own flag NFTs"
  ON public.user_flag_nfts
  FOR SELECT
  USING (user_id = current_user);

CREATE POLICY "Users can update their own flag NFTs"
  ON public.user_flag_nfts
  FOR UPDATE
  USING (user_id = current_user);

-- ===================================
-- 3. nfc_tags テーブル（NFCタグ管理）
-- ===================================
CREATE TABLE IF NOT EXISTS public.nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL UNIQUE, -- 物理NFCタグのUID
  tenant_id TEXT NOT NULL,

  -- 割り当て情報
  checkpoint_id TEXT, -- 割り当てられたチェックポイントID
  flag_nft_id UUID REFERENCES public.flag_nfts(id) ON DELETE SET NULL,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ERROR')),

  -- 統計
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  total_scans INTEGER NOT NULL DEFAULT 0,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_nfc_tags_tenant_id ON public.nfc_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_tag_id ON public.nfc_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_flag_nft_id ON public.nfc_tags(flag_nft_id);

-- RLS
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;

-- テナント管理者のみが管理可能
CREATE POLICY "Tenant admins can manage their NFC tags"
  ON public.nfc_tags
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true));

-- ===================================
-- 4. stamp_check_ins テーブル（チェックイン履歴）
-- ===================================
CREATE TABLE IF NOT EXISTS public.stamp_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_flag_nft_id UUID NOT NULL REFERENCES public.user_flag_nfts(id) ON DELETE CASCADE,
  checkpoint_id TEXT NOT NULL,

  -- 検証情報
  verification_method TEXT NOT NULL CHECK (verification_method IN ('NFC', 'QR', 'MANUAL')),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  device_info TEXT,

  -- タイムスタンプ
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_stamp_check_ins_user_flag_nft_id ON public.stamp_check_ins(user_flag_nft_id);
CREATE INDEX IF NOT EXISTS idx_stamp_check_ins_checkpoint_id ON public.stamp_check_ins(checkpoint_id);

-- RLS
ALTER TABLE public.stamp_check_ins ENABLE ROW LEVEL SECURITY;

-- ユーザー自身のチェックイン履歴のみ閲覧可能
CREATE POLICY "Users can view their own check-ins"
  ON public.stamp_check_ins
  FOR SELECT
  USING (
    user_flag_nft_id IN (
      SELECT id FROM public.user_flag_nfts WHERE user_id = current_user
    )
  );

-- ===================================
-- 5. Functions & Triggers
-- ===================================

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- flag_nfts の updated_at トリガー
CREATE TRIGGER update_flag_nfts_updated_at
  BEFORE UPDATE ON public.flag_nfts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- nfc_tags の updated_at トリガー
CREATE TRIGGER update_nfc_tags_updated_at
  BEFORE UPDATE ON public.nfc_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- total_minted を自動インクリメントするトリガー関数
CREATE OR REPLACE FUNCTION increment_flag_nft_minted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.flag_nfts
  SET total_minted = total_minted + 1
  WHERE id = NEW.flag_nft_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_minted
  AFTER INSERT ON public.user_flag_nfts
  FOR EACH ROW
  EXECUTE FUNCTION increment_flag_nft_minted();
