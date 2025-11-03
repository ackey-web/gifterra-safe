# StandardNFT → RewardNFT 移行ガイド

## 前提条件の訂正

### 旧認識（誤り）
- 特許出願人が第三者であると誤認
- 特許請求項を回避する必要があると判断
- 自動配布機能を意図的に実装しなかった

### 新認識（正しい）
- **特許出願人はプロジェクトオーナー様**
- 特許請求項に沿った自動配布機能を**実装すべき**
- StandardNFT.solは前提の誤認に基づく設計だった

## コントラクト名称変更

| 旧 | 新 | 理由 |
|----|----|----|
| StandardNFT | RewardNFT | 「報酬器」としての役割を明確化 |

## 主要な設計変更

### 1. ロール追加

```diff
// RewardNFT.sol
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
+ bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE"); // 新規追加
bytes32 public constant REVEALER_ROLE = keccak256("REVEALER_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
```

**DISTRIBUTOR_ROLE**:
- GifterraDistributorコントラクトに付与
- 自動配布ミント関数の実行権限

### 2. Distributorアドレス管理

```diff
// StandardNFT.sol
- address public immutable gifterraCoreAddress; // 参照専用、使用されない

// RewardNFT.sol
+ address public distributorAddress; // 自動配布エンジンのアドレス
```

**変更理由**:
- GifterraCoreは使用しない（Distributorが司令塔）
- Distributorアドレスは動的変更可能

### 3. 配布記録構造体（新規追加）

```solidity
// RewardNFT.sol - 新規追加
struct DistributionRecord {
    address recipient;        // 受取人
    uint256 tokenId;         // トークンID
    uint256 timestamp;       // タイムスタンプ
    string distributionType; // "automatic", "manual", "public"
    bytes32 triggerId;       // トリガー識別子（PaySplitterのイベントIDなど）
}

mapping(uint256 => DistributionRecord) public distributionRecords;
```

**用途**:
- 配布経緯の追跡
- 統計情報の収集
- トリガーとの紐付け

### 4. 統計情報拡張

```diff
// 既存
uint256 public totalRevenue;

// 新規追加
+ uint256 public totalDistributions;
+ uint256 public automaticDistributionCount; // 自動配布数
+ uint256 public manualDistributionCount;    // 手動配布数
```

### 5. 自動配布ミント関数（新規追加）

```solidity
// RewardNFT.sol - 新規追加
/**
 * @notice 自動配布ミント（Distributorからの呼び出し専用）
 * @dev 特許請求項に沿った自動配布機能
 */
function distributeMint(
    address to,
    string memory tokenURI,
    bytes32 triggerId
) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused nonReentrant returns (uint256)
```

**StandardNFT.solにはない機能**:
- Distributor専用のミント関数
- トリガーIDの記録
- 配布タイプの自動設定（"automatic"）

### 6. バッチ自動配布（新規追加）

```solidity
// RewardNFT.sol - 新規追加
function distributeMintBatch(
    address[] calldata recipients,
    string[] calldata tokenURIs,
    bytes32 triggerId
) external onlyRole(DISTRIBUTOR_ROLE) returns (uint256[] memory)
```

**特徴**:
- 最大50アドレスへの一括配布
- ガス効率化
- 配布記録の一括保存

### 7. Distributor管理関数（新規追加）

```solidity
// RewardNFT.sol - 新規追加
function setDistributor(address newDistributor)
    external onlyRole(DEFAULT_ADMIN_ROLE)
```

**機能**:
- Distributorアドレスの動的変更
- 自動的にDISTRIBUTOR_ROLEを付与/取り消し

### 8. イベント追加

```diff
// 既存イベント
event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI);

// 変更後（引数追加）
- event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
+ event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI, string distributionType);

// 新規イベント
+ event AutomaticDistribution(
+     address indexed distributor,
+     address indexed recipient,
+     uint256 indexed tokenId,
+     bytes32 triggerId
+ );
+ event DistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
```

## コメントの変更

### StandardNFT.sol（旧）
```solidity
/**
 * 【特許回避設計の徹底】
 * ❌ 避けている特許対象機能：
 * - 自動配布機能（請求項1,3）
 * - NFT属性に基づく報酬配布（請求項1）
 * ...
 */
```

### RewardNFT.sol（新）
```solidity
/**
 * 【特許整合設計】
 * ✅ 実装する特許対象機能：
 * - 自動配布エンジン（GifterraDistributor）からのミント受付
 * - NFT属性に基づく報酬配布サポート
 * - メタデータの自動設定
 * - 配布ルールに基づくミント実行
 */
```

## 削除された機能

### gifterraCoreAddress
```diff
// StandardNFT.sol
- address public immutable gifterraCoreAddress;
-
- function getGifterraCoreInfo() external view returns (address) {
-     return gifterraCoreAddress;
- }
```

**削除理由**:
- GifterraCoreとの直接連携は不要
- Distributorが中間層として機能

## コンストラクタの変更

```diff
constructor(
    string memory name,
    string memory symbol,
    string memory baseURI,
    address owner,
-   address _gifterraCoreAddress,  // 削除
+   address _distributorAddress,   // 追加
    uint256 _maxSupply,
    uint256 _mintPrice
) ERC721(name, symbol) {
    require(owner != address(0), "Owner cannot be zero address");
-   require(_gifterraCoreAddress != address(0), "GifterraCore address cannot be zero");

    _baseTokenURI = baseURI;
-   gifterraCoreAddress = _gifterraCoreAddress;
+   distributorAddress = _distributorAddress;
    maxSupply = _maxSupply;
    mintPrice = _mintPrice;
    maxMintPerAddress = 10;

    _setupRole(DEFAULT_ADMIN_ROLE, owner);
    _setupRole(MINTER_ROLE, owner);
    _setupRole(REVEALER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);

+   // Distributorにミント権限を付与
+   if (_distributorAddress != address(0)) {
+       _setupRole(DISTRIBUTOR_ROLE, _distributorAddress);
+   }

    royaltyRecipient = owner;
    royaltyBasisPoints = 250;
}
```

## 既存機能（変更なし）

以下の機能はStandardNFT.solから変更なし：

- ✅ 手動ミント（mint, mintBatch）
- ✅ 有料ミント（publicMint）
- ✅ リビール機能（reveal, revealBatch）
- ✅ ロイヤリティ設定（setRoyalty）
- ✅ 各種設定関数（setBaseURI, setMintPrice, など）
- ✅ 売上引き出し（withdraw）
- ✅ 緊急停止（pause, unpause）
- ✅ ERC-721標準機能
- ✅ ERC-2981ロイヤリティ

## デプロイ時の注意点

### StandardNFT.sol のデプロイパラメータ
```solidity
StandardNFT(
    "My NFT",
    "MNFT",
    "https://example.com/metadata/",
    0x1234..., // owner
    0x5678..., // gifterraCoreAddress ← 実際には使用されない
    1000,      // maxSupply
    0.1 ether  // mintPrice
)
```

### RewardNFT.sol のデプロイパラメータ
```solidity
RewardNFT(
    "My Reward NFT",
    "RNFT",
    "https://example.com/metadata/",
    0x1234..., // owner
    0xABCD..., // distributorAddress ← GifterraDistributorのアドレス
    1000,      // maxSupply
    0.1 ether  // mintPrice
)
```

## 移行手順

### 1. 新コントラクトのデプロイ

```bash
# RewardNFT.solをデプロイ
# デプロイ時にdistributorAddressを指定
```

### 2. GifterraDistributorのデプロイ

```bash
# GifterraDistributorをデプロイ
# デプロイ時にRewardNFTアドレスを指定
```

### 3. 権限設定確認

```solidity
// RewardNFTでDistributorロールが正しく設定されているか確認
rewardNFT.hasRole(DISTRIBUTOR_ROLE, distributorAddress); // true
```

### 4. 自動配布テスト

```solidity
// Distributorから配布テスト
distributor.distribute(userAddress, tokenURI, triggerId);
```

## バージョン情報

```solidity
// StandardNFT.sol
function version() external pure returns (string memory) {
    return "StandardNFT v1.0.0 - Patent Safe Design";
}

// RewardNFT.sol
function version() external pure returns (string memory) {
    return "RewardNFT v1.0.0 - Patent Compliant Design (Automatic Distribution Enabled)";
}
```

## まとめ

| カテゴリ | StandardNFT | RewardNFT | 変更内容 |
|---------|-------------|-----------|---------|
| **設計思想** | 特許回避 | 特許整合 | 前提条件の訂正 |
| **自動配布** | ❌ | ✅ | distributeMint追加 |
| **Distributorロール** | ❌ | ✅ | DISTRIBUTOR_ROLE追加 |
| **配布記録** | ❌ | ✅ | DistributionRecord構造体 |
| **統計** | 基本のみ | 詳細統計 | タイプ別カウント |
| **GifterraCore** | 参照のみ | 使用しない | Distributorに移行 |
| **既存機能** | ✅ | ✅ | すべて維持 |

---

**移行推奨**: 新規プロジェクトは RewardNFT.sol を使用
**既存プロジェクト**: StandardNFT.sol からの移行を推奨（自動配布機能の活用のため）
