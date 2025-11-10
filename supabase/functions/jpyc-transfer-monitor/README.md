# JPYC Transfer Monitor

JPYC（Polygon）のTransferイベントを監視し、受信通知を自動生成するSupabase Edge Function。

## 機能

- Polygon MainnetのJPYC Transfer イベントを監視
- 新しいJPYC受信を検知したら自動的に通知を作成
- 5分ごとに定期実行（cron）
- 重複通知の防止
- 処理済みブロック番号の記録

## 必要な環境変数

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## デプロイ方法

```bash
# Edge Functionをデプロイ
supabase functions deploy jpyc-transfer-monitor

# 環境変数を設定
supabase secrets set SUPABASE_URL=your-supabase-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 手動実行（テスト）

```bash
# ローカルで実行
supabase functions serve jpyc-transfer-monitor

# 別のターミナルから実行
curl -i --location --request POST 'http://localhost:54321/functions/v1/jpyc-transfer-monitor' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

## デプロイ後の手動実行

```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/jpyc-transfer-monitor' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

## データベーステーブル

### `jpyc_monitor_state`
最後に処理したブロック番号を記録

```sql
CREATE TABLE jpyc_monitor_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_block_number bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);
```

### `notifications`
作成される通知レコード（既存テーブル）

## 動作フロー

1. 最後に処理したブロック番号を取得
2. Polygon RPCから最新ブロック番号を取得
3. 未処理ブロック範囲のTransferイベントを取得
4. 各Transferイベントについて:
   - 受信者に通知レコードを作成（重複チェック済み）
   - 送信者には通知を作成しない
5. 処理済みブロック番号を更新

## 注意事項

- 初回実行時は過去100ブロックから処理を開始
- Polygon RPCの無料プランではレート制限があるため、大量のイベントがある場合は注意
- cronは5分間隔で実行されるため、リアルタイム性は最大5分の遅延がある
