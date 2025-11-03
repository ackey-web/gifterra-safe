# JourneyPass v1.0.0 設計書（FlaggedNFT）

## 概要

JourneyPass v1.0.0 は、フラグ（スタンプ/状態）を保持するNFTです。スタンプラリー用途を主としつつ、将来は契約/承認/KYC等にも拡張予定です。

### 目的

- **スタンプラリー**: 各トークンが最大256個のスタンプ（ビットフラグ）を保持
- **状態管理**: NFTに紐づく進捗や承認状態を追跡
- **イベント発火**: Distributor やバックエンドが購読できるイベント
- **単独動作**: 他のコントラクト（RewardNFT/PaySplitter）に依存しない

## アーキテクチャ

### 役割分離

```
┌──────────────────────────┐
│  バックエンド/NFC検証     │
│  (FLAG_SETTER_ROLE)       │
└────────────┬─────────────┘
             │ setFlag / setFlagsByMask
             ▼
┌──────────────────────────────────────┐
│         JourneyPass v1               │
│  - フラグ保持（256ビット）            │
│  - フラグ更新                        │
│  - イベント発火                      │
│  - 進捗照会                          │
└────────────┬─────────────────────────┘
             │ イベント購読（将来）
             ▼
┌──────────────────────────────────────┐
│   GifterraDistributor（将来実装）    │
│  - FlagUpdated 購読                  │
│  - ルール判定（完了時に報酬配布等）   │
│  - RewardNFT への自動ミント          │
└──────────────────────────────────────┘
```

### 継承構造

```solidity
JourneyPass
  ├─ ERC721 (OpenZeppelin)
  ├─ AccessControl (OpenZeppelin)
  ├─ Pausable (OpenZeppelin)
  ├─ ReentrancyGuard (OpenZeppelin)
  └─ IERC4906 (EIP-4906 Metadata Update)
```

## 主要機能

### 1. ミント機能

#### mint()

```solidity
function mint(address to)
    external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant
    returns (uint256)
```

- **目的**: 単一トークンの発行
- **権限**: MINTER_ROLE のみ
- **制限**: maxSupply 超過時は revert
- **イベント**: JourneyPassMinted

#### mintBatch()

```solidity
function mintBatch(address[] calldata recipients)
    external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant
    returns (uint256[] memory tokenIds)
```

- **目的**: 複数トークンの一括発行
- **制限**:
  - バッチサイズ ≤ 50
  - maxSupply 超過時は revert
- **イベント**: 各トークンに対して JourneyPassMinted

### 2. フラグ更新機能

#### setFlag()

```solidity
function setFlag(
    uint256 tokenId,
    uint8 bit,
    bool value,
    bytes32 traceId
) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant
```

- **目的**: 単一ビットのフラグを更新
- **権限**: FLAG_SETTER_ROLE のみ
- **パラメータ**:
  - `tokenId`: トークンID
  - `bit`: ビット位置（0〜255）
  - `value`: true = セット, false = クリア
  - `traceId`: NFC/注文ID等のトレース識別子
- **イベント**:
  - FlagUpdated
  - MetadataUpdate（EIP-4906）

#### setFlagsByMask()

```solidity
function setFlagsByMask(
    uint256 tokenId,
    uint256 setMask,
    uint256 clearMask,
    bytes32 traceId
) external onlyRole(FLAG_SETTER_ROLE) whenNotPaused nonReentrant
```

- **目的**: マスクを使用して複数ビットを一括更新
- **権限**: FLAG_SETTER_ROLE のみ
- **パラメータ**:
  - `setMask`: セットするビットマスク
  - `clearMask`: クリアするビットマスク
  - `traceId`: トレース識別子
- **制限**: setMask と clearMask の重複は禁止
- **イベント**:
  - FlagsBatchUpdated
  - MetadataUpdate（EIP-4906）

### 3. View 関数

#### flagsOf()

```solidity
function flagsOf(uint256 tokenId) external view returns (uint256)
```

- **目的**: トークンのフラグ（256ビット）を取得
- **戻り値**: フラグの全ビット

#### hasFlag()

```solidity
function hasFlag(uint256 tokenId, uint8 bit) external view returns (bool)
```

- **目的**: 特定ビットのフラグが立っているか確認
- **戻り値**: フラグの状態

#### progressOf()

```solidity
function progressOf(uint256 tokenId)
    external view returns (uint256 setBits, uint256 totalBits)
```

- **目的**: フラグの進捗を取得
- **戻り値**:
  - `setBits`: セットされているビット数
  - `totalBits`: 総ビット数（常に256）

#### isCompleted()

```solidity
function isCompleted(uint256 tokenId) external view returns (bool)
```

- **目的**: トークンが完了状態か確認
- **判定**: `(flags & requiredFlagsMask) == requiredFlagsMask`
- **戻り値**: 完了状態

### 4. イベント

#### FlagUpdated

```solidity
event FlagUpdated(
    uint256 indexed tokenId,
    uint8 indexed bit,
    bool value,
    address indexed operator,
    bytes32 traceId
);
```

- **用途**: 単一ビットのフラグ更新を通知
- **購読者**: バックエンド、Distributor（将来）

#### FlagsBatchUpdated

```solidity
event FlagsBatchUpdated(
    uint256 indexed tokenId,
    uint256 setMask,
    uint256 clearMask,
    address indexed operator,
    bytes32 traceId
);
```

- **用途**: 複数ビットの一括更新を通知
- **購読者**: バックエンド、Distributor（将来）

## セキュリティ設計

### ロールベースアクセス制御

| ロール | 権限 |
|--------|------|
| DEFAULT_ADMIN_ROLE | ロール管理、設定変更 |
| MINTER_ROLE | トークン発行 |
| FLAG_SETTER_ROLE | フラグ更新（バックエンド/NFC検証用） |
| PAUSER_ROLE | 緊急停止 |

### ハードニング

1. **Pausable**: 更新系は pause 中に revert
2. **ReentrancyGuard**: 更新系に適用
3. **存在チェック**: `_requireOwned()` で厳密に確認
4. **マスク重複チェック**: setMask と clearMask の重複を禁止
5. **バッチサイズ制限**: 50件まで

### Gas 最適化

- ビット操作でフラグを効率的に管理
- `_countSetBits()` で進捗計算
- 標準的な範囲での最適化（可読性優先）

## 使用例

### デプロイ

```solidity
JourneyPass pass = new JourneyPass(
    "Journey Pass",        // name
    "JPASS",               // symbol
    "https://api.example.com/metadata/", // baseURI
    ownerAddress,          // owner
    10000                  // maxSupply (0 = unlimited)
);
```

### トークン発行

```solidity
// 単一発行
uint256 tokenId = pass.mint(userAddress);

// 一括発行
address[] memory users = new address[](3);
users[0] = user1;
users[1] = user2;
users[2] = user3;
uint256[] memory tokenIds = pass.mintBatch(users);
```

### フラグ更新（スタンプ押印）

```solidity
// 単一ビット更新
pass.setFlag(
    tokenId,
    0,                              // bit 0
    true,                           // set flag
    keccak256("nfc-checkpoint-001") // traceId
);

// 複数ビット一括更新
pass.setFlagsByMask(
    tokenId,
    0x07,                           // setMask (bit 0, 1, 2)
    0x00,                           // clearMask (none)
    keccak256("batch-update-001")   // traceId
);
```

### 進捗確認

```solidity
// フラグ全体を取得
uint256 flags = pass.flagsOf(tokenId);

// 特定ビットを確認
bool hasStamp = pass.hasFlag(tokenId, 0);

// 進捗を取得
(uint256 setBits, uint256 totalBits) = pass.progressOf(tokenId);
// 例: setBits = 3, totalBits = 256 → 3/256 達成

// 完了状態を確認
bool completed = pass.isCompleted(tokenId);
```

## オプション機能（v1では未実装）

### 転送ロック機能

v1では `transferLockEnabled` フラグを予約していますが、実際の転送制御は実装していません。

```solidity
// v1: 設定のみ可能（効果なし）
pass.setTransferLockEnabled(true);  // v2で有効化予定

// v2で実装予定:
// - isCompleted(tokenId) が false の場合、転送を拒否
// - スタンプラリー完了前の転売を防止
```

### 完了判定マスク

```solidity
// 特定のスタンプのみ必須にする
pass.setRequiredFlagsMask(0x07);  // bit 0, 1, 2 のみ必須

// isCompleted() は requiredFlagsMask と比較
bool completed = pass.isCompleted(tokenId);
// true: flags & 0x07 == 0x07（bit 0, 1, 2 が全てセット）
```

## 将来の拡張（v2以降）

### 1. 名前空間付きフラグ

```solidity
// v2 提案インターフェース
setFlagNS(uint256 tokenId, bytes32 namespace, uint8 bit, bool value);
flagsOfNS(uint256 tokenId, bytes32 namespace) returns (uint256);

// 用途:
// - 複数のスタンプラリーを同一トークンで管理
// - 異なる証明書タイプ（KYC、資格等）
```

### 2. 有効期限/失効

```solidity
// v2 提案インターフェース
setFlagExpiry(uint256 tokenId, uint8 bit, uint256 expiryTimestamp);
revokeFlag(uint256 tokenId, uint8 bit, string reason);
isFlagValid(uint256 tokenId, uint8 bit) returns (bool);

// 用途:
// - 期間限定スタンプ
// - 証明書の有効期限管理
```

### 3. 証拠ハッシュ/evidenceURI

```solidity
// v2 提案インターフェース
setFlagWithEvidence(
    uint256 tokenId,
    uint8 bit,
    bool value,
    bytes32 evidenceHash,
    string evidenceURI
);
getFlagEvidence(uint256 tokenId, uint8 bit)
    returns (bytes32 hash, string uri);

// 用途:
// - 写真、文書ハッシュの記録
// - 監査可能性の向上
```

### 4. 転送ロック機能

```solidity
// v2での実装例
function _beforeTokenTransfer(...) internal virtual override {
    if (transferLockEnabled && from != address(0) && to != address(0)) {
        require(isCompleted(tokenId), "Transfer locked until journey completed");
    }
    super._beforeTokenTransfer(...);
}

// 用途:
// - スタンプラリー完了前の転売防止
// - 証明書の不正移転防止
```

## 後方互換性

### 破壊的変更なし

v1 は単独で動作し、既存コントラクトへの影響はありません：

- ✅ RewardNFT_v2: 改変不要
- ✅ GifterraPaySplitter: 改変不要
- ✅ GifterraDistributor（将来）: イベント購読のみ

### v2への移行

v2で拡張機能を追加する際は、v1の全インターフェースを維持します：

- v1のイベント（FlagUpdated/FlagsBatchUpdated）: 変更しない
- v1の関数（setFlag/flagsOf等）: 変更しない
- 新機能は新インターフェースとして追加

## テスト受け入れ基準

### 最低限の動作確認

1. **ミント**:
   - mint() / mintBatch() が成功
   - maxSupply 超過時は revert

2. **フラグ更新**:
   - FLAG_SETTER_ROLE のみ成功
   - イベント（FlagUpdated, MetadataUpdate）が正しく発火
   - pause 中は revert

3. **View関数**:
   - flagsOf() が正しいフラグを返す
   - hasFlag() がビットの状態を正しく返す
   - progressOf() がセット数を正しく返す
   - isCompleted() が requiredFlagsMask と正しく比較

4. **セキュリティ**:
   - ロール外のアクセスは revert
   - 存在しないトークンへのアクセスは revert

## 制限事項

### v1の制限

1. **単一名前空間**: 256ビットのみ（複数名前空間なし）
2. **有効期限なし**: フラグは永続的
3. **証拠記録なし**: evidenceHash/URI なし
4. **転送ロックなし**: 通常のERC721転送
5. **自動配布なし**: イベント発火のみ（Distributor連携は将来）

## ガス最適化

- **ビット操作**: フラグを効率的に管理
- **バッチミント**: 最大50件まで一括発行
- **標準範囲**: 可読性と安全性を優先

## バージョン情報

```
JourneyPass v1.0.0 - Flagged NFT for Journey Tracking
```

## 関連ドキュメント

- [RewardNFT v2 設計書](./REWARDNFT-V2-CHANGES.md)
- [GifterraPaySplitter 設計書](./PAYSPLITTER-DESIGN.md)
- [EIP-4906: ERC-721 Metadata Update Extension](https://eips.ethereum.org/EIPS/eip-4906)

## ライセンス

MIT License
