-- JPYC Monitor 状態管理テーブル
-- Edge Function が最後に処理したブロック番号を記録する

CREATE TABLE IF NOT EXISTS jpyc_monitor_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_block_number bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 初期レコードを挿入
INSERT INTO jpyc_monitor_state (id, last_block_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- コメント
COMMENT ON TABLE jpyc_monitor_state IS 'JPYC Transfer Monitor の状態管理（最後に処理したブロック番号）';
COMMENT ON COLUMN jpyc_monitor_state.last_block_number IS '最後に処理したブロック番号';
