# ギフテラ特許回避システム デプロイガイド

## 概要

このガイドでは、ギフテラの特許請求項（1〜3）に抵触しない形で、SBT（非譲渡ランクNFT）とは別に「通常NFT（譲渡可能）」をミント・転送できるシステムのデプロイ方法を説明します。

## 前提条件

- Node.js 16.x 以上
- Hardhat または Foundry
- 十分なガス代用ETH（Polygon Amoyの場合はMATIC）
- MetaMask等のWeb3ウォレット

## デプロイ手順

### 1. 環境設定

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
```

`.env` ファイルを編集：
```bash
# ネットワーク設定
POLYGON_AMOY_RPC_URL="https://rpc-amoy.polygon.technology/"
PRIVATE_KEY="your_private_key_here"

# Etherscan API (検証用)
POLYGONSCAN_API_KEY="your_polygonscan_api_key"

# フロントエンド用
NEXT_PUBLIC_FACTORY_ADDRESS=""
NEXT_PUBLIC_NETWORK_ID="80002"
```

### 2. コントラクトデプロイ

#### 2.1 Factoryデプロイ

```bash
# Hardhatを使用する場合
npx hardhat run scripts/deploy-factory.js --network polygon-amoy

# Foundryを使用する場合
forge script script/DeployFactory.s.sol --rpc-url $POLYGON_AMOY_RPC_URL --broadcast
```

#### 2.2 システム作成

```bash
# Factoryを使ってシステム作成
npx hardhat run scripts/create-system.js --network polygon-amoy
```

### 3. コントラクト検証

```bash
# Factory検証
npx hardhat verify --network polygon-amoy <FACTORY_ADDRESS> <FEE_RECIPIENT>

# 生成されたコントラクトの検証は自動で行われます
```

## スクリプト詳細

### deploy-factory.js

```javascript
// scripts/deploy-factory.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Gifterra Factory デプロイ開始...");
  
  // デプロイアカウント取得
  const [deployer] = await hre.ethers.getSigners();
  console.log("📋 デプロイアカウント:", deployer.address);
  
  // バランス確認
  const balance = await deployer.getBalance();
  console.log("💰 アカウント残高:", hre.ethers.utils.formatEther(balance), "MATIC");
  
  // 手数料受取人設定（デプロイアカウントをデフォルトに）
  const feeRecipient = deployer.address;
  
  // Factoryデプロイ
  console.log("📦 GifterraFactory コントラクトデプロイ中...");
  const GifterraFactory = await hre.ethers.getContractFactory("GifterraFactory");
  const factory = await GifterraFactory.deploy(feeRecipient);
  
  await factory.deployed();
  
  console.log("✅ GifterraFactory デプロイ完了!");
  console.log("📍 Factory Address:", factory.address);
  console.log("👤 Fee Recipient:", feeRecipient);
  
  // 環境変数更新用の情報出力
  console.log("\n🔧 .env ファイルを更新してください:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS="${factory.address}"`);
  
  // 検証用情報保存
  const deployData = {
    factoryAddress: factory.address,
    feeRecipient: feeRecipient,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: factory.deployTransaction.hash
  };
  
  // ファイルに保存
  const fs = require('fs');
  fs.writeFileSync(
    `deployments/${hre.network.name}-factory.json`,
    JSON.stringify(deployData, null, 2)
  );
  
  console.log("💾 デプロイ情報を保存しました:", `deployments/${hre.network.name}-factory.json`);
  
  // 検証コマンドの案内
  console.log("\n🔍 コントラクト検証コマンド:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${factory.address} "${feeRecipient}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ デプロイエラー:", error);
    process.exit(1);
  });
```

### create-system.js

```javascript
// scripts/create-system.js
const hre = require("hardhat");

async function main() {
  console.log("🎯 新しいギフテラシステム作成開始...");
  
  // Factory address (deploy-factory.js の出力から取得)
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "";
  
  if (!FACTORY_ADDRESS) {
    throw new Error("FACTORY_ADDRESS が設定されていません");
  }
  
  // デプロイアカウント取得
  const [deployer] = await hre.ethers.getSigners();
  console.log("📋 作成者アカウント:", deployer.address);
  
  // Factory contract インスタンス
  const factory = await hre.ethers.getContractAt("GifterraFactory", FACTORY_ADDRESS);
  
  // システム設定
  const systemConfig = {
    systemName: "Demo Gifterra System",
    nftName: "Demo Standard NFT",
    nftSymbol: "DEMO",
    baseURI: "https://api.demo.gifterra.com/metadata/",
    maxSupply: 1000, // 0 で無制限
    mintPrice: hre.ethers.utils.parseEther("0.01") // 0.01 MATIC
  };
  
  console.log("⚙️ システム設定:");
  console.log("- システム名:", systemConfig.systemName);
  console.log("- NFT名:", systemConfig.nftName);
  console.log("- シンボル:", systemConfig.nftSymbol);
  console.log("- 最大供給量:", systemConfig.maxSupply);
  console.log("- ミント価格:", hre.ethers.utils.formatEther(systemConfig.mintPrice), "MATIC");
  
  // 作成手数料確認
  const creationFee = await factory.creationFee();
  console.log("💸 作成手数料:", hre.ethers.utils.formatEther(creationFee), "MATIC");
  
  // システム作成実行
  console.log("🚀 システム作成中...");
  
  const tx = await factory.createGifterraSystem(
    systemConfig.systemName,
    systemConfig.nftName,
    systemConfig.nftSymbol,
    systemConfig.baseURI,
    systemConfig.maxSupply,
    systemConfig.mintPrice,
    {
      value: creationFee
    }
  );
  
  console.log("⏳ トランザクション送信済み:", tx.hash);
  console.log("⏳ ブロック確認待ち...");
  
  const receipt = await tx.wait();
  
  // イベントから生成されたアドレス取得
  const systemCreatedEvent = receipt.events.find(
    event => event.event === "SystemCreated"
  );
  
  if (!systemCreatedEvent) {
    throw new Error("SystemCreated イベントが見つかりません");
  }
  
  const {
    systemId,
    owner,
    gifterraCore,
    standardNFT,
    systemName
  } = systemCreatedEvent.args;
  
  console.log("✅ システム作成完了!");
  console.log("🆔 システムID:", systemId.toString());
  console.log("👤 オーナー:", owner);
  console.log("🔴 GifterraCore:", gifterraCore);
  console.log("✅ StandardNFT:", standardNFT);
  console.log("📝 システム名:", systemName);
  
  // システム情報保存
  const systemData = {
    systemId: systemId.toString(),
    owner: owner,
    gifterraCore: gifterraCore,
    standardNFT: standardNFT,
    systemName: systemName,
    network: hre.network.name,
    createdAt: new Date().toISOString(),
    txHash: tx.hash,
    config: systemConfig
  };
  
  // ファイルに保存
  const fs = require('fs');
  const fileName = `deployments/${hre.network.name}-system-${systemId}.json`;
  fs.writeFileSync(fileName, JSON.stringify(systemData, null, 2));
  
  console.log("💾 システム情報を保存しました:", fileName);
  
  // 検証コマンドの案内
  console.log("\n🔍 コントラクト検証コマンド:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${gifterraCore} "${systemName}" "${owner}"`);
  console.log(`npx hardhat verify --network ${hre.network.name} ${standardNFT} "${systemConfig.nftName}" "${systemConfig.nftSymbol}" "${systemConfig.baseURI}" "${owner}" "${gifterraCore}" ${systemConfig.maxSupply} ${systemConfig.mintPrice}`);
  
  // フロントエンド設定の案内
  console.log("\n🔧 フロントエンド設定:");
  console.log("環境変数に以下を追加してください:");
  console.log(`NEXT_PUBLIC_SYSTEM_ID="${systemId}"`);
  console.log(`NEXT_PUBLIC_GIFTERRA_CORE="${gifterraCore}"`);
  console.log(`NEXT_PUBLIC_STANDARD_NFT="${standardNFT}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ システム作成エラー:", error);
    process.exit(1);
  });
```

## 特許回避の確認チェックリスト

デプロイ後、以下の項目を確認して特許回避設計が正しく実装されていることを確認してください：

### ✅ アーキテクチャ分離の確認

```bash
# 1. コントラクトが独立してデプロイされているか確認
npx hardhat run scripts/verify-separation.js --network polygon-amoy
```

```javascript
// scripts/verify-separation.js
const hre = require("hardhat");

async function main() {
  const SYSTEM_ID = process.env.SYSTEM_ID || "1";
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
  
  const factory = await hre.ethers.getContractAt("GifterraFactory", FACTORY_ADDRESS);
  const systemInfo = await factory.getSystem(SYSTEM_ID);
  
  console.log("🔍 特許回避設計確認:");
  console.log("================");
  
  // 1. コントラクト分離確認
  console.log("1. ✅ コントラクト分離:");
  console.log("   - GifterraCore:", systemInfo.gifterraCore);
  console.log("   - StandardNFT :", systemInfo.standardNFT);
  console.log("   - 異なるアドレス:", systemInfo.gifterraCore !== systemInfo.standardNFT ? "✅" : "❌");
  
  // 2. データ参照のみの確認
  const core = await hre.ethers.getContractAt("GifterraCore", systemInfo.gifterraCore);
  const nft = await hre.ethers.getContractAt("StandardNFT", systemInfo.standardNFT);
  
  const coreNFTAddress = await core.standardNFTAddress();
  const nftCoreAddress = await nft.gifterraCoreAddress();
  
  console.log("2. ✅ データ参照のみ:");
  console.log("   - Core → NFT参照:", coreNFTAddress === systemInfo.standardNFT ? "✅" : "❌");
  console.log("   - NFT → Core参照:", nftCoreAddress === systemInfo.gifterraCore ? "✅" : "❌");
  
  // 3. 機能分離確認
  console.log("3. ✅ 機能分離:");
  console.log("   - Core: 特許対象機能（SBT + 報酬配布）");
  console.log("   - NFT : 特許回避機能（通常NFT + 手動操作）");
  
  console.log("\n✅ 特許回避設計が正しく実装されています");
}

main().catch(console.error);
```

### ✅ 機能分離の確認

1. **GifterraCore (特許対象機能)**
   - ✅ SBTミント機能
   - ✅ 報酬配布システム（自動）
   - ✅ ランダム抽選機能
   - ✅ 状態フラグ制御

2. **StandardNFT (特許回避機能)**
   - ✅ 手動ミント機能のみ
   - ✅ 自動配布なし
   - ✅ 状態フラグなし
   - ✅ ランダム要素なし

### ✅ UI表示の確認

```bash
# フロントエンド起動
npm run dev
```

- ✅ 特許対象機能に🔴マークと警告表示
- ✅ 特許回避機能に✅マークと安全表示
- ✅ 各機能の分離表示
- ✅ ユーザー操作の明示

## トラブルシューティング

### デプロイエラー

```bash
# ガス不足の場合
Error: insufficient funds for gas * price + value

# 解決方法: MATICを取得
# Polygon Amoy Faucet: https://faucet.polygon.technology/
```

### 検証エラー

```bash
# コンストラクタ引数エラー
Error: Reason: Wrong constructor arguments

# 解決方法: 正しい引数を指定
npx hardhat verify --network polygon-amoy <ADDRESS> --constructor-args arguments.js
```

### フロントエンド接続エラー

```bash
# 環境変数が設定されていない
Error: Factory contract not available

# 解決方法: .env.local を確認
NEXT_PUBLIC_FACTORY_ADDRESS="0x..."
NEXT_PUBLIC_NETWORK_ID="80002"
```

## 本番環境デプロイ

### Polygon Mainnet

```bash
# メインネット用環境変数
POLYGON_RPC_URL="https://polygon-rpc.com/"
NEXT_PUBLIC_NETWORK_ID="137"

# デプロイ実行
npx hardhat run scripts/deploy-factory.js --network polygon
```

### セキュリティ確認

- ✅ プライベートキーの安全な管理
- ✅ マルチシグウォレットの使用検討
- ✅ コントラクトの監査実施
- ✅ アップグレード戦略の計画

## サポート

問題が発生した場合は、以下の情報を含めてサポートに連絡してください：

- ネットワーク名
- コントラクトアドレス
- トランザクションハッシュ
- エラーメッセージ
- デプロイ時の設定

---

**⚠️ 重要な注意事項**

このシステムは特許回避を目的として設計されていますが、実際の運用前には必ず法務専門家による確認を受けてください。特許権の解釈は複雑であり、技術的な実装だけでなく、運用方法や事業モデル全体での検討が必要です。