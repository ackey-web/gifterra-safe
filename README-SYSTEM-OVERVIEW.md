# Gifterra エコシステム - システム全体概要

**マルチテナント対応 Web3 ロイヤリティ＆リワードプラットフォーム**

**対応ネットワーク**: Polygon Amoy (Testnet) / Polygon Mainnet

---

## 目次

1. [システム概要](#システム概要)
2. [全体アーキテクチャ](#全体アーキテクチャ)
3. [コントラクト一覧](#コントラクト一覧)
4. [オフチェーンツール](#オフチェーンツール)
5. [デプロイメントフロー](#デプロイメントフロー)
6. [運用フロー](#運用フロー)
7. [ディレクトリ構成](#ディレクトリ構成)
8. [クイックスタート](#クイックスタート)

---

## システム概要

### Gifterra とは

Gifterra は、実店舗やオンラインサービス向けの **Web3 ロイヤリティプログラム** を提供する SaaS プラットフォームです。

### 主要機能

#### 1. 投げ銭・ランクアップシステム
- ユーザーがトークンで店舗に投げ銭
- 累積投げ銭額に応じて自動ランクアップ
- ランクごとにソウルバウンドトークン (SBT) を発行

#### 2. リワード配布
- **確定報酬**: ルールベース自動配布（寄付額、スタンプラリー達成等）
- **ランダム報酬**: デイリーガチャ、マイルストーン、有料ガチャ

#### 3. スタンプラリー・クエスト
- 来店・購入等でフラグを立てる
- 達成時に自動でNFT配布

#### 4. マルチテナント対応
- 1つのファクトリーから複数店舗を管理
- 各店舗は完全に独立したコントラクトセットを保有

---

## 全体アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                        運営 (Super Admin)                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  GifterraFactory      │  マルチテナントファクトリー
          │  (コントラクトデプロイ)  │
          └────────────┬────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   ┌───▼────┐     ┌───▼────┐     ┌───▼────┐
   │Tenant 1│     │Tenant 2│     │Tenant N│
   │カフェA  │     │ショップB│     │...      │
   └───┬────┘     └───┬────┘     └───┬────┘
       │              │              │
       │ (各テナントは完全独立した5つのコントラクトを保有)
       │
   ┌───▼──────────────────────────────────────┐
   │ 1. Gifterra (SBT)                        │  投げ銭・ランク管理
   │ 2. RewardNFT_v2                          │  SKUベースNFT配布
   │ 3. GifterraPaySplitter                   │  支払い受付・分配
   │ 4. JourneyPass                           │  スタンプラリー
   │ 5. RandomRewardEngine                    │  ランダム報酬配布
   └──────────────────────────────────────────┘
              ▲                        ▲
              │                        │
   ┌──────────┴─────────┐   ┌─────────┴──────────┐
   │  tools/indexer/    │   │ tools/distributor/ │
   │  (イベント監視)     │   │ (自動配布実行)      │
   └────────────────────┘   └────────────────────┘
```

---

## コントラクト一覧

### 1. GifterraFactory (ファクトリー)

**役割**: マルチテナント管理・一括デプロイ

**主要機能**:
- `createTenant()` - 新規テナント作成（5コントラクト一括デプロイ）
- `setTenantPaused()` - テナント停止/再開
- `withdrawFees()` - 手数料引き出し

**ドキュメント**: [FACTORY-DEPLOYMENT-GUIDE.md](./docs/FACTORY-DEPLOYMENT-GUIDE.md)

**コントラクト**: [GifterraFactory.sol](./contracts/GifterraFactory.sol)

---

### 2. Gifterra (SBT)

**役割**: 投げ銭・ランクアップ・デイリーリワード

**主要機能**:
- `tip(uint256 amount)` - トークンで投げ銭
- `claimDailyReward()` - 24時間ごとにトークン受取
- `_updateRank()` - 累積投げ銭額に応じて自動ランクアップ（Burn & Mint）

**特性**:
- ソウルバウンドトークン（譲渡不可）
- ランク1〜4（Bronze, Silver, Gold, Platinum）
- ERC721Enumerable 準拠

**コントラクト**: [Gifterra.sol](./contracts/Gifterra.sol)

---

### 3. RewardNFT_v2

**役割**: SKUベース報酬NFT配布

**主要機能**:
- `registerSKU(bytes32 sku, string uri, uint256 maxSupply)` - SKU登録
- `distributeMintBySku(address recipient, bytes32 sku, bytes32 triggerId)` - SKU指定ミント
- `batchMintBySku(address[] recipients, bytes32 sku)` - 一括配布

**特性**:
- DISTRIBUTOR_ROLE による配布制限
- トリガーID による重複防止
- SKU在庫管理（maxSupply）

**ドキュメント**: [README-RewardNFT-v2.md](./contracts/README-RewardNFT-v2.md)

**コントラクト**: [RewardNFT_v2.sol](./contracts/RewardNFT_v2.sol)

---

### 4. GifterraPaySplitter

**役割**: 支払い受付・分配

**主要機能**:
- 支払い受付（ETH・ERC20）
- 複数受取人への自動分配
- `release()` による引き出し

**特性**:
- OpenZeppelin PaymentSplitter ベース
- Shares 比率による分配

**コントラクト**: [GifterraPaySplitter.sol](./contracts/GifterraPaySplitter.sol)

---

### 5. JourneyPass

**役割**: スタンプラリー・クエスト管理

**主要機能**:
- `mint(address to)` - パス発行
- `setFlag(uint256 tokenId, uint8 bit)` - フラグ立て
- `unsetFlag(uint256 tokenId, uint8 bit)` - フラグ解除
- `hasFlag(uint256 tokenId, uint8 bit)` - フラグ確認

**特性**:
- 256ビットフラグ（最大256個のクエスト対応）
- FlagUpdated イベント（Distributor連携用）

**ドキュメント**: [README-JourneyPass.md](./contracts/README-JourneyPass.md)

**コントラクト**: [JourneyPass.sol](./contracts/JourneyPass.sol)

---

### 6. RandomRewardEngine

**役割**: ランダム報酬配布（コミット方式）

**主要機能**:
- `drawDailyReward(bytes32 seed, address operator)` - デイリーガチャ（24h CD）
- `drawTipMilestone(uint256 id, bytes32 seed, address operator)` - マイルストーン達成報酬
- `drawManualGacha(bytes32 seed, address operator)` - 有料ガチャ

**特性**:
- コミット方式オフチェーン抽選（低コスト）
- ランク別確率テーブル（4 ranks × 4 rarities）
- トークン・NFT両方の報酬対応

**ドキュメント**: [README-RandomRewardEngine.md](./contracts/README-RandomRewardEngine.md)

**コントラクト**: [RandomRewardEngine.sol](./contracts/RandomRewardEngine.sol)

---

## オフチェーンツール

### 1. Indexer (イベント監視)

**場所**: `tools/indexer/`

**役割**: コントラクトイベントをリアルタイム監視・JSONL出力

**監視対象イベント**:
- `Tipped` (Gifterra)
- `NFTMinted` (Gifterra)
- `DonationReceived` (PaySplitter)
- `FlagUpdated` (JourneyPass)
- `RewardMinted` (RewardNFT_v2)

**出力**: `events/*.jsonl`

**ドキュメント**: [indexer-e2e-checklist.md](./docs/indexer-e2e-checklist.md)

**起動**:
```bash
cd tools/indexer
pnpm indexer:dev
```

---

### 2. Distributor (自動配布実行)

**場所**: `tools/distributor/`

**役割**: イベントをルールベースで判定し、RewardNFT_v2 を自動配布

**ルール例**:
```json
{
  "trigger": "DonationReceived",
  "match": { "minAmount": "1000000000000000000000" },
  "action": { "type": "reward_mint", "sku": "DONATION_BRONZE" }
}
```

**特性**:
- idempotency (txHash:logIndex)
- Retry queue with exponential backoff
- JSONL tail with line-by-line processing

**起動**:
```bash
cd tools/distributor
pnpm distributor:dev
```

---

## デプロイメントフロー

### Phase 1: Factory デプロイ（運営）

```bash
# 1. Factory デプロイ
npx hardhat run scripts/deploy-factory.js --network sepolia

# 2. コントラクト検証
npx hardhat verify --network sepolia 0x... 0x...
```

### Phase 2: テナント作成（運営 or テナント）

```bash
# 環境変数設定
export FACTORY_ADDRESS=0x...
export TENANT_NAME="カフェA Gifterra System"
export TENANT_ADMIN=0xCafeAdmin
export REWARD_TOKEN_ADDRESS=0xRewardToken
export TIP_WALLET_ADDRESS=0xCafeTipWallet

# テナント作成
npx hardhat run scripts/create-tenant.js --network sepolia
```

### Phase 3: コントラクト設定（テナント）

```javascript
// Gifterra 設定
await gifterra.setRankThreshold(1, ethers.parseEther("1000"));
await gifterra.setNFTRankUri(1, "ipfs://Qm.../bronze.json");
await rewardToken.transfer(gifterra.address, ethers.parseEther("100000"));

// RewardNFT_v2 設定
await rewardNFT.registerSKU(
  ethers.encodeBytes32String("WELCOME_NFT"),
  "ipfs://Qm.../welcome.json",
  1000
);
await rewardNFT.grantRole(DISTRIBUTOR_ROLE, distributorAddress);

// RandomRewardEngine 設定
await randomEngine.grantRole(OPERATOR_ROLE, operatorAddress);
await randomEngine.setRewardPool(0, 1, 70, 25, 4, 1);
await randomEngine.setRewardAmount(0, 1, 0, ethers.parseEther("10"), ethers.ZeroHash);
await rewardToken.transfer(randomEngine.address, ethers.parseEther("50000"));
```

### Phase 4: Indexer/Distributor 起動（テナント）

```bash
# Indexer 設定
cd tools/indexer
cp ../deployments/tenants/tenant-1.env.example .env
# .env を編集（RPC_URL, PRIVATE_KEY等）
pnpm indexer:dev

# Distributor 設定
cd tools/distributor
cp ../deployments/tenants/tenant-1.env.example .env
# .env を編集
pnpm distributor:dev
```

---

## 運用フロー

### ユースケース1: ユーザーが投げ銭

```
1. ユーザー: gifterra.tip(1000 token)
   ↓
2. Gifterra: totalTips[user] += 1000
   ↓
3. Gifterra: _updateRank(user) → ランクアップ判定
   ↓ (ランクアップした場合)
4. Gifterra: 旧SBTを Burn、新SBTを Mint
   ↓
5. イベント発火: NFTMinted, Tipped
   ↓
6. Indexer: イベント検知 → JSONL出力
```

### ユースケース2: 寄付で自動NFT配布

```
1. ユーザー: payLitter.donate(1000 token)
   ↓
2. PaySplitter: DonationReceived イベント発火
   ↓
3. Indexer: イベント検知 → events/donations.jsonl 出力
   ↓
4. Distributor: JSONL読み込み → ルール判定
   ↓ (minAmount >= 1000)
5. Distributor: rewardNFT.distributeMintBySku(user, "DONATION_BRONZE", triggerId)
   ↓
6. RewardNFT_v2: NFTミント → RewardMinted イベント
   ↓
7. Indexer: RewardMinted 検知 → JSONL出力
```

### ユースケース3: デイリーガチャ

```
1. ユーザー（フロントエンド）: "デイリーガチャ" ボタンクリック
   ↓
2. フロントエンド: バックエンドに抽選リクエスト
   ↓
3. バックエンド: シード生成 → randomEngine.commitSeed(seedHash)
   ↓ (24時間待機)
4. ユーザー: randomEngine.drawDailyReward(seed, operator)
   ↓
5. RandomRewardEngine: シード検証 → 乱数生成 → レアリティ判定
   ↓
6. RandomRewardEngine: rewardNFT.distributeMintBySku() または rewardToken.transfer()
   ↓
7. イベント発火: RewardDrawn
```

---

## ディレクトリ構成

```
gifterra-test-stable-4/
├── contracts/                      # Solidityコントラクト
│   ├── GifterraFactory.sol       # マルチテナントファクトリー
│   ├── Gifterra.sol                # SBT (投げ銭・ランク)
│   ├── RewardNFT_v2.sol            # SKUベースNFT配布
│   ├── GifterraPaySplitter.sol     # 支払い受付・分配
│   ├── JourneyPass.sol             # スタンプラリー
│   ├── RandomRewardEngine.sol      # ランダム報酬配布
│   └── README-*.md                 # 各コントラクトドキュメント
│
├── scripts/                        # デプロイスクリプト
│   ├── deploy-factory.js           # Factory デプロイ
│   └── create-tenant.js            # テナント作成
│
├── tools/                          # オフチェーンツール
│   ├── indexer/                    # イベント監視
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── distributor/                # 自動配布実行
│       ├── index.js
│       ├── config/rules.json
│       ├── state/processed.json
│       └── package.json
│
├── docs/                           # ドキュメント
│   ├── FACTORY-DEPLOYMENT-GUIDE.md         # Factory 完全ガイド
│   ├── ARCHITECTURE-INTERCONNECTIONS.md    # アーキテクチャ詳細
│   └── indexer-e2e-checklist.md            # Indexer E2Eテスト
│
├── deployments/                    # デプロイ情報（自動生成）
│   ├── factory-sepolia-*.json
│   └── tenants/
│       └── tenant-*.json
│
├── src/                            # フロントエンド（React/TypeScript）
│   ├── admin/                      # 管理画面
│   ├── vending-ui/                 # 自販機UI
│   ├── reward-ui/                  # リワードUI
│   └── tip-ui/                     # 投げ銭UI
│
└── README-SYSTEM-OVERVIEW.md       # このファイル
```

---

## クイックスタート

### 前提条件

- Node.js v18+
- pnpm
- Hardhat
- Polygon RPC（Alchemy, Infura, QuickNode 等）
- MetaMask に Polygon Amoy/Mainnet 追加済み

### 1. インストール

```bash
pnpm install
```

### 2. Factory デプロイ

```bash
# .env 設定
export FEE_RECIPIENT=0x...
export AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=0x...

# デプロイ（Polygon Amoy）
npx hardhat run scripts/deploy-factory.js --network amoy

# デプロイ（Polygon Mainnet）
npx hardhat run scripts/deploy-factory.js --network polygon
```

**推奨ガス代**:
- Factory デプロイ: 約 $0.10-0.50
- テナント作成: 約 $0.50-3.00

### 3. テナント作成

```bash
export FACTORY_ADDRESS=0x...
export TENANT_NAME="Test Cafe"
export REWARD_TOKEN_ADDRESS=0x...  # Polygon上のERC20トークン
export TIP_WALLET_ADDRESS=0x...

# Polygon Amoy
npx hardhat run scripts/create-tenant.js --network amoy

# Polygon Mainnet
npx hardhat run scripts/create-tenant.js --network polygon
```

### 4. Indexer 起動

```bash
cd tools/indexer

# .env 設定（create-tenant.js が生成した .env.example を参考）
cp ../../deployments/tenants/tenant-1.env.example .env
vim .env  # RPC_URL, START_BLOCK 等を設定

# 起動
pnpm indexer:dev
```

### 5. Distributor 起動

```bash
cd tools/distributor

# .env 設定
cp ../../deployments/tenants/tenant-1.env.example .env
vim .env  # DISTRIBUTOR_PRIVATE_KEY 等を設定

# ルール設定
vim config/rules.json

# 起動
pnpm distributor:dev
```

---

## 主要ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [remix-deployment-guide.md](./docs/remix-deployment-guide.md) | **Remix でのデプロイガイド（推奨）** |
| [FACTORY-DEPLOYMENT-GUIDE.md](./docs/FACTORY-DEPLOYMENT-GUIDE.md) | Factory デプロイ・運用完全ガイド（Hardhat/CLI使用） |
| [ARCHITECTURE-INTERCONNECTIONS.md](./docs/ARCHITECTURE-INTERCONNECTIONS.md) | コントラクト間連携・依存関係詳細 |
| [indexer-e2e-checklist.md](./docs/indexer-e2e-checklist.md) | Indexer E2E テスト手順 |
| [README-RandomRewardEngine.md](./contracts/README-RandomRewardEngine.md) | ランダム報酬エンジン使い方 |
| [README-RewardNFT-v2.md](./contracts/README-RewardNFT-v2.md) | SKUベースNFT配布システム |
| [README-JourneyPass.md](./contracts/README-JourneyPass.md) | スタンプラリー実装ガイド |

---

## サポート・問い合わせ

問題が発生した場合は、以下の情報を添えて報告してください：

1. ネットワーク（Sepolia/Mainnet/Local）
2. トランザクションハッシュ
3. エラーメッセージ
4. 実行したコマンド
5. 関連するコントラクトアドレス

---

## ライセンス

MIT License

---

**最終更新**: 2025-01-26
**バージョン**: v1.0.0
