# Gifterra Minimal Indexer

最小構成のイベントインデクサ。コントラクトイベントを購読し、JSON Lines形式でログ出力します。

## 目的

- コントラクトの主要イベントを購読
- SKU・traceId・tokenId 単位で見える化
- ローカル or テストネットで動作確認
- 既存CIに影響なし

## 対象イベント

### 1. GifterraPaySplitter
- `DonationReceived(address payer, address token, uint256 amount, bytes32 sku, bytes32 traceId)`

### 2. JourneyPass v1
- `FlagUpdated(uint256 tokenId, uint8 bit, bool value, address operator, bytes32 traceId)`
- `FlagsBatchUpdated(uint256 tokenId, uint256 setMask, uint256 clearMask, address operator, bytes32 traceId)`
- `MetadataUpdate(uint256 tokenId)` - 参考出力のみ

### 3. RewardNFT_v2
- `TokenMinted(address to, uint256 tokenId, string tokenURI, uint8 distributionType)`
- `AutomaticDistribution(address distributor, address recipient, uint256 tokenId, bytes32 triggerId)`

## 必要環境

- **Node.js**: 18.x 以上
- **依存パッケージ**: viem, dotenv

## インストール

```bash
cd tools/indexer
npm install
```

## 設定

### 1. 環境変数ファイルの作成

```bash
cp .env.sample .env
```

### 2. .env の編集

```env
# RPC Configuration
RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY

# Starting Block (leave empty for latest block)
START_BLOCK=

# Contract Addresses (leave empty to skip that contract)
SPLITTER_ADDRESS=0x...
JOURNEYPASS_ADDRESS=0x...
REWARDNFT_ADDRESS=0x...

# Confirmations (number of blocks to wait before considering finalized)
CONFIRMATIONS=5

# Polling interval (milliseconds)
POLL_INTERVAL_MS=5000

# Log Directory
LOG_DIR=./logs/indexer
```

### 環境変数の説明

| 変数 | 必須 | 説明 |
|------|------|------|
| `RPC_URL` | ✅ | RPC エンドポイント（HTTPS推奨） |
| `START_BLOCK` | ❌ | 開始ブロック番号（未設定=最新ブロックから） |
| `SPLITTER_ADDRESS` | ❌ | GifterraPaySplitter のアドレス（未設定=購読スキップ） |
| `JOURNEYPASS_ADDRESS` | ❌ | JourneyPass v1 のアドレス（未設定=購読スキップ） |
| `REWARDNFT_ADDRESS` | ❌ | RewardNFT_v2 のアドレス（未設定=購読スキップ） |
| `CONFIRMATIONS` | ❌ | ブロック確定待ち（デフォルト: 5） |
| `POLL_INTERVAL_MS` | ❌ | ポーリング間隔（デフォルト: 5000ms） |
| `LOG_DIR` | ❌ | ログ出力先ディレクトリ（デフォルト: ./logs/indexer） |

**重要**: アドレス未設定の場合、そのコントラクトは自動的にスキップされます。

## 使用方法

### 開発モード（継続的購読）

```bash
npm run indexer:dev
```

起動後、新規イベントを継続的に購読し、JSONL ファイルに追記します。

### ワンショットモード（テスト用）

```bash
npm run indexer:once
```

最新100ブロックのイベントを取得して終了します。

### 過去イベントの取得

`.env` に `START_BLOCK` を設定して起動：

```env
START_BLOCK=12345678
```

```bash
npm run indexer:dev
```

## 出力形式

### ファイル配置

```
logs/indexer/
├── 2025-10-24.splitter.jsonl
├── 2025-10-24.journeypass.jsonl
├── 2025-10-24.reward.jsonl
├── 2025-10-24.splitter.error.jsonl
└── 2025-10-24.journeypass.error.jsonl
```

### 正常ログ（.jsonl）

#### 共通ヘッダ

```json
{
  "timestamp": "2025-10-24T12:34:56.789Z",
  "chainId": 80001,
  "blockNumber": "12345678",
  "txHash": "0xabc123...",
  "logIndex": 0,
  "contract": "splitter"
}
```

#### splitter（DonationReceived）

```json
{
  "timestamp": "2025-10-24T12:34:56.789Z",
  "chainId": 80001,
  "blockNumber": "12345678",
  "txHash": "0xabc123...",
  "logIndex": 0,
  "contract": "splitter",
  "event": "DonationReceived",
  "payer": "0x1234...",
  "token": "0x0000000000000000000000000000000000000000",
  "amount": "1000000000000000000",
  "sku": "0x1234567890abcdef...",
  "traceId": "0xabcdef1234567890..."
}
```

#### journeypass（FlagUpdated）

```json
{
  "timestamp": "2025-10-24T12:34:56.789Z",
  "chainId": 80001,
  "blockNumber": "12345679",
  "txHash": "0xdef456...",
  "logIndex": 1,
  "contract": "journeypass",
  "event": "FlagUpdated",
  "tokenId": "123",
  "bit": 0,
  "value": true,
  "operator": "0x5678...",
  "traceId": "0x9876543210fedcba..."
}
```

#### reward（TokenMinted）

```json
{
  "timestamp": "2025-10-24T12:34:56.789Z",
  "chainId": 80001,
  "blockNumber": "12345680",
  "txHash": "0xghi789...",
  "logIndex": 2,
  "contract": "reward",
  "event": "TokenMinted",
  "to": "0x9abc...",
  "tokenId": "456",
  "tokenURI": "https://api.example.com/metadata/456",
  "distributionType": 0
}
```

### エラーログ（.error.jsonl）

```json
{
  "timestamp": "2025-10-24T12:34:56.789Z",
  "contract": "journeypass",
  "error": "ABI_DECODE_FAILED",
  "message": "Failed to decode event, logging raw data",
  "rawLog": {
    "address": "0x...",
    "topics": ["0x..."],
    "data": "0x..."
  }
}
```

## よくある問題と対処

### 1. RPC_URL is required

**原因**: `.env` ファイルが存在しないか、`RPC_URL` が設定されていません。

**対処**:
```bash
cp .env.sample .env
# .env を編集して RPC_URL を設定
```

### 2. RPC 429 エラー（レート制限）

**原因**: RPC プロバイダのレート制限に達しました。

**対処**:
- `POLL_INTERVAL_MS` を大きくする（例: 10000ms）
- `CONFIRMATIONS` を増やす
- 有料プランにアップグレード

### 3. ABI decode failed

**原因**: コントラクトのABIが実際のイベントと一致しません。

**対処**:
- エラーログ（`.error.jsonl`）を確認
- コントラクトアドレスが正しいか確認
- コントラクトのバージョンを確認

### 4. プロセスが停止する

**原因**: RPC エラーやその他の予期しないエラー。

**対処**:
- エラーログを確認
- RPC エンドポイントの状態を確認
- ネットワーク接続を確認

### 5. 重複イベントが出力される

**原因**: プロセス再起動時の重複（現在のバージョンでは許容）。

**対処**:
- 将来のバージョンで永続的な重複排除を実装予定
- 現時点では `txHash + logIndex` でユニーク判定

## データ分析例

### 1. 特定SKUの寄付を集計

```bash
cat logs/indexer/2025-10-24.splitter.jsonl | \
  jq -r 'select(.sku == "0x1234567890abcdef...") | .amount' | \
  awk '{sum+=$1} END {print sum}'
```

### 2. 特定tokenIdのフラグ履歴

```bash
cat logs/indexer/2025-10-24.journeypass.jsonl | \
  jq 'select(.tokenId == "123")'
```

### 3. 配布タイプ別のNFT数

```bash
cat logs/indexer/2025-10-24.reward.jsonl | \
  jq -r '.distributionType' | \
  sort | uniq -c
```

## 将来の拡張（TODO）

現在のバージョンでは実装していませんが、以下の機能を将来追加予定：

### 永続的な重複排除

```javascript
// TODO: SQLite or LevelDB for persistent deduplication
// Current: In-memory Set (lost on restart)
```

### The Graph / Subsquid への移行

```javascript
// TODO: Consider migrating to The Graph or Subsquid
// for production-grade indexing infrastructure
```

### ダッシュボード

```javascript
// TODO: Create dashboard (Next.js or CLI TUI)
// for real-time event visualization
```

### JSONLローテーション

```javascript
// TODO: Implement automatic log rotation
// Current: Daily file creation
```

## トラブルシューティング

### ログファイルの確認

```bash
# 最新のイベント
tail -f logs/indexer/2025-10-24.splitter.jsonl

# エラーログ
tail -f logs/indexer/2025-10-24.splitter.error.jsonl

# すべてのイベント数
wc -l logs/indexer/*.jsonl
```

### デバッグモード

```bash
# より詳細なログ出力（将来実装予定）
DEBUG=* npm run indexer:dev
```

## ライセンス

MIT License

## サポート

問題が発生した場合は、GitHub Issues で報告してください。
