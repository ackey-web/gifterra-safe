# Gifterra NFT コントラクト開発仕様書

## 📝 要件定義

### 基本機能
- [x] ERC721準拠
- [x] レベルベースNFT (1-5)
- [x] SBTからの変換機能
- [x] メタデータ管理
- [x] マーケットプレイス対応

### 拡張機能
- [ ] バッチミント機能
- [ ] ロイヤリティ機能 (EIP-2981)
- [ ] 期間限定ミント
- [ ] ホワイトリスト機能
- [ ] リビール機能

### セキュリティ要件
- [x] AccessControl (役割ベース権限)
- [x] Pausable (緊急停止)
- [x] ReentrancyGuard (再帰攻撃防止)
- [ ] 署名検証 (オフチェーン認証)
- [ ] Rate Limiting (レート制限)

## 🎯 実装すべき機能

### 1. **基本NFT機能**
```solidity
contract GifterraNFT is ERC721, ERC721URIStorage, ERC2981, AccessControl, Pausable {
    // レベルベースミント
    function mintLevelNFT(address to, uint256 level) external;
    
    // バッチミント (ガス効率化)
    function batchMint(address[] calldata recipients, uint256[] calldata levels) external;
    
    // メタデータ管理
    function setTokenURI(uint256 tokenId, string calldata uri) external;
    function setLevelBaseURI(uint256 level, string calldata baseURI) external;
}
```

### 2. **マーケットプレイス機能**
```solidity
contract GifterraMarketplace {
    // 固定価格販売
    function listForSale(uint256 tokenId, uint256 price) external;
    function buyNFT(uint256 tokenId) external payable;
    
    // オークション
    function createAuction(uint256 tokenId, uint256 startPrice, uint256 duration) external;
    function placeBid(uint256 auctionId) external payable;
    function finalizeAuction(uint256 auctionId) external;
}
```

### 3. **SBT連携機能**
```solidity
contract GifterraManager {
    // レベル同期
    function syncLevels(address user) external;
    
    // 変換機能
    function convertSBTtoNFT(uint256 sbtLevel) external returns (uint256 tokenId);
    function convertNFTtoSBT(uint256 tokenId) external;
    
    // 統合レベル管理
    function getUserMaxLevel(address user) external view returns (uint256);
}
```

## 🔧 技術詳細

### Gas最適化
- PackedStruct使用でストレージ節約
- バッチ処理でトランザクション数削減  
- Event indexing最適化

### メタデータ設計
```json
{
  "name": "Gifterra Level 3 NFT #123",
  "description": "A transferable Gifterra NFT representing Level 3 achievement",
  "image": "https://api.gifterra.io/images/level3/123.png",
  "animation_url": "https://api.gifterra.io/animations/level3/123.mp4",
  "attributes": [
    {"trait_type": "Level", "value": 3},
    {"trait_type": "Rarity", "value": "Rare"},
    {"trait_type": "Type", "value": "Transferable"},
    {"trait_type": "Origin", "value": "SBT Conversion"}
  ]
}
```

## 🚀 デプロイ・テスト計画

### Phase 1: 基本機能テスト
```bash
npx hardhat test test/GifterraNFT.basic.test.js
npx hardhat test test/GifterraManager.test.js
```

### Phase 2: 統合テスト  
```bash
npx hardhat test test/integration.test.js
```

### Phase 3: 本番デプロイ
```bash
npx hardhat deploy --network polygonAmoy
npx hardhat verify --network polygonAmoy [CONTRACT_ADDRESS]
```

## 💡 今後の拡張予定

### マーケットプレイス統合
- OpenSea対応
- Rarible対応  
- 独自マーケットプレイス

### ゲーミフィケーション
- NFTスタッキング
- レベルアップシステム
- 期間限定イベント

### クロスチェーン対応
- Polygon ↔ Ethereum ブリッジ
- レイヤー2対応