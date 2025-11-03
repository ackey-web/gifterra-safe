# インデクサー実機テスト手順書（E2Eチェックリスト）

本ドキュメントは、`tools/indexer` の実機テストを行うための手順書です。
テストネットまたはローカルノードの両方に対応しており、コントラクトがまだデプロイされていない場合でも検証可能な構成になっています。

---

## A. 前提

### テストモードの選択

以下の2つのモードから選択してください：

#### 1) テストネットモード（推奨）

- 各コントラクトが既にテストネット（Polygon Amoy等）にデプロイ済み
- 実際のブロックチェーン環境で動作確認
- ネットワーク遅延や確認ブロック数の挙動を確認可能

#### 2) ローカルモード

- Anvil/Hardhat のローカルノードに一時デプロイして検証
- テストネット未デプロイでも即座に検証可能
- 高速なイテレーション（ブロック生成が即座）

---

### .env サンプル

`tools/indexer/.env` を以下のように設定します：

```bash
# ============================================
# テストネットモード用設定例
# ============================================
RPC_URL=https://rpc-amoy.polygon.technology/
START_BLOCK=12345678
CONFIRMATIONS=5
POLL_INTERVAL_MS=5000
LOG_DIR=./logs/indexer

# コントラクトアドレス（デプロイ済みのものを設定）
SPLITTER_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
JOURNEYPASS_ADDRESS=0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
REWARDNFT_ADDRESS=0xfedcba9876543210fedcba9876543210fedcba98

# ============================================
# ローカルモード用設定例
# ============================================
# RPC_URL=http://127.0.0.1:8545
# START_BLOCK=0
# CONFIRMATIONS=1
# POLL_INTERVAL_MS=2000
# LOG_DIR=./logs/indexer

# SPLITTER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
# JOURNEYPASS_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
# REWARDNFT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

**重要な注意事項**：
- アドレスが未設定（またはコメントアウト）のコントラクトは購読スキップされます
- `RPC_URL` は必須です（未設定の場合は起動時にエラー）
- すべてのコントラクトを省略可能（部分的なテストも可能）

---

## B. セットアップ

### 1. 依存関係のインストール

```bash
cd tools/indexer
npm install
```

### 2. 環境変数の設定

`.env.sample` をコピーして `.env` を作成し、上記サンプルを参考に設定します：

```bash
cp .env.sample .env
# エディタで .env を編集
```

### 3. START_BLOCK の推奨設定

- **テストネットモード**：直近の確定ブロック番号（例：現在のブロック - 100）
- **ローカルモード**：`0`（最初のブロックから）
- **未設定の場合**：現在のブロックから購読開始（履歴イベントなし）

**取得方法**：
```bash
# ethers.js を使う場合
npx hardhat console --network amoy
> await ethers.provider.getBlockNumber()

# RPCを直接叩く場合
curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 4. CONFIRMATIONS の推奨値

| 環境 | 推奨値 | 理由 |
|------|--------|------|
| ローカルノード | 1 | ブロックの巻き戻りがない |
| テストネット | 3-5 | チェーン再編成のリスクを軽減 |
| メインネット | 12以上 | より高い安全性（本番運用時） |

---

## C. 実行手順（テストネットモード）

### 前提条件

- 各コントラクトがテストネットにデプロイ済み
- デプロイアカウントの秘密鍵が手元にある
- テストネットの native token（例：tMATIC）を保有

### 1. インデクサーの起動

```bash
cd tools/indexer
npm run indexer:dev
```

**起動時の出力例**：
```
🚀 Indexer started
📡 RPC: https://rpc-amoy.polygon.technology/
🔍 Syncing from block: 12345678
✅ Watching GifterraPaySplitter at 0x1234...
✅ Watching JourneyPass at 0xabcd...
✅ Watching RewardNFT_v2 at 0xfedc...
🔄 Starting polling loop...
```

### 2. PaySplitter のイベント発火

**2-1. donateNative（直送ETH）のテスト**

```bash
# Hardhat scriptまたはethersjsで実行
const tx = await splitter.donateNative(
  ethers.encodeBytes32String("SKU001"),
  ethers.encodeBytes32String("TRACE001"),
  { value: ethers.parseEther("0.001") }
);
await tx.wait();
console.log("TxHash:", tx.hash);
```

**記録項目**：
- TxHash: `0xabc...`
- 期待されるイベント: `DonationReceived(payer, address(0), 1000000000000000, "SKU001", "TRACE001")`

**2-2. donateERC20 のテスト**

```bash
# ERC20トークンのapprove後
const tx = await splitter.donateERC20(
  tokenAddress,
  ethers.parseUnits("10", 18),
  ethers.encodeBytes32String("SKU002"),
  ethers.encodeBytes32String("TRACE002")
);
await tx.wait();
console.log("TxHash:", tx.hash);
```

### 3. JourneyPass v1 のイベント発火

**3-1. setFlag のテスト**

```bash
const tx = await journeyPass.setFlag(
  1, // tokenId
  0, // bit
  true, // value
  ethers.encodeBytes32String("TRACE003")
);
await tx.wait();
console.log("TxHash:", tx.hash);
```

**期待されるイベント**：
- `FlagUpdated(1, 0, true, msg.sender, "TRACE003")`
- `MetadataUpdate(1)`

**3-2. setFlagsByMask のテスト**

```bash
const tx = await journeyPass.setFlagsByMask(
  1, // tokenId
  "0x0000000000000000000000000000000000000000000000000000000000000003", // mask (bit 0,1)
  ethers.encodeBytes32String("TRACE004")
);
await tx.wait();
console.log("TxHash:", tx.hash);
```

**期待されるイベント**：
- `FlagsBatchUpdated(1, mask, msg.sender, "TRACE004")`
- `MetadataUpdate(1)`

### 4. RewardNFT_v2 のイベント発火

**4-1. 管理者ミント（manual）**

```bash
const tx = await rewardNFT.mint(
  userAddress,
  "ipfs://QmExample123"
);
await tx.wait();
console.log("TxHash:", tx.hash);
```

**期待されるイベント**：
- `TokenMinted(tokenId, userAddress, 1, bytes32(0), "ipfs://...")`
  - `distributionType = 1` (MANUAL)

**4-2. publicMintV2 のテスト**

```bash
const tx = await rewardNFT.publicMintV2(2); // 2個ミント
await tx.wait();
console.log("TxHash:", tx.hash);
```

**期待されるイベント**（2回発火）：
- `TokenMinted(tokenId1, msg.sender, 2, bytes32(0), "")`
- `TokenMinted(tokenId2, msg.sender, 2, bytes32(0), "")`
  - `distributionType = 2` (PUBLIC)

### 5. TxHash の控え方

各トランザクションのハッシュをメモしておき、以下の情報を確認できるようにします：

```bash
# etherscan等で確認
- Chain ID
- Block Number
- Log Index
- Event Name
- Parameters
```

---

## D. 実行手順（ローカルモード）

### 目的

テストネット未デプロイでも即座にインデクサーの動作を検証できるようにします。

### 前提条件

- Hardhat または Foundry（Anvil）がインストール済み
- **既存リポのスクリプトを使用**（リポ本体の改変はしない）

### 1. ローカルノードの起動

#### Anvil を使う場合

```bash
# 別ターミナルで実行
anvil --chain-id 31337 --block-time 2
```

#### Hardhat を使う場合

```bash
# 別ターミナルで実行
npx hardhat node
```

**起動確認**：
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`

### 2. コントラクトのデプロイ

**既存のデプロイスクリプトを使用**（例：`scripts/deploy-local.ts` がある場合）：

```bash
npx hardhat run scripts/deploy-local.ts --network localhost
```

**スクリプトがない場合**（Hardhat console で手動デプロイ）：

```bash
npx hardhat console --network localhost

# GifterraPaySplitter のデプロイ
> const Splitter = await ethers.getContractFactory("GifterraPaySplitter");
> const splitter = await Splitter.deploy([account1], [100]);
> await splitter.deployed();
> console.log("Splitter:", splitter.address);

# JourneyPass v1 のデプロイ
> const JPass = await ethers.getContractFactory("JourneyPass");
> const jpass = await JPass.deploy();
> await jpass.deployed();
> console.log("JourneyPass:", jpass.address);

# RewardNFT_v2 のデプロイ
> const Reward = await ethers.getContractFactory("RewardNFT_v2");
> const reward = await Reward.deploy("RewardNFT", "RNFT", "https://example.com/");
> await reward.deployed();
> console.log("RewardNFT:", reward.address);
```

### 3. .env の更新

デプロイしたアドレスを `.env` に反映：

```bash
# tools/indexer/.env
RPC_URL=http://127.0.0.1:8545
START_BLOCK=0
CONFIRMATIONS=1
POLL_INTERVAL_MS=2000

SPLITTER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
JOURNEYPASS_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
REWARDNFT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

### 4. インデクサーの起動

```bash
cd tools/indexer
npm run indexer:dev
```

### 5. イベント発火（ローカル用）

**C章と同じ手順**を Hardhat console で実行：

```javascript
// Hardhat console
const splitter = await ethers.getContractAt("GifterraPaySplitter", "0x5FbDB...");

// donateNative
await splitter.donateNative(
  ethers.encodeBytes32String("SKU001"),
  ethers.encodeBytes32String("TRACE001"),
  { value: ethers.parseEther("0.001") }
);

// JourneyPass
const jpass = await ethers.getContractAt("JourneyPass", "0xe7f17...");
await jpass.mint(userAddress);
await jpass.setFlag(1, 0, true, ethers.encodeBytes32String("TRACE003"));

// RewardNFT
const reward = await ethers.getContractAt("RewardNFT_v2", "0x9fE46...");
await reward.mint(userAddress, "ipfs://test");
```

---

## E. 期待結果（JSONLサンプル）

### ファイル配置

インデクサーが正常に動作すると、以下のファイルが生成されます：

```
tools/indexer/logs/indexer/
├── 2025-01-24.splitter.jsonl
├── 2025-01-24.journeypass.jsonl
├── 2025-01-24.reward.jsonl
└── 2025-01-24.splitter.error.jsonl  # エラー発生時のみ
```

### 1. splitter - DonationReceived

**ファイル**: `YYYY-MM-DD.splitter.jsonl`

```json
{"timestamp":"2025-01-24T12:34:56.789Z","contract":"splitter","eventName":"DonationReceived","blockNumber":12345680,"txHash":"0xabc123...","logIndex":2,"args":{"payer":"0x1234...","token":"0x0000000000000000000000000000000000000000","amount":"1000000000000000","sku":"0x534b553030310000000000000000000000000000000000000000000000000000","traceId":"0x5452414345303031000000000000000000000000000000000000000000000000"}}
```

**確認ポイント**：
- `token: "0x000..."` → native currency（ETH/MATIC）
- `sku` と `traceId` が bytes32 形式でエンコード済み
- `amount` は wei 単位の文字列

### 2. journeypass - FlagUpdated

**ファイル**: `YYYY-MM-DD.journeypass.jsonl`

```json
{"timestamp":"2025-01-24T12:35:10.123Z","contract":"journeypass","eventName":"FlagUpdated","blockNumber":12345682,"txHash":"0xdef456...","logIndex":1,"args":{"tokenId":"1","bit":0,"value":true,"setter":"0x5678...","traceId":"0x5452414345303033000000000000000000000000000000000000000000000000"}}
```

**確認ポイント**：
- `tokenId`, `bit` は数値
- `value` は boolean
- `setter` は実行者のアドレス

### 3. journeypass - FlagsBatchUpdated

```json
{"timestamp":"2025-01-24T12:35:20.456Z","contract":"journeypass","eventName":"FlagsBatchUpdated","blockNumber":12345683,"txHash":"0xghi789...","logIndex":0,"args":{"tokenId":"1","mask":"0x0000000000000000000000000000000000000000000000000000000000000003","setter":"0x5678...","traceId":"0x5452414345303034000000000000000000000000000000000000000000000000"}}
```

### 4. journeypass - MetadataUpdate

```json
{"timestamp":"2025-01-24T12:35:20.789Z","contract":"journeypass","eventName":"MetadataUpdate","blockNumber":12345683,"txHash":"0xghi789...","logIndex":1,"args":{"_tokenId":"1"}}
```

**確認ポイント**：
- EIP-4906 の仕様通り `_tokenId` がパラメータ名

### 5. reward - TokenMinted

**ファイル**: `YYYY-MM-DD.reward.jsonl`

```json
{"timestamp":"2025-01-24T12:36:00.000Z","contract":"reward","eventName":"TokenMinted","blockNumber":12345685,"txHash":"0xjkl012...","logIndex":3,"args":{"tokenId":"1","recipient":"0x9abc...","distributionType":1,"triggerId":"0x0000000000000000000000000000000000000000000000000000000000000000","metadataURI":"ipfs://QmExample123"}}
```

**確認ポイント**：
- `distributionType` は **数値** で記録される（0=AUTOMATIC, 1=MANUAL, 2=PUBLIC）
- `triggerId` が bytes32(0) の場合は manual mint
- `metadataURI` は文字列

### 6. 直送ETH（receive）のケース

```json
{"timestamp":"2025-01-24T12:37:00.000Z","contract":"splitter","eventName":"DonationReceived","blockNumber":12345688,"txHash":"0xmno345...","logIndex":0,"args":{"payer":"0xdef...","token":"0x0000000000000000000000000000000000000000","amount":"2000000000000000","sku":"0x0000000000000000000000000000000000000000000000000000000000000000","traceId":"0x0000000000000000000000000000000000000000000000000000000000000000"}}
```

**確認ポイント**：
- `receive()` 関数経由の場合、`sku` と `traceId` は `bytes32(0)`

---

## F. トラブルシュート

### 1. ABI decode 失敗（ABI mismatch）

**症状**：
```
⚠️  Failed to decode event from splitter: ...
```

**原因**：
- コントラクトのABIバージョン不一致
- イベントシグネチャの変更

**対処**：
1. `tools/indexer/index.js` の ABI 定義を確認
2. デプロイされたコントラクトのバージョンを確認
3. エラーは `*.error.jsonl` に raw event として記録される（処理は継続）

**error.jsonl の例**：
```json
{"timestamp":"2025-01-24T12:40:00.000Z","contract":"splitter","error":"ABI decode failed","rawEvent":{"address":"0x1234...","topics":["0xabc..."],"data":"0x..."}}
```

### 2. RPC 429 / タイムアウト

**症状**：
```
❌ Polling error: Too Many Requests
```

**原因**：
- Public RPC のレート制限
- ネットワーク遅延

**対処**：
1. `POLL_INTERVAL_MS` を増やす（例：5000 → 10000）
2. Private RPC または Alchemy/Infura を使用
3. インデクサーは **指数バックオフ** で自動リトライする（最大2倍間隔）

### 3. CONFIRMATIONS を下げすぎた場合

**症状**：
- 同じイベントが複数回記録される（チェーン再編成時）

**原因**：
- 確認ブロック数が少なすぎてブロックが巻き戻された

**対処**：
1. `CONFIRMATIONS` を 3-5 に設定
2. ローカルノード以外では最低 2 を推奨
3. **重複防止機構**（txHash:logIndex）により、同一プロセス内では重複しない

### 4. 重複行の発生

**症状**：
- インデクサー再起動後、過去のイベントが再度記録される

**原因**：
- `START_BLOCK` が固定されており、履歴同期が再実行される
- 重複防止は **メモリ内のみ**（再起動でリセット）

**対処**：
1. **運用時は START_BLOCK を動的に管理**（最終処理ブロックを永続化）
2. テスト時は `jq` でユニークフィルタリング：
   ```bash
   cat logs/indexer/*.jsonl | jq -s 'unique_by(.txHash + (.logIndex | tostring))'
   ```

### 5. ログファイルが生成されない

**チェックリスト**：
- [ ] `.env` の `RPC_URL` が正しい
- [ ] コントラクトアドレスが設定されている（未設定はスキップ）
- [ ] `START_BLOCK` 以降にイベントが存在する
- [ ] `CONFIRMATIONS` 分の確定ブロックが経過している

**デバッグコマンド**：
```bash
# インデクサーのログ出力を確認
npm run indexer:dev

# 特定ブロック範囲のイベント取得テスト
npm run indexer:once  # 1回だけ実行して終了
```

---

## G. 検収チェックリスト

以下の項目をすべて確認してください：

### 基本動作

- [ ] **3種のコントラクトイベントが記録される**
  - [ ] GifterraPaySplitter: `DonationReceived`
  - [ ] JourneyPass v1: `FlagUpdated`, `FlagsBatchUpdated`, `MetadataUpdate`
  - [ ] RewardNFT_v2: `TokenMinted`

- [ ] **JSONL ファイルが日付別・コントラクト別に分割される**
  - [ ] `YYYY-MM-DD.splitter.jsonl`
  - [ ] `YYYY-MM-DD.journeypass.jsonl`
  - [ ] `YYYY-MM-DD.reward.jsonl`

- [ ] **イベントが時系列順に記録される**
  - [ ] `blockNumber` が昇順
  - [ ] 同一ブロック内では `logIndex` が昇順

### データ整合性

- [ ] **SKU / traceId / tokenId が欠落していない**
  - [ ] bytes32 形式でエンコードされている
  - [ ] `0x000...` の場合も正しく記録されている

- [ ] **distributionType が数値で記録される**（RewardNFT）
  - [ ] 0 = AUTOMATIC
  - [ ] 1 = MANUAL
  - [ ] 2 = PUBLIC

- [ ] **直送ETH（receive）も記録される**
  - [ ] `token: "0x000..."`
  - [ ] `sku` と `traceId` は `bytes32(0)`

### エラーハンドリング

- [ ] **ABI decode 失敗時**
  - [ ] `*.error.jsonl` に raw event が記録される
  - [ ] プロセスは継続する（クラッシュしない）

- [ ] **RPC エラー発生時**
  - [ ] 指数バックオフでリトライする
  - [ ] 最終的に接続できればイベントを取得できる

- [ ] **SIGINT（Ctrl+C）で正常終了**
  - [ ] "Shutting down..." メッセージが表示される
  - [ ] プロセスが停止する

### 重複防止

- [ ] **同一プロセス内で重複しない**
  - [ ] txHash + logIndex の組み合わせで判定
  - [ ] 同じイベントが2回記録されない

- [ ] **再起動時の注意**
  - [ ] メモリ内の重複防止がリセットされる
  - [ ] `START_BLOCK` を固定すると履歴が再記録される
  - [ ] 運用時は最終処理ブロックを永続化すること

### 確認ブロック数

- [ ] **CONFIRMATIONS の挙動確認**
  - [ ] 設定したブロック数分待ってから記録される
  - [ ] チェーン再編成に対して安全

---

## 補足事項

### ログの分析例（jq）

```bash
# 特定の SKU の DonationReceived を抽出
cat logs/indexer/2025-01-24.splitter.jsonl | \
  jq 'select(.eventName == "DonationReceived") | select(.args.sku == "0x534b553030310000000000000000000000000000000000000000000000000000")'

# tokenId=1 のすべてのイベントを抽出
cat logs/indexer/2025-01-24.journeypass.jsonl | \
  jq 'select(.args.tokenId == "1")'

# distributionType 別の集計
cat logs/indexer/2025-01-24.reward.jsonl | \
  jq -s 'group_by(.args.distributionType) | map({type: .[0].args.distributionType, count: length})'
```

### 本番運用時の追加対応

本手順書は **実機テスト向け** です。本番運用時には以下の追加対応が必要です：

1. **最終処理ブロックの永続化**（DB or ファイル）
2. **プロセス監視**（systemd, PM2, Docker等）
3. **ログローテーション**（logrotate 等）
4. **アラート設定**（RPC 障害、decode 失敗の頻発）
5. **バックアップ戦略**（JSONL ファイルの定期バックアップ）

これらの詳細は別ドキュメント（本番運用手順書）で扱います。

---

## 参考リンク

- [tools/indexer/README.md](../tools/indexer/README.md) - インデクサーの基本仕様
- [contracts/GifterraPaySplitter.sol](../contracts/GifterraPaySplitter.sol) - PaySplitter の実装
- [contracts/JourneyPass.sol](../contracts/JourneyPass.sol) - JourneyPass v1 の実装
- [contracts/RewardNFT_v2.sol](../contracts/RewardNFT_v2.sol) - RewardNFT の実装

---

**最終更新**: 2025-01-24
**対象バージョン**: tools/indexer v1.0.0
