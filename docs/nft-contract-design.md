# Gifterra NFT コントラクト設計

## 概要
現在のSBT専用コントラクトに加えて、通常の譲渡可能NFTをサポートするための新しいコントラクト設計

## アーキテクチャ

### 1. 現在の構造
```
Gifterra SBT Contract (0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC)
├─ SBT (Soulbound Token) のみ
├─ dailyReward システム
├─ tip システム
└─ レベル管理 (userNFTLevel)
```

### 2. 提案する新構造

#### オプション A: 単一拡張コントラクト
```
Gifterra Unified Contract (新デプロイ)
├─ SBT機能 (既存機能移行)
├─ Regular NFT機能 (新機能)
│   ├─ ERC721準拠
│   ├─ 譲渡可能
│   └─ マーケットプレイス対応
├─ Bridge機能
│   ├─ SBT ⟷ NFT 変換
│   └─ レベル連携
└─ 既存システム連携
```

#### オプション B: 分離型アーキテクチャ (推奨)
```
現在のSBTコントラクト (維持)
├─ SBT専用機能
├─ dailyReward システム
└─ 基本レベル管理

Gifterra NFT Contract (新規)
├─ ERC721準拠 NFT
├─ 譲渡可能
├─ メタデータ管理
└─ マーケットプレイス対応

Gifterra Manager Contract (連携)
├─ SBT ⟷ NFT 連携
├─ 統合レベル管理
├─ 権限管理
└─ ファクトリー機能
```

## 実装方針

### Phase 1: NFTコントラクト作成
1. **Gifterra NFT Contract** (ERC721)
   ```solidity
   contract GifterraNFT is ERC721, AccessControl {
       // NFT基本機能
       // メタデータURI管理
       // レベル連携インターフェース
   }
   ```

### Phase 2: 連携システム
1. **Manager Contract** (統合管理)
   ```solidity
   contract GifterraManager {
       // SBTコントラクト参照
       // NFTコントラクト参照
       // レベル同期機能
   }
   ```

### Phase 3: フロントエンド統合
1. **contract.ts 拡張**
   ```typescript
   // 既存SBTコントラクト設定
   export const SBT_CONTRACT = { ... };
   
   // 新NFTコントラクト設定
   export const NFT_CONTRACT = { ... };
   
   // 統合管理
   export const MANAGER_CONTRACT = { ... };
   ```

## 具体的な実装ステップ

### ステップ1: NFTコントラクト開発
- ERC721標準準拠
- レベルベースのメタデータ
- SBTコントラクトとの連携インターフェース

### ステップ2: 連携機能開発
- レベル同期システム
- SBT → NFT 変換機能
- NFT → SBT 変換機能（必要に応じて）

### ステップ3: フロントエンド対応
- NFT表示機能
- 譲渡機能UI
- マーケットプレイス連携

## メリット・デメリット

### オプションA (単一拡張): 
- ✅ シンプルな構造
- ❌ 既存データ移行が必要
- ❌ コントラクトサイズが大きくなる

### オプションB (分離型):
- ✅ 既存システム無影響
- ✅ 段階的導入可能
- ✅ 機能別最適化
- ❌ 複数コントラクト管理

## 推奨アプローチ
**オプションB (分離型)** を推奨
- 現在のSBTシステムを維持
- 新NFT機能を段階的に追加
- リスクを最小化しながら機能拡張