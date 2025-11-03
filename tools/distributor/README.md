# GifterraDistributor v1

**オフチェーンWorker** による自動NFT配布システム

## 概要

GifterraDistributor は、インデクサーが出力する JSONL ファイルを監視し、定義されたルールに基づいて自動的に RewardNFT を配布する常駐プロセスです。

### 主な機能

- **JSONL ファイル監視**: `tools/indexer` が出力するイベントログをリアルタイムで監視
- **ルールベース配布**: 柔軟なルールDSLで配布条件を定義
- **Idempotency保証**: txHash + logIndex による重複実行防止
- **リトライ機構**: 失敗時の自動リトライ（指数バックオフ）
- **エラーロギング**: 失敗した配布をJSONL形式で記録

### アーキテクチャ

```
┌─────────────────┐
│ PaySplitter     │──┐
│ JourneyPass v1  │  │ Events
│ RewardNFT_v2    │  │
└─────────────────┘  │
                     ▼
              ┌─────────────┐
              │  Indexer    │
              │ (JSONL出力) │
              └─────────────┘
                     │
                     │ File Watch
                     ▼
              ┌─────────────┐        ┌──────────────┐
              │ Distributor │───────▶│ RewardNFT_v2 │
              │  (Worker)   │ Mint   │ (Contract)   │
              └─────────────┘        └──────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Error Logs  │
              │  (JSONL)    │
              └─────────────┘
```

---

## セットアップ

### 1. 依存関係のインストール

```bash
cd tools/distributor
npm install
```

### 2. 環境変数の設定

`.env.sample` をコピーして `.env` を作成：

```bash
cp .env.sample .env
```

`.env` を編集して必須項目を設定：

```bash
# 必須
RPC_URL=https://rpc-amoy.polygon.technology/
REWARDNFT_ADDRESS=0x...  # RewardNFT_v2 のデプロイアドレス
DISTRIBUTOR_WALLET_KEY=0x...  # DISTRIBUTOR_ROLE を持つウォレットの秘密鍵

# FlagUpdated イベントを使う場合のみ必須
JOURNEYPASS_ADDRESS=0x...  # JourneyPass v1 のデプロイアドレス
```

**⚠️ セキュリティ警告**:
- `.env` ファイルは **絶対に Git にコミットしないでください**
- 本番環境では AWS Secrets Manager や HashiCorp Vault などのシークレット管理サービスを使用してください

### 3. ルール設定

`config/rules.json` を編集して配布ルールを定義します（詳細は後述）。

---

## 起動方法

### 開発モード（常駐）

```bash
npm run distributor:dev
```

起動すると、以下のように動作します：

```
🚀 GifterraDistributor v1 starting...
✅ Configuration validated
📡 RPC: https://rpc-amoy.polygon.technology/
🎁 RewardNFT: 0x1234...
📜 Rules: ./config/rules.json
📂 Indexer logs: ../indexer/logs/indexer
✅ Loaded 0 processed events from state
✅ Initialized clients
🔑 Distributor address: 0x5678...
✅ Loaded 6 rules from ./config/rules.json
🔄 Starting polling loop...
```

### テストモード（直近100行のみ処理）

```bash
npm run distributor:test
```

テストモードでは、最新のJSONLファイルを1回だけ処理して終了します。

### 停止方法

`Ctrl+C` で正常終了します：

```
^C
🛑 Shutting down...
💾 State saved
```

---

## ルールDSL（Domain Specific Language）

### ルール構造

`config/rules.json` は以下の形式の配列です：

```json
[
  {
    "description": "ルールの説明（任意）",
    "trigger": "DonationReceived | FlagUpdated",
    "match": {
      // マッチ条件（イベントタイプによって異なる）
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x...",  // 任意
      "tokenURIOverride": "ipfs://..."  // 任意（未実装）
    }
  }
]
```

### DonationReceived のマッチ条件

```json
{
  "trigger": "DonationReceived",
  "match": {
    "sku": "0x...",           // 任意: 特定SKUのみマッチ
    "token": "0x...",         // 任意: 特定トークンのみマッチ（0x000...=native）
    "minAmount": "1000...",   // 任意: 最小寄付額（wei単位、文字列）
    "traceId": "0x..."        // 任意: 特定traceIdのみマッチ
  },
  "action": {
    "type": "reward_mint",
    "sku": "0x..."  // 配布するNFTのSKU（指定しない場合は寄付時のSKUを流用）
  }
}
```

### FlagUpdated のマッチ条件

```json
{
  "trigger": "FlagUpdated",
  "match": {
    "bit": 0,           // 任意: 特定ビット番号のみマッチ
    "value": true,      // 任意: フラグの値（true/false）
    "traceId": "0x..."  // 任意: 特定traceIdのみマッチ
  },
  "action": {
    "type": "reward_mint",
    "sku": "0x..."  // 配布するNFTのSKU
  }
}
```

---

## サンプルルール

### 1. 寄付金額に応じた段階的配布

```json
[
  {
    "description": "1,000 tNHT以上の寄付で Bronze NFT 配布",
    "trigger": "DonationReceived",
    "match": {
      "minAmount": "1000000000000000000000"
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x444f4e4154494f4e5f42524f4e5a45000000000000000000000000000000000"
    }
  },
  {
    "description": "10,000 tNHT以上の寄付で Silver NFT 配布",
    "trigger": "DonationReceived",
    "match": {
      "minAmount": "10000000000000000000000"
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x444f4e4154494f4e5f53494c564552000000000000000000000000000000000"
    }
  },
  {
    "description": "100,000 tNHT以上の寄付で Gold NFT 配布",
    "trigger": "DonationReceived",
    "match": {
      "minAmount": "100000000000000000000000"
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x444f4e4154494f4e5f474f4c44000000000000000000000000000000000000"
    }
  }
]
```

**注意**: 複数のルールにマッチする場合、すべてのルールが実行されます。上記の例では、100,000 tNHT の寄付は 3つすべてのNFTが配布されます。

### 2. 特定SKUの商品購入に対する特典配布

```json
{
  "description": "限定商品購入者に特別NFT配布",
  "trigger": "DonationReceived",
  "match": {
    "sku": "0x5350454349414c5f50524f4455435400000000000000000000000000000000",
    "minAmount": "100000000000000000"
  },
  "action": {
    "type": "reward_mint",
    "sku": "0x5350454349414c5f524557415244000000000000000000000000000000000000"
  }
}
```

### 3. JourneyPass のマイルストーン達成報酬

```json
[
  {
    "description": "初回訪問記念NFT（フラグ0）",
    "trigger": "FlagUpdated",
    "match": {
      "bit": 0,
      "value": true
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x4a4f55524e45595f464952535400000000000000000000000000000000000000"
    }
  },
  {
    "description": "スタンプラリーコンプリート記念NFT（フラグ7）",
    "trigger": "FlagUpdated",
    "match": {
      "bit": 7,
      "value": true
    },
    "action": {
      "type": "reward_mint",
      "sku": "0x4a4f55524e45595f434f4d504c455445000000000000000000000000000000"
    }
  }
]
```

---

## SKU（bytes32）の生成方法

SKU は bytes32 形式で指定します。以下の方法で生成できます：

### JavaScript/Node.js

```javascript
const { ethers } = require('ethers');

// 文字列からbytes32に変換
const sku = ethers.encodeBytes32String('DONATION_BRONZE');
console.log(sku);
// 出力: 0x444f4e4154494f4e5f42524f4e5a45000000000000000000000000000000000

// bytes32から文字列に戻す
const decoded = ethers.decodeBytes32String(sku);
console.log(decoded);
// 出力: DONATION_BRONZE
```

### オンラインツール

https://emn178.github.io/online-tools/keccak_256.html

手動で16進数に変換する場合は、ASCII表を参照してください。

**制限事項**: 最大31バイト（31文字）まで

---

## 動作フロー

### 1. イベント検知

インデクサーが出力した JSONL ファイルを定期的にポーリング（デフォルト: 2秒間隔）。

```jsonl
{"timestamp":"2025-01-24T12:34:56.789Z","contract":"splitter","eventName":"DonationReceived","blockNumber":12345680,"txHash":"0xabc123...","logIndex":2,"args":{"payer":"0x1234...","token":"0x0000000000000000000000000000000000000000","amount":"5000000000000000000000","sku":"0x534b553030310000...","traceId":"0x5452414345303031..."}}
```

### 2. ルール評価

検知したイベントを `config/rules.json` のすべてのルールと照合。

```
✨ Event matched 1 rule(s): {
  contract: 'splitter',
  eventName: 'DonationReceived',
  txHash: '0xabc123...',
  logIndex: 2
}
```

### 3. 重複チェック

`txHash + logIndex` で idempotency key を生成し、既に処理済みか確認。

### 4. 配布実行

RewardNFT_v2 の `distributeMintBySku` 関数を呼び出し：

```javascript
distributeMintBySku(
  recipient,  // DonationReceived: payer / FlagUpdated: tokenのowner
  sku,        // action.sku または event.sku
  triggerId   // txHash + logIndex を bytes32 に圧縮
)
```

```
🎁 Executing distribution: {
  recipient: '0x1234...',
  sku: '0x444f4e4154494f4e5f42524f4e5a45...',
  triggerId: '0xabc123...0002'
}
✅ Distribution transaction sent: 0xdef456...
🎉 Distribution successful! Block: 12345685
```

### 5. リトライ（失敗時）

失敗した場合は指数バックオフでリトライ（最大3回、デフォルト）：

```
❌ Distribution failed (attempt 1/3): insufficient funds
⏳ Retrying in 1000ms...
❌ Distribution failed (attempt 2/3): insufficient funds
⏳ Retrying in 2000ms...
❌ Distribution failed (attempt 3/3): insufficient funds
❌ Max retries exceeded, logging to error file
```

エラーは `./logs/YYYY-MM-DD.distributor.error.jsonl` に記録されます。

---

## State 管理

### processed.json

処理済みイベントを記録し、再起動時に重複処理を防ぎます。

**保存場所**: `./state/processed.json`

**内容例**:

```json
{
  "processedEvents": [
    "0xabc123...def:0",
    "0xabc123...def:1",
    "0x456...789:0"
  ],
  "filePositions": {},
  "lastSaved": "2025-01-24T12:45:00.000Z"
}
```

**自動保存**:
- 10イベント処理ごと
- 1分ごと
- 正常終了時（Ctrl+C）

---

## エラーログ

### ログファイル

**保存場所**: `./logs/YYYY-MM-DD.distributor.error.jsonl`

**日次ローテーション**: 日付が変わると新しいファイルが作成されます。

### エラータイプ

#### 1. distribution_failure

配布トランザクションの失敗：

```json
{
  "timestamp": "2025-01-24T12:40:00.000Z",
  "type": "distribution_failure",
  "event": {
    "contract": "splitter",
    "eventName": "DonationReceived",
    "txHash": "0xabc...",
    "logIndex": 2,
    "blockNumber": 12345680
  },
  "rule": {
    "trigger": "DonationReceived",
    "action": {
      "type": "reward_mint",
      "sku": "0x444f..."
    }
  },
  "error": "insufficient funds for gas * price + value",
  "attempts": 3
}
```

#### 2. rule_evaluation_error

ルール評価中のエラー：

```json
{
  "timestamp": "2025-01-24T12:41:00.000Z",
  "type": "rule_evaluation_error",
  "event": {
    "contract": "journeypass",
    "eventName": "FlagUpdated",
    "txHash": "0xdef...",
    "logIndex": 0
  },
  "error": "JOURNEYPASS_ADDRESS not configured for FlagUpdated event"
}
```

#### 3. transaction_error

トランザクション実行エラー：

```json
{
  "timestamp": "2025-01-24T12:42:00.000Z",
  "type": "transaction_error",
  "txHash": "0xghi...",
  "error": "Transaction reverted: 0xghi...",
  "context": {}
}
```

---

## トラブルシューティング

### 1. "DISTRIBUTOR_WALLET_KEY is required"

**原因**: `.env` ファイルが設定されていない、または必須項目が欠落している。

**解決方法**:
```bash
cp .env.sample .env
# .env を編集して必須項目を設定
```

### 2. "AccessControl: account 0x... is missing role 0x..."

**原因**: Distributor ウォレットに `DISTRIBUTOR_ROLE` が付与されていない。

**解決方法**:
```bash
# Hardhat console で実行（RewardNFT_v2のデプロイアカウントで）
const rewardNFT = await ethers.getContractAt("RewardNFT_v2", "0x...");
const DISTRIBUTOR_ROLE = await rewardNFT.DISTRIBUTOR_ROLE();
await rewardNFT.grantRole(DISTRIBUTOR_ROLE, "0x..."); // Distributor address
```

### 3. "insufficient funds for gas"

**原因**: Distributor ウォレットの残高不足。

**解決方法**:
- テストネットの場合: Faucet から tMATIC を取得
- メインネットの場合: ウォレットに MATIC を送金

### 4. イベントが検知されない

**チェックリスト**:
- [ ] インデクサーが正常に動作しているか？
- [ ] JSONL ファイルが生成されているか？（`../indexer/logs/indexer/`）
- [ ] `INDEXER_LOG_DIR` が正しく設定されているか？
- [ ] ルールの `match` 条件が正しいか？

**デバッグ**:
```bash
# 最新のJSONLファイルを確認
ls -lt ../indexer/logs/indexer/

# ファイル内容を確認
tail -f ../indexer/logs/indexer/2025-01-24.splitter.jsonl

# ルールを確認
cat config/rules.json | jq
```

### 5. 同じイベントが複数回配布される

**原因**: State ファイルが削除された、または異なるプロセスが複数起動している。

**解決方法**:
- `./state/processed.json` を削除しない
- 同時に複数の Distributor プロセスを起動しない
- 本番環境では、プロセスマネージャー（PM2, systemd）を使用して単一プロセスを保証

---

## 本番運用時の推奨事項

### 1. プロセス管理

**PM2 を使用**:

```bash
npm install -g pm2

# 起動
pm2 start index.js --name distributor

# ログ確認
pm2 logs distributor

# 再起動
pm2 restart distributor

# 自動起動設定
pm2 startup
pm2 save
```

### 2. シークレット管理

`.env` ファイルに秘密鍵を保存するのは開発環境のみにし、本番環境では以下を使用：

- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Google Cloud Secret Manager**
- **Azure Key Vault**

### 3. モニタリング

- プロセスの稼働状況を監視（PM2 + Datadog など）
- エラーログをアラート対象に設定
- 配布成功率を追跡

### 4. ログローテーション

エラーログのディスク容量を管理：

```bash
# logrotate 設定例 (/etc/logrotate.d/gifterra-distributor)
/path/to/tools/distributor/logs/*.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
}
```

### 5. State のバックアップ

`./state/processed.json` を定期的にバックアップ：

```bash
# cron で毎時バックアップ
0 * * * * cp /path/to/tools/distributor/state/processed.json /backup/processed-$(date +\%Y\%m\%d-\%H).json
```

---

## 拡張例

### カスタムアクションの追加

`index.js` の `processMatchedEvent` 関数を拡張して、新しいアクションタイプを追加できます：

```javascript
if (action.type === 'reward_mint') {
  // 既存の実装
} else if (action.type === 'send_notification') {
  // 通知送信の実装
  await sendNotification(recipient, action.message);
} else if (action.type === 'update_kodomi') {
  // Kodomi プロファイル更新の実装
  await updateKodomiProfile(recipient, action.points);
}
```

### 複雑な条件の追加

`rules.js` の `matchDonationReceived` / `matchFlagUpdated` 関数を拡張：

```javascript
// 日時条件の追加例
if (match.afterDate) {
  const eventDate = new Date(event.timestamp);
  const afterDate = new Date(match.afterDate);
  if (eventDate < afterDate) {
    return false;
  }
}

// 金額範囲の追加例
if (match.maxAmount) {
  const eventAmount = BigInt(args.amount);
  const maxAmount = BigInt(match.maxAmount);
  if (eventAmount > maxAmount) {
    return false;
  }
}
```

---

## パフォーマンス

### ベンチマーク（参考値）

- **イベント処理**: 約 100 events/sec（ルール評価のみ）
- **配布実行**: 約 1-2 tx/sec（RPC・ガス価格依存）
- **メモリ使用量**: 約 50-100 MB（100万イベント処理済みの場合）

### チューニング

```bash
# ポーリング間隔を調整
POLL_INTERVAL_MS=5000  # 5秒（負荷軽減）

# リトライ設定を調整
RETRY_MAX_ATTEMPTS=5
RETRY_INITIAL_DELAY_MS=2000
```

---

## ライセンス

MIT

---

## サポート

問題が発生した場合は、以下のログを添えて報告してください：

1. Distributor のコンソール出力
2. `./logs/YYYY-MM-DD.distributor.error.jsonl`
3. `./state/processed.json`（個人情報を除く）
4. 該当する JSONL イベント（`../indexer/logs/indexer/`）

---

**最終更新**: 2025-01-24
**バージョン**: v1.0.0
