# 🔥 Gifterraインデクサー セットアップガイド

## 📋 概要

このガイドでは、Gifterraの**二軸スコアシステム（💸Economic / 🔥Resonance）**を計算するインデクサーのセットアップ方法を説明します。

### 新しいkodomi計算式

```
kodomi (貢献熱量度) = (回数スコア + AI質的スコア) × (1 + 連続ボーナス)

- 回数スコア: ユーティリティトークンTIP回数 + EconomicトークンTIP回数（全トークン重み1.0）
- AI質的スコア: メッセージの感情分析（0-50、現在はデフォルト50で中立）
- 連続ボーナス: 7日ごとに10%加算
```

---

## 🚀 セットアップ手順

### ステップ1: Supabaseマイグレーション実行

Supabase Dashboard（SQL Editor）で以下の2つのSQLを実行してください:

#### 1-1. トークン種別TIP回数フィールド追加

```bash
# ファイル: supabase/migrations/20250129_add_token_type_tip_counts.sql
```

Supabase Dashboard で実行:
1. プロジェクトを開く
2. 左メニュー > **SQL Editor**
3. 上記ファイルの内容をコピー＆ペースト
4. **Run**ボタンをクリック

#### 1-2. TIPメッセージフィールド追加

```bash
# ファイル: supabase/migrations/20250129_add_tip_messages.sql
```

同様にSQL Editorで実行してください。

---

### ステップ2: 環境変数設定

`.env.indexer.example`を`.env.indexer`にコピーして編集:

```bash
cp .env.indexer.example .env.indexer
```

**必須設定項目:**

```env
# Supabase設定（Dashboard > Project Settings > API から取得）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# コントラクトアドレス（通常は変更不要）
GIFTERRA_ADDRESS=0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC
TOKEN_ADDRESS=0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29

# 初回実行設定
ENABLE_BACKFILL=true
START_BLOCK=12345678  # コントラクトデプロイブロックを指定

# インデクサー有効化（必須）
USE_GIFTERRA=true
```

---

### ステップ3: インデクサー起動

#### 初回実行（過去データの取得）

```bash
# 環境変数を読み込んでインデクサー起動
source .env.indexer
USE_GIFTERRA=true pnpm tsx src/indexer/index.ts
```

初回実行では、`ENABLE_BACKFILL=true`により過去のすべてのTIPイベントを取得します。

#### 通常実行（リアルタイム監視）

初回バックフィル完了後、`.env.indexer`を編集:

```env
ENABLE_BACKFILL=false  # バックフィルを無効化
```

その後、インデクサーを再起動:

```bash
source .env.indexer
USE_GIFTERRA=true pnpm tsx src/indexer/index.ts
```

---

### ステップ4: 動作確認

#### 4-1. ログ確認

コンソールに以下のようなログが表示されます:

```
🚀 Starting Gifterra Indexer...
📊 Initializing database...
✅ Loaded 1 token axes
🔄 Running backfill...
📦 Backfilling Tipped events blocks 12345678 - 12355678...
✅ Fetched 150 Tipped events
💸 Tipped: 0xabc... | 1000000000000000000
✅ TIP recorded for 0xabc...
```

#### 4-2. データベース確認

Supabase Dashboard > Table Editor で以下を確認:

- **user_scores**: ユーザースコアが更新されている
  - `resonance_utility_tips`: ユーティリティトークンTIP回数
  - `resonance_economic_tips`: EconomicトークンTIP回数
  - `resonance_score`: kodomiスコア
  - `economic_score`: 経済スコア
  - `composite_score`: 合成スコア

- **score_transactions**: TIPトランザクションが記録されている

#### 4-3. API確認

```bash
# ヘルスチェック
curl http://localhost:3001/api/health

# ユーザースコア取得
curl http://localhost:3001/api/profile/0xYourAddress

# ランキング取得
curl http://localhost:3001/api/rankings/composite?limit=10
```

---

## 📊 データ構造

### user_scores テーブル

| カラム名 | 説明 |
|---------|------|
| `economic_score` | 💸Economic軸スコア（正規化後） |
| `economic_level` | Economicレベル（0-100） |
| `resonance_score` | 🔥Resonance軸スコア（kodomi） |
| `resonance_level` | Resonanceレベル（0-100） |
| `resonance_utility_tips` | ユーティリティトークンTIP回数 |
| `resonance_economic_tips` | EconomicトークンTIP回数 |
| `resonance_streak` | 連続日数 |
| `composite_score` | 合成スコア |

### score_transactions テーブル

| カラム名 | 説明 |
|---------|------|
| `user_address` | ユーザーアドレス |
| `token_address` | トークンアドレス |
| `amount_raw` | 金額（wei単位） |
| `axis` | 軸（ECONOMIC / RESONANCE） |
| `trace_id` | トランザクションハッシュ |
| `message` | TIPメッセージ（将来実装） |
| `sentiment_score` | 感情スコア（0-100、現在デフォルト50） |

---

## 🔧 トラブルシューティング

### エラー: "SUPABASE_URL and SUPABASE_KEY environment variables are required"

`.env.indexer`ファイルが正しく読み込まれていません。

**解決方法:**
```bash
# 環境変数を明示的に設定
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-service-role-key
export USE_GIFTERRA=true
pnpm tsx src/indexer/index.ts
```

### エラー: "eth_getLogs returned more than 10000 results"

チャンクサイズが大きすぎます。

**解決方法:**
```env
BACKFILL_CHUNK_SIZE=5000  # デフォルト10000から減らす
```

### データが更新されない

インデクサーが正常に動作していても、フロントエンドに反映されない場合:

1. **Admin Dashboardのキャッシュクリア**: ブラウザのハードリロード（Ctrl+Shift+R / Cmd+Shift+R）
2. **Supabase Realtime確認**: `useSystemStats`フックがSupabase Realtimeをサブスクライブしているか確認
3. **APIエンドポイント確認**: `http://localhost:3001/api/profile/{address}`でデータが取得できるか確認

---

## 🚦 本番環境デプロイ

### プロセスマネージャーで常時稼働

#### PM2を使用する場合

```bash
# PM2インストール
npm install -g pm2

# インデクサー起動
pm2 start src/indexer/index.ts --name gifterra-indexer --interpreter tsx

# 自動起動設定
pm2 startup
pm2 save

# ログ確認
pm2 logs gifterra-indexer
```

#### systemdを使用する場合

`/etc/systemd/system/gifterra-indexer.service`:

```ini
[Unit]
Description=Gifterra Score Indexer
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/gifterra
EnvironmentFile=/path/to/gifterra/.env.indexer
ExecStart=/usr/bin/pnpm tsx src/indexer/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# サービス有効化
sudo systemctl enable gifterra-indexer
sudo systemctl start gifterra-indexer

# ログ確認
sudo journalctl -u gifterra-indexer -f
```

---

## 📈 パフォーマンス最適化

### データベースインデックス

マイグレーションで自動作成されますが、必要に応じて追加:

```sql
-- 高速検索用インデックス
CREATE INDEX IF NOT EXISTS idx_user_scores_address_composite
ON user_scores(address, composite_score DESC);

-- トランザクション検索用
CREATE INDEX IF NOT EXISTS idx_score_tx_user_timestamp
ON score_transactions(user_address, timestamp DESC);
```

### RPCレート制限対策

複数のRPC URLを設定してフォールバック:

```env
RPC_URL=https://rpc-amoy.polygon.technology
# フォールバック用（コード内で実装）
FALLBACK_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your-key
```

---

## 🔮 将来の拡張予定

### フェーズ2: メッセージ機能とAI分析統合

現在のコントラクト（Gifterra.sol）には`Tipped`イベントにメッセージフィールドがありません。将来の実装:

1. **コントラクト更新**:
   ```solidity
   event Tipped(address indexed from, uint256 amount, string message);
   ```

2. **AI分析統合**:
   ```typescript
   import { analyzeSentiment } from './lib/ai_analysis';

   // TIPイベント処理時
   if (event.message) {
     const sentiment = await analyzeSentiment(event.message);
     // sentiment_scoreとsentiment_labelをDBに保存
   }
   ```

3. **avgSentiment計算**:
   - 全メッセージのsentiment_scoreの平均を計算
   - normalizeResonanceScore()に渡してkodomiに反映

---

## 📞 サポート

問題が発生した場合:

1. **ログ確認**: インデクサーのコンソール出力を確認
2. **Supabase確認**: テーブルデータとログを確認
3. **Issue報告**: GitHubリポジトリにIssueを作成

---

## ✅ チェックリスト

- [ ] Supabaseマイグレーション実行完了
- [ ] `.env.indexer`ファイル作成・設定完了
- [ ] 初回バックフィル実行完了
- [ ] データベースにスコアが記録されていることを確認
- [ ] API エンドポイントが正常に動作することを確認
- [ ] 継続実行用に`ENABLE_BACKFILL=false`に変更
- [ ] プロセスマネージャーで常時稼働設定完了（本番環境）

---

**🎉 セットアップ完了！新しいkodomi計算システムが稼働しています。**
