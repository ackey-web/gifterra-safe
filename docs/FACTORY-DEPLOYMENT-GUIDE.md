# GifterraFactory デプロイ・運用ガイド

**マルチテナント SaaS アーキテクチャ完全ガイド**

**対応ネットワーク**: Polygon Amoy (Testnet) / Polygon Mainnet

---

## 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [デプロイ手順](#デプロイ手順)
4. [テナント作成フロー](#テナント作成フロー)
5. [スーパーアドミン操作](#スーパーアドミン操作)
6. [テナントアドミン操作](#テナントアドミン操作)
7. [Indexer・Distributor連携](#indexerdistributor連携)
8. [運用シナリオ](#運用シナリオ)
9. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### GifterraFactory とは

**マルチテナント対応の Gifterra エコシステム一括デプロイファクトリー**

- 1回のトランザクションで完全なコントラクトセットをデプロイ
- スーパーアドミンが全テナントを統合管理
- 各テナントは完全に独立した環境を持つ
- テナントアドミンは自分のコントラクトのみ管理可能

### デプロイされるコントラクトセット

各テナントが以下の5つのコントラクトを取得：

1. **Gifterra (SBT)** - 投げ銭・ランクアップ・デイリーリワード
2. **RewardNFT_v2** - SKUベースNFT配布システム
3. **GifterraPaySplitter** - 支払い受付・分配
4. **JourneyPass** - スタンプラリー・クエスト管理
5. **RandomRewardEngine** - ランダム報酬配布（3種トリガー対応）

---

## アーキテクチャ

### 権限構造

```
運営 (Super Admin)
  └─ GifterraFactory
      ├─ Tenant 1: カフェA
      │   ├─ Gifterra (SBT)
      │   ├─ RewardNFT_v2
      │   ├─ PaySplitter
      │   ├─ JourneyPass
      │   └─ RandomRewardEngine
      │
      ├─ Tenant 2: レストランB
      │   └─ (同じ5つのコントラクト)
      │
      └─ Tenant N: ショップZ
          └─ (同じ5つのコントラクト)
```

### ロール定義

| ロール | 権限範囲 | 主な操作 |
|--------|---------|---------|
| **SUPER_ADMIN_ROLE** | 全テナント | テナント作成/停止/削除、手数料管理、統計閲覧 |
| **OPERATOR_ROLE** | Factory全体 | 運用支援タスク（将来拡張用） |
| **Tenant Admin** | 自分のテナントのみ | 各コントラクトの設定変更、報酬設定、停止/再開 |

---

## デプロイ手順

### Phase 1: Factory デプロイ

#### 1.1 Hardhat スクリプト作成

`scripts/deploy-factory.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Factory with account:", deployer.address);

  // 手数料受取アドレス（運営ウォレット）
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  // Factory デプロイ
  const GifterraFactory = await ethers.getContractFactory("GifterraFactory");
  const factory = await GifterraFactory.deploy(feeRecipient);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ GifterraFactory deployed to:", factoryAddress);

  // 初期設定確認
  const deploymentFee = await factory.deploymentFee();
  const totalTenants = await factory.totalTenants();

  console.log("Deployment Fee:", ethers.formatEther(deploymentFee), "ETH");
  console.log("Total Tenants:", totalTenants.toString());

  // Verify 用データ保存
  console.log("\n--- Verification Command ---");
  console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} ${feeRecipient}`);

  return { factory: factoryAddress, feeRecipient };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### 1.2 実行

```bash
# テストネット（Polygon Amoy）
npx hardhat run scripts/deploy-factory.js --network amoy

# メインネット（Polygon Mainnet）
npx hardhat run scripts/deploy-factory.js --network polygon

# ローカル（Anvil/Hardhat）
npx hardhat run scripts/deploy-factory.js --network localhost
```

**推奨ガス代（Polygon）**:
- Factory デプロイ: 約 $0.10-0.50（~2M gas @ 100 Gwei, MATIC $0.9）
- テナント作成: 約 $0.50-3.00（~8M gas @ 100 Gwei, MATIC $0.9）

#### 1.3 コントラクト検証

```bash
# Polygon Amoy
npx hardhat verify --network amoy \
  0x... \  # Factory アドレス
  "0x..." \  # Fee Recipient アドレス
  "10000000000000000000"  # Deployment Fee (10 MATIC in wei)

# Polygon Mainnet
npx hardhat verify --network polygon \
  0x... \
  "0x..." \
  "10000000000000000000"
```

---

### Phase 2: 初期設定

#### 2.1 デプロイ手数料設定（オプション）

デフォルトは `10 MATIC`（Polygon Amoy/Mainnet）。変更する場合：

```javascript
// 手数料を 20 MATIC に変更
await factory.setDeploymentFee(ethers.parseEther("20"));

// 手数料を 5 MATIC に変更
await factory.setDeploymentFee(ethers.parseEther("5"));
```

#### 2.2 オペレーター追加（オプション）

```javascript
const OPERATOR_ROLE = await factory.OPERATOR_ROLE();
await factory.grantRole(OPERATOR_ROLE, "0x...オペレーターアドレス");
```

---

## テナント作成フロー

### シナリオ: カフェA が Gifterra を導入

#### Step 1: 事前準備

カフェA 側で準備するもの：

1. **管理者ウォレット** (`0xCafeAdmin`)
2. **報酬トークンアドレス** (`0xRewardToken`) - ERC20トークン（Polygon上）
3. **投げ銭受取ウォレット** (`0xCafeTipWallet`)
4. **デプロイ手数料** (例: 10 MATIC ≈ $9)

#### Step 2: テナント作成実行

```javascript
// フロントエンドまたはスクリプトから実行
const tx = await factory.createTenant(
  "カフェA Gifterra System",        // tenantName
  "0xCafeAdmin",                    // admin
  "0xRewardToken",                  // rewardTokenAddress (Polygon上のERC20)
  "0xCafeTipWallet",                // tipWalletAddress
  { value: ethers.parseEther("10") }  // デプロイ手数料（10 MATIC）
);

const receipt = await tx.wait();
console.log("✅ Tenant created!");

// イベントから情報取得
const event = receipt.logs.find(
  log => log.fragment.name === "TenantCreated"
);

const {
  tenantId,
  admin,
  tenantName,
  gifterra,
  rewardNFT,
  payLitter,
  journeyPass,
  randomRewardEngine
} = event.args;

console.log("Tenant ID:", tenantId);
console.log("Gifterra (SBT):", gifterra);
console.log("RewardNFT_v2:", rewardNFT);
console.log("PaySplitter:", payLitter);
console.log("JourneyPass:", journeyPass);
console.log("RandomRewardEngine:", randomRewardEngine);
```

#### Step 3: テナント情報取得

```javascript
// Tenant ID からフル情報取得
const tenantInfo = await factory.getTenantInfo(tenantId);

console.log("Tenant Name:", tenantInfo.tenantName);
console.log("Admin:", tenantInfo.admin);
console.log("Created At:", new Date(tenantInfo.createdAt * 1000));
console.log("Is Active:", tenantInfo.isActive);
console.log("Is Paused:", tenantInfo.isPaused);

// Admin アドレスから Tenant ID 逆引き
const tenantIdByAdmin = await factory.getTenantIdByAdmin("0xCafeAdmin");
console.log("Admin's Tenant ID:", tenantIdByAdmin);
```

#### Step 4: 各コントラクトの初期設定

**Gifterra (SBT) 設定**:

```javascript
const gifterra = await ethers.getContractAt("Gifterra", tenantInfo.contracts.gifterra);

// ランク閾値設定
await gifterra.setRankThreshold(1, ethers.parseEther("1000"));   // Bronze
await gifterra.setRankThreshold(2, ethers.parseEther("5000"));   // Silver
await gifterra.setRankThreshold(3, ethers.parseEther("10000"));  // Gold
await gifterra.setRankThreshold(4, ethers.parseEther("50000"));  // Platinum

// NFT URI 設定
await gifterra.setNFTRankUri(1, "ipfs://Qm.../bronze.json");
await gifterra.setNFTRankUri(2, "ipfs://Qm.../silver.json");
await gifterra.setNFTRankUri(3, "ipfs://Qm.../gold.json");
await gifterra.setNFTRankUri(4, "ipfs://Qm.../platinum.json");

// デイリーリワード額設定
await gifterra.setDailyRewardAmount(ethers.parseEther("30"));

// リワードトークンを Gifterra に送付
await rewardToken.transfer(gifterra.address, ethers.parseEther("100000"));
```

**RewardNFT_v2 設定**:

```javascript
const rewardNFT = await ethers.getContractAt("RewardNFT_v2", tenantInfo.contracts.rewardNFT);

// SKU 登録
await rewardNFT.registerSKU(
  ethers.encodeBytes32String("WELCOME_NFT"),
  "ipfs://Qm.../welcome.json",
  1000  // maxSupply
);

await rewardNFT.registerSKU(
  ethers.encodeBytes32String("DONATION_BRONZE"),
  "ipfs://Qm.../donation-bronze.json",
  0  // 無制限
);

// Distributor ロール付与（tools/distributor/ 用）
const DISTRIBUTOR_ROLE = await rewardNFT.DISTRIBUTOR_ROLE();
await rewardNFT.grantRole(DISTRIBUTOR_ROLE, "0xDistributorBackendWallet");
```

**RandomRewardEngine 設定**:

```javascript
const randomEngine = await ethers.getContractAt(
  "RandomRewardEngine",
  tenantInfo.contracts.randomRewardEngine
);

// オペレーターロール付与（シード管理バックエンド）
const OPERATOR_ROLE = await randomEngine.OPERATOR_ROLE();
await randomEngine.grantRole(OPERATOR_ROLE, "0xOperatorBackend");

// 確率テーブル設定（デイリーリワード・ランク1）
await randomEngine.setRewardPool(
  0,   // TriggerType.DAILY_REWARD
  1,   // rank 1
  70,  // common 70%
  25,  // rare 25%
  4,   // sr 4%
  1    // ssr 1%
);

// 報酬額設定
await randomEngine.setRewardAmount(
  0,  // DAILY_REWARD
  1,  // rank 1
  0,  // COMMON
  ethers.parseEther("10"),  // 10トークン
  ethers.ZeroHash  // NFTなし
);

// マイルストーン追加
await randomEngine.addMilestone(ethers.parseEther("1000"));
await randomEngine.addMilestone(ethers.parseEther("5000"));

// エンジンに報酬用トークン送付
await rewardToken.transfer(randomEngine.address, ethers.parseEther("50000"));
```

**JourneyPass 設定**:

```javascript
const journeyPass = await ethers.getContractAt("JourneyPass", tenantInfo.contracts.journeyPass);

// クエスト設定（フラグ0: 初回来店）
// フロントエンドまたはバックエンドから setFlag() を呼び出す想定
```

---

## スーパーアドミン操作

### 全テナント一覧取得

```javascript
// ページネーション対応
const tenantList = await factory.getTenantList(0, 10);  // offset 0, limit 10

tenantList.forEach((tenant) => {
  console.log(`Tenant ${tenant.tenantId}: ${tenant.tenantName}`);
  console.log(`  Admin: ${tenant.admin}`);
  console.log(`  Active: ${tenant.isActive}, Paused: ${tenant.isPaused}`);
});
```

### 統計情報取得

```javascript
const stats = await factory.getGlobalStats();

console.log("Total Tenants:", stats.total);
console.log("Active Tenants:", stats.active);
console.log("Fees Collected:", ethers.formatEther(stats.feesCollected), "ETH");
console.log("Current Deployment Fee:", ethers.formatEther(stats.currentFee), "ETH");
```

### テナント停止/再開

```javascript
// 緊急停止（違反テナント等）
await factory.setTenantPaused(tenantId, true);

// 再開
await factory.setTenantPaused(tenantId, false);
```

### テナント無効化

```javascript
// 完全無効化（契約終了等）
await factory.setTenantActive(tenantId, false);

// 再有効化
await factory.setTenantActive(tenantId, true);
```

### テナント管理者変更

```javascript
// 管理者交代
await factory.transferTenantAdmin(tenantId, "0xNewAdmin");
```

### 手数料管理

```javascript
// 手数料変更
await factory.setDeploymentFee(ethers.parseEther("0.2"));

// 手数料引き出し
await factory.withdrawFees();  // feeRecipient に送金

// 手数料受取人変更
await factory.setFeeRecipient("0xNewFeeRecipient");
```

### Factory 緊急停止

```javascript
// 全テナント作成を停止
await factory.pause();

// 再開
await factory.unpause();
```

---

## テナントアドミン操作

### 自分のテナント情報確認

```javascript
// Admin アドレスから Tenant ID 取得
const myTenantId = await factory.getTenantIdByAdmin(adminAddress);

// テナント情報取得
const myTenant = await factory.getTenantInfo(myTenantId);
console.log("My Tenant:", myTenant);
```

### 各コントラクトの管理

テナントアドミンは自分のコントラクトに対して `Ownable.owner()` または `AccessControl` 権限を持つため、直接操作可能：

```javascript
// Gifterra の設定変更
const gifterra = await ethers.getContractAt("Gifterra", myTenant.contracts.gifterra);
await gifterra.setDailyRewardAmount(ethers.parseEther("50"));

// RewardNFT_v2 の SKU 追加
const rewardNFT = await ethers.getContractAt("RewardNFT_v2", myTenant.contracts.rewardNFT);
await rewardNFT.registerSKU(
  ethers.encodeBytes32String("SPECIAL_EVENT"),
  "ipfs://Qm.../special.json",
  100
);

// RandomRewardEngine の確率変更
const randomEngine = await ethers.getContractAt(
  "RandomRewardEngine",
  myTenant.contracts.randomRewardEngine
);
await randomEngine.setRewardPool(0, 1, 60, 30, 8, 2);
```

### 制限事項

- ❌ 他のテナントのコントラクトは操作不可
- ❌ Factory の設定変更不可（手数料等）
- ❌ テナント自体の削除不可

---

## Indexer・Distributor連携

### Indexer 設定（テナント別）

`tools/indexer/.env`:

```bash
# テナント1: カフェA
GIFTERRA_ADDRESS=0x...  # tenantInfo.contracts.gifterra
REWARD_NFT_ADDRESS=0x... # tenantInfo.contracts.rewardNFT
PAY_SPLITTER_ADDRESS=0x... # tenantInfo.contracts.payLitter
JOURNEY_PASS_ADDRESS=0x... # tenantInfo.contracts.journeyPass

RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
START_BLOCK=12345678
OUTPUT_DIR=./events
POLL_INTERVAL_MS=5000
```

### Distributor 設定（テナント別）

`tools/distributor/.env`:

```bash
# テナント1: カフェA
REWARD_NFT_ADDRESS=0x...  # tenantInfo.contracts.rewardNFT
JOURNEY_PASS_ADDRESS=0x...  # tenantInfo.contracts.journeyPass

DISTRIBUTOR_PRIVATE_KEY=0x...
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

INPUT_DIR=../indexer/events
STATE_DIR=./state
RULES_FILE=./config/rules.json
```

### マルチテナント対応

複数テナントを同時運用する場合：

**Option A: 個別起動**

```bash
# Tenant 1
cd tools/indexer-tenant1
pnpm indexer:dev

cd tools/distributor-tenant1
pnpm distributor:dev

# Tenant 2
cd tools/indexer-tenant2
pnpm indexer:dev
...
```

**Option B: 統合管理スクリプト**

`tools/multi-tenant-manager/start-all.sh`:

```bash
#!/bin/bash

TENANTS=("tenant1" "tenant2" "tenant3")

for tenant in "${TENANTS[@]}"; do
  cd indexer-$tenant && pnpm indexer:dev &
  cd distributor-$tenant && pnpm distributor:dev &
done

wait
```

---

## 運用シナリオ

### シナリオ1: 新規カフェの導入

1. カフェオーナーが運営に申し込み
2. 運営が `factory.createTenant()` 実行
3. テナント情報をカフェオーナーに通知
4. カフェオーナーがフロントエンドから各コントラクトを設定
5. Indexer/Distributor を起動
6. 運用開始

### シナリオ2: テナントの一時停止

1. カフェAで規約違反が発覚
2. 運営が `factory.setTenantPaused(tenantId, true)` 実行
3. カフェAのユーザーは既存機能を継続利用できるが、新規作成は制限
4. 調査完了後、`factory.setTenantPaused(tenantId, false)` で再開

### シナリオ3: 管理者交代

1. カフェAのオーナーが変更
2. 運営が `factory.transferTenantAdmin(tenantId, newOwnerAddress)` 実行
3. 新オーナーが管理者権限を取得

### シナリオ4: テナント統計分析

```javascript
// 全テナントの統計取得
const stats = await factory.getGlobalStats();
console.log(`Total Revenue: ${ethers.formatEther(stats.feesCollected)} ETH`);

// 個別テナントの活動状況
for (let i = 1; i < nextTenantId; i++) {
  const tenant = await factory.getTenantInfo(i);
  const gifterra = await ethers.getContractAt("Gifterra", tenant.contracts.gifterra);

  // 例: トータル投げ銭額（オンチェーンから取得は難しいため、Indexer のデータを使用）
  console.log(`Tenant ${i}: ${tenant.tenantName}`);
}
```

---

## トラブルシューティング

### 1. "Admin already has tenant"

**原因**: 同じアドミンアドレスで2つ目のテナントを作成しようとした

**解決策**: 別のアドレスを使用するか、既存テナントの管理者を変更

```javascript
// 管理者変更後、元のアドレスで新規テナント作成可能
await factory.transferTenantAdmin(oldTenantId, "0xNewAdmin");
await factory.createTenant("New Tenant", "0xOldAdmin", ...);
```

### 2. "Insufficient deployment fee"

**原因**: 送金額が `deploymentFee` より少ない

**解決策**: 現在の手数料を確認して正しい額を送信

```javascript
const fee = await factory.deploymentFee();
console.log("Required Fee:", ethers.formatEther(fee), "ETH");

await factory.createTenant(..., { value: fee });
```

### 3. デプロイ後にコントラクトが動作しない

**原因**: 初期設定（トークン送付、ロール付与等）が未完了

**チェックリスト**:
- [ ] Gifterra にリワードトークンを送付したか
- [ ] RewardNFT_v2 に DISTRIBUTOR_ROLE を付与したか
- [ ] RandomRewardEngine に OPERATOR_ROLE を付与したか
- [ ] RandomRewardEngine にトークンを送付したか
- [ ] Gifterra のランク閾値・URI を設定したか

### 4. Indexer がイベントを検知しない

**原因**: コントラクトアドレスが間違っている

**解決策**: Factory から取得した正しいアドレスを使用

```javascript
const tenant = await factory.getTenantInfo(tenantId);
console.log("Correct Addresses:");
console.log("  Gifterra:", tenant.contracts.gifterra);
console.log("  RewardNFT:", tenant.contracts.rewardNFT);
console.log("  PaySplitter:", tenant.contracts.payLitter);
console.log("  JourneyPass:", tenant.contracts.journeyPass);
```

### 5. "Invalid tenant ID"

**原因**: 存在しないテナントIDを指定した

**解決策**: 有効なテナントID範囲を確認

```javascript
const nextId = await factory.nextTenantId();
console.log("Valid Tenant IDs: 1 to", nextId - 1);
```

---

## ベストプラクティス

### セキュリティ

1. **Super Admin 権限の厳重管理**
   - マルチシグウォレット使用推奨
   - Gnosis Safe 等での複数署名必須化

2. **手数料受取アドレスの分離**
   - デプロイアドレスと手数料受取アドレスを別にする

3. **定期監査**
   - テナント一覧と統計の定期確認
   - 異常なトランザクションパターンの検出

### 運用効率化

1. **自動デプロイスクリプト**
   - Web UI からのワンクリックテナント作成
   - 初期設定の自動化

2. **監視ダッシュボード**
   - 全テナントの稼働状況可視化
   - アラート通知（停止・異常検知）

3. **ドキュメント整備**
   - テナントアドミン向けマニュアル
   - よくある質問（FAQ）

---

## 参考資料

- [アーキテクチャ詳細](./ARCHITECTURE-INTERCONNECTIONS.md)
- [Indexer E2E テスト](./indexer-e2e-checklist.md)
- [RandomRewardEngine ガイド](../contracts/README-RandomRewardEngine.md)

---

**最終更新**: 2025-01-26
**バージョン**: GifterraFactory v1.0.0
