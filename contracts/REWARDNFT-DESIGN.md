# RewardNFT.sol - 特許整合版設計書

## 概要

**RewardNFT**は通常NFT（譲渡可能）として機能する「報酬器」コントラクトです。特許出願人による実装であり、特許請求項に沿った自動配布機構を実装しています。

## 前提条件の訂正

- **特許出願人**: プロジェクトオーナー様
- **特許整合性**: 特許請求項に沿った「自動配布」機構の実装を**許容**
- **旧設計（StandardNFT.sol）**: 特許回避設計だったが、前提条件の誤認に基づいていた

## 役割分離（確定版）

### 1. RewardNFT（このコントラクト）
**役割**: NFTの発行器（ミント実行とメタデータ提供に特化）

- ✅ Distributorからのミント要求を受け付ける
- ✅ メタデータを設定してNFTを発行
- ✅ 配布記録を保存（統計・追跡用）
- ❌ 判定ロジックは持たない（Distributorに委譲）

### 2. GifterraDistributor（別コントラクト）
**役割**: 自動配布エンジン（トリガ受領→ルール判定→配布実行の司令塔）

- ✅ PaySplitterからのイベントをトリガーとして受信
- ✅ JourneyPassのフラグを確認
- ✅ 配布ルールに基づいて判定
- ✅ RewardNFTに対してミント命令を送信

### 3. PaySplitter
**役割**: 支払い受け口（イベント発火）

- ✅ 支払いを受け取る
- ✅ イベントを発火してDistributorに通知

### 4. JourneyPass
**役割**: フラグ付きNFT（状態保持）

- ✅ ユーザーの状態フラグを保持
- ✅ Distributorが参照する

## 特許整合版の主要機能

### 1. 自動配布ミント機能

```solidity
function distributeMint(
    address to,
    string memory tokenURI,
    bytes32 triggerId
) external onlyRole(DISTRIBUTOR_ROLE) returns (uint256)
```

**特徴**:
- GifterraDistributorからの呼び出し専用（DISTRIBUTOR_ROLE必須）
- 判定済みの配布要求を実行する「発行器」として機能
- トリガーID（PaySplitterのイベントIDなど）を記録
- 配布記録を自動保存

**特許整合性**:
- 特許請求項の「自動配布」機構に対応
- NFT属性に基づく報酬配布をサポート
- 配布ルールに基づくミント実行

### 2. バッチ自動配布

```solidity
function distributeMintBatch(
    address[] calldata recipients,
    string[] calldata tokenURIs,
    bytes32 triggerId
) external onlyRole(DISTRIBUTOR_ROLE) returns (uint256[] memory)
```

**特徴**:
- 最大50アドレスへの一括配布
- ガス効率の最適化
- 配布記録の一括保存

### 3. 配布記録管理

```solidity
struct DistributionRecord {
    address recipient;        // 受取人
    uint256 tokenId;         // トークンID
    uint256 timestamp;       // タイムスタンプ
    string distributionType; // "automatic", "manual", "public"
    bytes32 triggerId;       // トリガー識別子
}
```

**追跡可能な情報**:
- 自動配布数（automaticDistributionCount）
- 手動配布数（manualDistributionCount）
- 総配布数（totalDistributions）
- 各トークンの配布経緯

### 4. Distributor管理

```solidity
function setDistributor(address newDistributor)
    external onlyRole(DEFAULT_ADMIN_ROLE)
```

**特徴**:
- Distributorアドレスの動的変更
- 自動的にDISTRIBUTOR_ROLEを付与/取り消し
- 複数Distributorの管理も可能（ロール追加で実現）

## StandardNFT.sol からの変更点

| 項目 | StandardNFT（旧） | RewardNFT（新） |
|------|------------------|----------------|
| **設計思想** | 特許回避 | 特許整合 |
| **自動配布** | ❌ 実装なし | ✅ 実装あり（distributeMint） |
| **Distributorロール** | ❌ なし | ✅ DISTRIBUTOR_ROLE追加 |
| **配布記録** | ❌ なし | ✅ DistributionRecord構造体 |
| **トリガー追跡** | ❌ なし | ✅ triggerIdで追跡 |
| **統計機能** | 基本のみ | 配布タイプ別統計 |
| **GifterraCore連携** | 参照のみ | Distributor経由で連携 |
| **コメント** | "特許回避設計" | "特許整合設計" |

## 実装済み機能（既存維持）

以下の機能はStandardNFT.solから引き継ぎ：

### ✅ アクセス制御
- DEFAULT_ADMIN_ROLE
- MINTER_ROLE（手動ミント用）
- REVEALER_ROLE（リビール用）
- PAUSER_ROLE（緊急停止用）

### ✅ メタデータ管理
- リビール機能（段階的情報公開）
- バッチリビール
- PreRevealURI設定

### ✅ ロイヤリティ設定
- ERC-2981対応
- 動的なロイヤリティ設定
- 最大10%制限

### ✅ 有料ミント機能
- パブリックミント
- ミント制限（アドレス毎）
- 売上引き出し

### ✅ 緊急機能
- Pausable（一時停止）
- ReentrancyGuard（再入攻撃防御）

## 使用フロー例

### 自動配布フロー

```
1. ユーザーがPaySplitterに支払い
   ↓
2. PaySplitterがイベント発火
   ↓
3. GifterraDistributorがイベント検知
   ↓
4. Distributorが配布ルールを判定
   - JourneyPassのフラグ確認
   - 配布条件の評価
   ↓
5. DistributorがRewardNFT.distributeMint()を呼び出し
   ↓
6. RewardNFTがNFTを発行
   - メタデータ設定
   - 配布記録保存
   - イベント発火
   ↓
7. ユーザーがNFTを受領
```

### 手動ミントフロー

```
1. 管理者がmint()を直接呼び出し
   ↓
2. RewardNFTがNFTを発行
   - 配布タイプ: "manual"
   - triggerId: bytes32(0)
```

## セキュリティ設計

### ロール分離
- Distributor専用関数: `onlyRole(DISTRIBUTOR_ROLE)`
- 管理者専用関数: `onlyRole(DEFAULT_ADMIN_ROLE)`
- ミンター専用関数: `onlyRole(MINTER_ROLE)`

### 再入攻撃防御
- すべてのミント関数に`nonReentrant`修飾子
- 状態変更 → 外部呼び出しの順序を厳守

### 緊急停止
- Pausable実装
- 管理者による一時停止が可能

## ガス最適化

- バッチ処理の実装（最大50アドレス）
- 不要な計算の削減
- イベントによるオフチェーン追跡

## 今後の拡張性

### 対応可能な拡張
1. 複数Distributorの同時運用
2. 配布条件の動的変更（Distributor側）
3. メタデータの動的生成
4. クロスチェーン配布（Bridge経由）

### Distributor側で実装予定の機能
- ランダム抽選ロジック
- NFT属性に基づく配布判定
- GLB/トークンの同時配布
- 状態フラグの参照と更新

## バージョン情報

- **Contract Name**: RewardNFT
- **Version**: v1.0.0
- **Design**: Patent Compliant Design (Automatic Distribution Enabled)
- **License**: MIT
- **Compiler**: Solidity ^0.8.19

## 参考資料

- OpenZeppelin Contracts: v4.x
- ERC-721: Non-Fungible Token Standard
- ERC-2981: NFT Royalty Standard
- 特許請求項: [特許番号/出願番号を記載]

---

**作成日**: 2025-01-XX
**更新日**: 2025-01-XX
**作成者**: Claude Code with Project Owner
