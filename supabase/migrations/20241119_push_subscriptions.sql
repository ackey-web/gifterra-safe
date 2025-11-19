-- プッシュ通知購読情報テーブル
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_wallet ON push_subscriptions(wallet_address);

-- RLS (Row Level Security) ポリシー
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー: 自分の購読情報のみ
CREATE POLICY "Users can view own subscriptions" ON push_subscriptions
  FOR SELECT USING (true);

-- 挿入ポリシー: 認証済みユーザー
CREATE POLICY "Users can insert own subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- 更新ポリシー: 自分の購読情報のみ
CREATE POLICY "Users can update own subscriptions" ON push_subscriptions
  FOR UPDATE USING (true);

-- 削除ポリシー: 自分の購読情報のみ
CREATE POLICY "Users can delete own subscriptions" ON push_subscriptions
  FOR DELETE USING (true);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
