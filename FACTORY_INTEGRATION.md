# GifterraFactory統合ガイド

## 概要

GifterraFactoryは、マルチテナントSaaSアーキテクチャを実現するための中核コントラクトです。各テナント（店舗や組織）に必要なコントラクトセットを一括デプロイします。

## 🏗️ アーキテクチャ

### グローバル共有リソース

```
GifterraFactory (Singleton)
├── RankPlanRegistry (全テナント共用)
├── globalPaymentGateway (全テナント共用) ← PaymentGatewayWithPermit
└── jpycToken (JPYC address)
```

### テナントごとのリソース

```
TenantContracts
├── gifterra (Gifterra SBT) ← 必須
├── rewardNFT (RewardNFT_v2) ← オプション（個別デプロイ可能）
├── payLitter (GifterraPaySplitter) ← オプション（個別デプロイ可能）
├── flagNFT (FlagNFT) ← オプション（個別デプロイ可能）
└── paymentGateway: globalPaymentGateway ← 共有インスタンスを参照
```

## 📋 デプロイ手順

### 1. 環境変数設定

`.env`ファイルに以下を設定：

```bash
# デプロイアカウント
PRIVATE_KEY=your_private_key

# ネットワーク設定
POLYGON_RPC_URL=https://polygon-rpc.com/
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# JPYCトークンアドレス（Polygon Mainnet）
JPYC_MAINNET_ADDRESS=0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c

# PaymentGateway（既にデプロイ済み）
VITE_PAYMENT_GATEWAY_ADDRESS=0x9e9a065637323CDfC7c7C8185425fCE248854c9E

# 手数料設定
FEE_RECIPIENT=0x66F1274aD5d042b7571C2EfA943370dbcd3459aB
DEPLOYMENT_FEE=10  # 10 MATIC on Polygon
```

### 2. Factoryデプロイ

```bash
# Polygon Mainnet
npx hardhat run scripts/deploy-complete-factory.cjs --network polygon_mainnet

# Polygon Amoy（テストネット）
npx hardhat run scripts/deploy-complete-factory.cjs --network polygon_amoy

# ローカル開発
npx hardhat run scripts/deploy-complete-factory.cjs --network hardhat
```

### 3. PaymentGatewayの設定

デプロイ後、Factory ownerが設定：

```solidity
// 1. PaymentGatewayアドレスを設定
factory.setGlobalPaymentGateway("0x9e9a065637323CDfC7c7C8185425fCE248854c9E");

// 2. RankPlanRegistryを設定（デプロイスクリプトで自動設定済み）
factory.setRankPlanRegistry(rankPlanRegistryAddress);
```

## 🎯 テナント作成フロー

### 基本的な使い方

```solidity
// 1. テナント作成（デプロイ手数料を送信）
factory.createTenant{value: deploymentFee}(
    "MyStore",           // テナント名
    adminAddress,        // テナント管理者アドレス
    jpycAddress,         // 報酬トークン（JPYC）
    0                    // プランタイプ（0=STUDIO, 1=STUDIO_PRO, 2=STUDIO_PRO_MAX）
);

// 2. 作成されたテナント情報を取得
TenantContracts memory tenant = factory.getTenantByOwner(adminAddress);

// 取得できる情報：
// - tenant.gifterra: Gifterraコントラクトアドレス
// - tenant.rewardNFT: address(0) (オプション)
// - tenant.payLitter: address(0) (オプション)
// - tenant.flagNFT: address(0) (オプション)
// - tenant.paymentGateway: globalPaymentGateway (共有インスタンス)
```

### オプショナルコントラクトの個別デプロイ

必要に応じて、後から個別にデプロイ可能：

```bash
# RewardNFT_v2
npx hardhat run scripts/deploy-reward-nft.js --network polygon_mainnet

# FlagNFT
npx hardhat run scripts/deploy-flag-nft.js --network polygon_mainnet

# GifterraPaySplitter
npx hardhat run scripts/deploy-pay-splitter.js --network polygon_mainnet
```

## 💰 PaymentGateway統合詳細

### 共有モデルの利点

1. **コントラクトサイズ削減**
   - Factory本体が24KB制限内に収まる
   - 各テナントデプロイのガスコスト削減

2. **手数料の一元管理**
   - 全テナント共通の手数料設定
   - プラットフォーム収益の一元管理

3. **アップグレード容易性**
   - PaymentGatewayのみ個別にアップグレード可能
   - Factoryの再デプロイ不要

### 手数料設定

PaymentGateway ownerが設定可能：

```solidity
// 手数料率設定（基数: 10000 = 100%）
paymentGateway.setPlatformFeeRate(250); // 2.5%

// 手数料受取人設定
paymentGateway.setPlatformFeeRecipient(platformAddress);
```

**現在の設定**：
- 手数料率: 0%（デフォルト、後で設定可能）
- 受取人: デプロイヤーアドレス

### 手数料計算例

```javascript
// 例: 1,000 JPYC の決済、手数料率 2.5%
const amount = 1000 * 10**18; // 1,000 JPYC (18 decimals)
const feeRate = 250; // 2.5%

const platformFee = (amount * feeRate) / 10000; // 25 JPYC
const merchantAmount = amount - platformFee;     // 975 JPYC

// 結果：
// - 店舗受取: 975 JPYC
// - プラットフォーム: 25 JPYC
```

## 🔐 アクセス制御

### Factoryのロール

```solidity
// DEFAULT_ADMIN_ROLE: 全権限管理
// SUPER_ADMIN_ROLE: Factory設定変更、テナント削除
// OPERATOR_ROLE: 手数料率変更、一時停止
```

### PaymentGatewayのロール

```solidity
// Owner: 手数料設定、一時停止/解除
// すべてのユーザー: executePaymentWithPermit（決済実行）
```

## 📊 コントラクトサイズ最適化の歴史

Factory統合時にコントラクトサイズ制限（24KB）に直面し、以下の最適化を実施：

### 最適化プロセス

| 段階 | 変更内容 | サイズ | 削減量 |
|------|---------|--------|--------|
| 初期 | PaymentGateway各テナントデプロイ | 94,914 bytes | - |
| 1 | RandomRewardEngine削除 | 79,982 bytes | -14.9KB |
| 2 | PaymentGateway共有化 | 76,349 bytes | -3.6KB |
| 3 | RewardNFT/FlagNFTオプション化 | 32,269 bytes | -44KB |
| 4 | PaySplitterオプション化 | **24,450 bytes** | -7.7KB |

**結果**: 73%のサイズ削減に成功 ✅

### 現在のコントラクトサイズ

```
GifterraFactory: 24,450 bytes (99.49% 使用)
制限: 24,576 bytes
残り: 126 bytes
```

### オプショナルコントラクトのサイズ

追加できなかった理由：

| コントラクト | サイズ | 備考 |
|-------------|--------|------|
| GifterraPaySplitter | 8,331 bytes (8.14 KB) | 最小だが追加不可 |
| FlagNFT | 18,137 bytes (17.71 KB) | スタンプラリー機能 |
| RewardNFT_v2 | 25,305 bytes (24.71 KB) | 報酬NFT配布 |

**結論**: 残り126バイトでは追加不可。オプション個別デプロイ方式を採用。

### 最適化設定（hardhat.config.cjs）

```javascript
{
  version: "0.8.19",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1  // 最小化してデプロイサイズ優先
    },
    viaIR: true  // より良い最適化
  }
}
```

## 🧪 テスト

### ローカルテスト

```bash
# 1. ローカルノード起動
npx hardhat node

# 2. 別ターミナルでデプロイ
npx hardhat run scripts/deploy-complete-factory.cjs --network localhost

# 3. テナント作成テスト
npx hardhat run scripts/create-tenant.js --network localhost
```

### ネットワーク別設定

```javascript
// hardhat.config.cjs
networks: {
  hardhat: {
    chainId: 1337,
    allowUnlimitedContractSize: true  // テスト用
  },
  polygon_mainnet: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 137
  },
  polygon_amoy: {
    url: process.env.AMOY_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 80002
  }
}
```

## 📝 デプロイ後の設定チェックリスト

- [ ] RankPlanRegistry がリンクされている
- [ ] globalPaymentGateway が設定されている
- [ ] jpycToken アドレスが正しい
- [ ] deploymentFee が適切な金額
- [ ] feeRecipient が正しいアドレス
- [ ] Deployer が必要なロールを保持している
- [ ] PaymentGateway の手数料設定を確認
- [ ] テストテナントで動作確認

## 🚀 本番デプロイ後のアクション

1. **コントラクト検証**
   ```bash
   # RankPlanRegistry
   npx hardhat verify --network polygon_mainnet <address>

   # GifterraFactory
   npx hardhat verify --network polygon_mainnet <address> \
     "<feeRecipient>" "<deploymentFee>" "<jpycAddress>"
   ```

2. **環境変数更新**
   ```bash
   VITE_RANK_PLAN_REGISTRY_ADDRESS=<address>
   VITE_GIFTERRA_FACTORY_ADDRESS=<address>
   VITE_NETWORK_CHAIN_ID=137
   ```

3. **フロントエンド設定**
   - `src/config/contracts.ts` のアドレス更新
   - Factoryコントラクトとの統合テスト
   - PaymentTerminalでガスレス決済テスト

4. **監視設定**
   - Polygonscanでイベント監視
   - Supabaseで決済記録管理
   - 手数料収益の追跡

## ⚠️ 注意事項

### セキュリティ

1. **PRIVATE_KEYの管理**
   - `.env` ファイルは絶対にコミットしない
   - 本番環境では環境変数として設定

2. **ロール管理**
   - デプロイ後、必要に応じてロールを移譲
   - マルチシグウォレットの使用を推奨

3. **手数料設定**
   - 変更は慎重に（全テナントに影響）
   - 事前にテストネットで確認

### 運用

1. **ガス価格**
   - Polygonのガス価格を事前確認
   - デプロイ時は余裕を持ったガスリミット

2. **コントラクトサイズ**
   - 将来的な機能追加時は24KB制限に注意
   - 必要に応じてプロキシパターンを検討

3. **アップグレード**
   - PaymentGatewayは別途管理されるため個別アップグレード可能
   - Factory本体のアップグレードには注意が必要

## 📚 関連ドキュメント

- [GASLESS_IMPLEMENTATION_COMPLETE.md](GASLESS_IMPLEMENTATION_COMPLETE.md) - ガスレス決済の詳細
- [GASLESS_INTEGRATION_GUIDE.md](GASLESS_INTEGRATION_GUIDE.md) - フロントエンド統合
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - PaymentGatewayデプロイ手順
- [contracts/GifterraFactory.sol](contracts/GifterraFactory.sol) - Factoryコントラクトソース

## 🔗 コントラクトアドレス（Polygon Mainnet）

- **PaymentGatewayWithPermit**: `0x9e9a065637323CDfC7c7C8185425fCE248854c9E`
- **JPYC Token**: `0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c`
- **GifterraFactory**: 未デプロイ（次回デプロイ予定）
- **RankPlanRegistry**: 未デプロイ（Factoryと同時デプロイ）

---

**最終更新**: 2025-11-26
**ステータス**: ✅ 統合完了・デプロイ準備完了
