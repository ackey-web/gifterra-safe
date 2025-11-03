# Gifterra NFT システム デプロイメント手順

## 概要
現在のSBT専用システムに、譲渡可能NFT機能を追加するためのデプロイメント手順

## Phase 1: NFTコントラクトのデプロイ

### 1.1 前準備
```bash
# 必要なパッケージをインストール
npm install @openzeppelin/contracts
npm install hardhat @nomiclabs/hardhat-ethers ethers
```

### 1.2 GifterraNFT.sol のデプロイ
```javascript
// deploy/01-deploy-nft.js
const { network } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  const SBT_CONTRACT_ADDRESS = "0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC";
  
  await deploy("GifterraNFT", {
    from: deployer,
    args: [
      "Gifterra NFT",
      "GIFTNFT", 
      SBT_CONTRACT_ADDRESS
    ],
    log: true,
  });
};
```

### 1.3 デプロイ実行
```bash
# テストネット（Polygon Amoy）にデプロイ
npx hardhat deploy --network polygonAmoy

# デプロイされたアドレスを確認
npx hardhat verify --network polygonAmoy [NFT_CONTRACT_ADDRESS] "Gifterra NFT" "GIFTNFT" "0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC"
```

## Phase 2: Managerコントラクトのデプロイ

### 2.1 GifterraManager.sol のデプロイ
```javascript
// deploy/02-deploy-manager.js
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  const SBT_CONTRACT_ADDRESS = "0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC";
  const nftDeployment = await deployments.get("GifterraNFT");
  
  await deploy("GifterraManager", {
    from: deployer,
    args: [
      SBT_CONTRACT_ADDRESS,
      nftDeployment.address
    ],
    log: true,
  });
};
```

### 2.2 デプロイ実行
```bash
npx hardhat deploy --network polygonAmoy --tags manager
```

## Phase 3: フロントエンド統合

### 3.1 contract.ts の更新
```typescript
// src/contract.ts に追加
export const NFT_CONTRACT = {
  ADDRESS: getAddress("0x[DEPLOYED_NFT_ADDRESS]"), // デプロイ後に更新
  TYPE: "NFT" as const,
  FEATURES: ["transferable", "marketplace", "metadata"] as const,
} as const;

export const MANAGER_CONTRACT = {
  ADDRESS: getAddress("0x[DEPLOYED_MANAGER_ADDRESS]"), // デプロイ後に更新
  TYPE: "MANAGER" as const,
  FEATURES: ["sbt-nft-bridge", "level-sync", "unified-management"] as const,
} as const;
```

### 3.2 useNFTSystem.ts の有効化
```typescript
// src/hooks/useNFTSystem.ts で以下をコメント解除
import { NFT_CONTRACT, MANAGER_CONTRACT, NFT_ABI, MANAGER_ABI } from "../contract";

const { contract: nftContract } = useContract(
  NFT_CONTRACT.ADDRESS,
  NFT_ABI
);

const { contract: managerContract } = useContract(
  MANAGER_CONTRACT.ADDRESS,
  MANAGER_ABI
);
```

## Phase 4: 権限設定

### 4.1 NFTコントラクトの権限設定
```bash
# ManagerコントラクトにMINTER_ROLEを付与
npx hardhat run scripts/grant-roles.js --network polygonAmoy
```

```javascript
// scripts/grant-roles.js
const { ethers } = require("hardhat");

async function main() {
  const nftContract = await ethers.getContractAt("GifterraNFT", NFT_CONTRACT_ADDRESS);
  const managerContract = await ethers.getContractAt("GifterraManager", MANAGER_CONTRACT_ADDRESS);
  
  // MINTER_ROLE をManagerコントラクトに付与
  const MINTER_ROLE = await nftContract.MINTER_ROLE();
  await nftContract.grantRole(MINTER_ROLE, MANAGER_CONTRACT_ADDRESS);
  
  // Managerコントラクトの設定
  await nftContract.setManagerContract(MANAGER_CONTRACT_ADDRESS);
  
  console.log("Roles granted successfully");
}

main().catch(console.error);
```

## Phase 5: テスト

### 5.1 基本機能テスト
```bash
# コントラクトのテスト実行
npx hardhat test test/nft-system.test.js --network polygonAmoy
```

### 5.2 フロントエンドテスト
```bash
# 開発サーバー起動
pnpm dev

# テスト手順:
# 1. ウォレット接続
# 2. SBTレベル確認
# 3. SBT → NFT 変換テスト
# 4. NFT表示確認
# 5. NFT → SBT 変換テスト
```

## Phase 6: UI コンポーネント追加

### 6.1 NFT変換UIの作成
```typescript
// src/nft-ui/NFTConverter.tsx
import { useNFTSystem } from "../hooks/useNFTSystem";

export function NFTConverter() {
  const { handleSBTtoNFT, userLevel, isConverting } = useNFTSystem();
  
  return (
    <div>
      <h2>SBT → NFT 変換</h2>
      <p>現在のレベル: {userLevel}</p>
      <button 
        onClick={() => handleSBTtoNFT(userLevel)}
        disabled={isConverting || userLevel === 0}
      >
        {isConverting ? "変換中..." : "NFTに変換"}
      </button>
    </div>
  );
}
```

### 6.2 メインアプリへの統合
```typescript
// src/main.tsx に追加
import { NFTConverter } from "./nft-ui/NFTConverter";

// App.tsx にNFTシステムを統合
const { isSystemAvailable } = useNFTSystem();

{isSystemAvailable && <NFTConverter />}
```

## Phase 7: メタデータAPI構築

### 7.1 メタデータサーバー
```javascript
// api/metadata/[level]/[tokenId].js
export default function handler(req, res) {
  const { level, tokenId } = req.query;
  
  const metadata = {
    name: `Gifterra Level ${level} NFT #${tokenId}`,
    description: `A transferable Gifterra NFT representing Level ${level} achievement`,
    image: `https://api.gifterra.io/images/level${level}.png`,
    attributes: [
      { trait_type: "Level", value: parseInt(level) },
      { trait_type: "Transferable", value: "Yes" },
      { trait_type: "Original Type", value: "SBT Conversion" }
    ]
  };
  
  res.status(200).json(metadata);
}
```

## 予想される課題と対策

### 課題1: ガス代最適化
- **対策**: BatchMint機能の実装
- **対策**: Layer2（Polygon）の活用

### 課題2: メタデータの一貫性
- **対策**: IPFS + Pinata を使用した分散ストレージ
- **対策**: オンチェーンメタデータの部分実装

### 課題3: SBT ⟷ NFT レベル同期
- **対策**: イベントベースの同期システム
- **対策**: 定期的な整合性チェック

## 本番運用時の考慮事項

### セキュリティ
- [ ] 権限管理の最小化
- [ ] 緊急停止機能の実装
- [ ] マルチシグウォレットでの管理

### スケーラビリティ
- [ ] Layer2（Polygon）の活用
- [ ] バッチ処理の実装
- [ ] キャッシュシステムの構築

### ユーザビリティ
- [ ] ガス代の説明
- [ ] 変換プロセスの明確化
- [ ] エラーハンドリングの改善

## リリース手順

1. ✅ NFTコントラクトデプロイ
2. ✅ Managerコントラクトデプロイ
3. ✅ 権限設定
4. ✅ テスト実行
5. ✅ フロントエンド統合
6. ✅ メタデータAPI構築
7. 🔄 段階的ユーザーテスト
8. 🔄 本番リリース

この手順に従って、現在のSBTシステムを拡張し、譲渡可能NFTをサポートできます。