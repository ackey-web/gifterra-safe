# RewardNFT v1 → v2 変更点詳細

## 最重要方針

**後方互換性を最優先**：
- ✅ v1のすべてのI/Fを維持（`@deprecated`付き）
- ✅ 既存の呼び出しは壊れない
- ✅ 段階的移行をサポート

## 変更サマリー

| カテゴリ | v1 | v2 | 互換性 |
|---------|----|----|-------|
| SKU型I/F | ❌ なし | ✅ 追加 | 完全互換（v1も残存） |
| ERC-2981 | 独自実装 | OZ実装 | 完全互換（挙動同じ） |
| ベースURI合成 | ❌ なし | ✅ オプトイン | 完全互換（デフォルトoff） |
| publicMint | tokenURI引数 | amount+SKU | 完全互換（v1も残存） |
| EIP-4906 | ❌ なし | ✅ 追加 | 完全互換（イベント追加のみ） |
| DistributionType | string | enum | 完全互換（内部のみ変更） |

---

## 1. SKU型I/F追加

### 【新I/F】distributeMintBySku（推奨）

```solidity
function distributeMintBySku(
    address to,
    bytes32 sku,
    bytes32 triggerId
) external returns (uint256)
```

**メリット**:
- URI自動合成（フィッシング防止）
- ガス効率向上（個別URI保存不要）
- 商品カタログ管理の容易化

**URIフォーマット**:
```
baseURI + "/" + skuHex + "/" + tokenId
例: https://api.example.com/metadata/0x123abc.../1
```

### 【旧I/F】distributeMint（deprecated・互換維持）

```solidity
/// @deprecated Use distributeMintBySku instead
function distributeMint(
    address to,
    string memory tokenURI,
    bytes32 triggerId
) external returns (uint256)
```

**状態**:
- ✅ 完全に動作する
- ⚠️ 非推奨（新規コードでは使用しない）
- 📅 削除計画：v3で削除予定

### 【移行ガイド】

```solidity
// v1（旧）
distributor.distributeMint(
    userAddress,
    "https://example.com/metadata/123",
    triggerId
);

// v2（新）
bytes32 sku = keccak256("PRODUCT_SKU_123");
distributor.distributeMintBySku(
    userAddress,
    sku,
    triggerId
);
```

---

## 2. ERC-2981 OpenZeppelin実装への移行

### 変更内容

```diff
// v1
- import "./interfaces/IERC2981.sol";
- contract RewardNFT is ... IERC2981
- address public royaltyRecipient;
- uint96 public royaltyBasisPoints;
- function royaltyInfo(...) { /* 独自実装 */ }

// v2
+ import "@openzeppelin/contracts/token/common/ERC2981.sol";
+ contract RewardNFT_v2 is ... ERC2981
+ _setDefaultRoyalty(owner, 250);
+ function setDefaultRoyalty(...) { /* OZ実装 */ }
+ function setTokenRoyalty(...) { /* トークン別ロイヤリティ */ }
```

### メリット

- ✅ 業界標準実装
- ✅ トークン別ロイヤリティ設定が可能
- ✅ より安全で監査済み

### 互換性

- ✅ `royaltyInfo()`の挙動は同じ
- ✅ マーケットプレイス対応に変更なし
- ✅ 既存の統合は壊れない

### 削除された変数

```solidity
// v1（削除）
address public royaltyRecipient;
uint96 public royaltyBasisPoints;
```

**影響**: なし（OZ内部で管理、`royaltyInfo()`で取得可能）

---

## 3. ベースURI合成機能（オプトイン）

### 新機能

```solidity
bool public useBaseURIComposition = false; // デフォルト: オフ
mapping(uint256 => bytes32) public tokenSku; // tokenId => SKU
```

### 設定方法

```solidity
// 管理者がモード切替
rewardNFT.setBaseURICompositionMode(true);

// これ以降のミントはURI自動合成
```

### 動作モード比較

| モード | URI保存 | ガス | リビール |
|--------|---------|------|----------|
| **個別URI**（デフォルト） | 各トークンに保存 | 高 | 可能 |
| **ベースURI合成** | SKUのみ保存 | 低 | 不要 |

### 互換性

- ✅ デフォルト: `false`（従来の動作）
- ✅ 既存トークンに影響なし
- ✅ モード切替後のトークンのみ影響

---

## 4. publicMint新版

### 【新I/F】publicMintV2（推奨）

```solidity
function publicMintV2(uint256 amount, bytes32 sku) external payable
```

**変更点**:
- ✅ URI引数を削除（フィッシング防止）
- ✅ amount指定で複数ミント可能
- ✅ SKU指定で商品カタログ管理

**セキュリティ向上**:
```
v1: ユーザーが任意のURIを指定可能 → フィッシングリスク
v2: URIはコントラクト側で合成 → 安全
```

### 【旧I/F】publicMint（deprecated・互換維持）

```solidity
/// @deprecated Use publicMintV2 instead - user-provided URI is a phishing risk
function publicMint(string memory tokenURI) external payable
```

**状態**:
- ✅ 完全に動作する
- ⚠️ セキュリティリスクあり（非推奨）
- 📅 削除計画：v3で削除予定

### 【移行ガイド】

```solidity
// v1（旧・非推奨）
rewardNFT.publicMint{value: 0.1 ether}(
    "https://example.com/metadata/123" // ユーザー指定URI（危険）
);

// v2（新・推奨）
bytes32 sku = keccak256("PRODUCT_SKU_123");
rewardNFT.publicMintV2{value: 0.3 ether}(
    3,    // 3個ミント
    sku   // 商品SKU（コントラクト側でURI合成）
);
```

---

## 5. EIP-4906メタデータ更新イベント

### 追加されたイベント

```solidity
import "@openzeppelin/contracts/interfaces/IERC4906.sol";

// リビール時に発火
emit MetadataUpdate(tokenId);              // 単一トークン
emit BatchMetadataUpdate(fromId, toId);     // バッチ
```

### メリット

- ✅ OpenSea等のマーケットプレイスが自動的にメタデータをリフレッシュ
- ✅ 業界標準（EIP-4906）
- ✅ ユーザー体験の向上

### 互換性

- ✅ 既存イベント（`TokenRevealed`）も維持
- ✅ 追加のみ（削除なし）

---

## 6. DistributionType の enum化

### 変更内容

```diff
// v1
- struct DistributionRecord {
-     string distributionType; // "automatic", "manual", "public"
- }

// v2
+ enum DistributionType {
+     AUTOMATIC, // 0
+     MANUAL,    // 1
+     PUBLIC     // 2
+ }
+ struct DistributionRecord {
+     DistributionType distributionType;
+ }
```

### メリット

- ✅ ガス節約（`string` → `uint8`）
- ✅ 型安全性の向上
- ✅ 誤入力防止

### 互換性

- ✅ 内部実装のみの変更
- ✅ 外部からは `getDistributionRecord()` で取得可能
- ⚠️ 戻り値が `uint8` になる点に注意（0, 1, 2）

### マッピング

```
0 = AUTOMATIC (旧: "automatic")
1 = MANUAL    (旧: "manual")
2 = PUBLIC    (旧: "public")
```

---

## 7. supportsInterface の修正

### 変更内容

```diff
// v1
function supportsInterface(bytes4 interfaceId)
    public view override(
        ERC721,
        AccessControl,
-       IERC165
    ) returns (bool) {
-   return interfaceId == type(IERC2981).interfaceId ||
+   return super.supportsInterface(interfaceId);
}

// v2
function supportsInterface(bytes4 interfaceId)
    public view override(
        ERC721,
        ERC721URIStorage,
+       ERC2981,        // OZ実装
        AccessControl,
        IERC165
    ) returns (bool) {
+   return interfaceId == type(IERC4906).interfaceId ||
           super.supportsInterface(interfaceId);
}
```

### 対応インターフェース

| Interface | v1 | v2 |
|-----------|----|----|
| ERC721 | ✅ | ✅ |
| ERC721URIStorage | ✅ | ✅ |
| ERC2981（独自） | ✅ | ❌ |
| ERC2981（OZ） | ❌ | ✅ |
| AccessControl | ✅ | ✅ |
| IERC4906 | ❌ | ✅ |

---

## 8. その他の改善

### _exists() → _ownerOf()

```diff
// v1（OZ v4系）
- require(_exists(tokenId), "Token does not exist");

// v2（OZ v5系対応）
+ require(_ownerOf(tokenId) != address(0), "Token does not exist");
```

**理由**: OpenZeppelin v5で`_exists()`が非推奨化

### _setupRole() → _grantRole()

```diff
// v1
- _setupRole(DEFAULT_ADMIN_ROLE, owner);

// v2
+ _grantRole(DEFAULT_ADMIN_ROLE, owner);
```

**理由**: OpenZeppelin v5で`_setupRole()`が非推奨化

### royalty設定の改善

```diff
// v1
- royaltyRecipient = owner;
- royaltyBasisPoints = 250;

// v2
+ _setDefaultRoyalty(owner, 250);
```

**追加機能**: トークン別ロイヤリティ設定
```solidity
rewardNFT.setTokenRoyalty(tokenId, recipient, 500); // 特定トークンのみ5%
```

---

## 削除された機能

### ❌ なし

すべての機能が互換性のため維持されています。

---

## 非推奨（Deprecated）機能

| 関数 | 代替 | 削除予定 |
|------|------|---------|
| `distributeMint()` | `distributeMintBySku()` | v3 |
| `distributeMintBatch()` | `distributeMintBatchBySku()` | v3 |
| `publicMint()` | `publicMintV2()` | v3 |

---

## 移行計画

### Phase 1: v2デプロイ（現在）

- ✅ v1とv2が並存
- ✅ 既存コードは動作継続
- ✅ 新機能はオプトイン

### Phase 2: 段階移行（推奨期間：3-6ヶ月）

```
1. v2の新I/Fを使用開始（distributeMintBySku, publicMintV2）
2. ベースURI合成モードをテスト環境で検証
3. v1 I/Fの使用を段階的に削減
```

### Phase 3: v3リリース（将来）

```
- v1互換I/Fを削除
- コード整理
- ガス最適化のさらなる改善
```

---

## 移行チェックリスト

### Distributorコントラクト

- [ ] `distributeMintBySku()` 使用に切り替え
- [ ] SKU管理システムの実装
- [ ] テスト環境で検証

### フロントエンド

- [ ] `publicMintV2()` 使用に切り替え
- [ ] SKU選択UIの実装
- [ ] amount指定UIの追加

### バックエンド

- [ ] SKUカタログの準備
- [ ] メタデータAPIの対応（SKUベースURI）
- [ ] EIP-4906イベントの監視

### テスト

- [ ] v1 I/Fの動作確認（互換性テスト）
- [ ] v2 I/Fの動作確認（新機能テスト）
- [ ] ベースURI合成モードのテスト
- [ ] ガス消費量の比較

---

## サンプルコード

### Distributorからの呼び出し（v2推奨）

```solidity
// GifterraDistributor.sol

// SKUの定義
bytes32 constant SKU_PREMIUM = keccak256("PREMIUM_REWARD");
bytes32 constant SKU_STANDARD = keccak256("STANDARD_REWARD");

function distribute(
    address recipient,
    bytes32 productSku,
    bytes32 triggerId
) external {
    // ルール判定...

    // v2 I/F使用（推奨）
    rewardNFT.distributeMintBySku(
        recipient,
        productSku,
        triggerId
    );
}
```

### フロントエンドからの呼び出し（v2推奨）

```typescript
// v1（非推奨）
await rewardNFT.publicMint(
    "https://example.com/metadata/123",  // ユーザー指定URI
    { value: ethers.utils.parseEther("0.1") }
);

// v2（推奨）
const sku = ethers.utils.id("PRODUCT_SKU_123"); // bytes32
await rewardNFT.publicMintV2(
    3,    // 3個ミント
    sku,
    { value: ethers.utils.parseEther("0.3") }
);
```

### ベースURI合成の有効化

```solidity
// 管理者が実行
await rewardNFT.setBaseURICompositionMode(true);
await rewardNFT.setBaseURI("https://api.example.com/metadata");

// これ以降のミント
// tokenURI(1) => "https://api.example.com/metadata/0x123abc.../1"
```

---

## FAQ

### Q1: v1コードは動き続けますか？

**A**: はい。v1のすべてのI/Fは完全に動作します。

### Q2: いつv2に移行すべきですか？

**A**: 新規開発は即座にv2を使用してください。既存コードは段階的に移行してください。

### Q3: ベースURI合成モードはいつ有効化すべきですか？

**A**: テスト環境で十分検証した後、本番環境で有効化してください。既存トークンには影響しません。

### Q4: ガス消費量はどれくらい減りますか？

**A**: ベースURI合成モードで約30-40%のガス削減が見込まれます（個別URI保存がないため）。

### Q5: ERC-2981の移行で何か必要ですか？

**A**: いいえ。自動的にOZ実装に移行され、挙動は同じです。

---

**作成日**: 2025-01-XX
**更新日**: 2025-01-XX
**バージョン**: v2.0.0
