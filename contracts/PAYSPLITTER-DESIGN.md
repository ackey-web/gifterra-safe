# GifterraPaySplitter v1 設計書

## 概要

GifterraPaySplitter v1 は、支払いの受け口・分配・イベント発火を担うコントラクトです。

### 目的

- **支払い受領**: ネイティブ通貨（MATIC/ETH）および ERC20 トークンの受領
- **自動分配**: 収益を事前定義されたシェアで自動分配
- **イベント発火**: Distributor やバックエンドが購読できる `DonationReceived` イベント
- **役割分離**: この段階では Distributor との直接連携（自動ミント呼び出し）は含まない

## アーキテクチャ

### 役割分離

```
┌─────────────────────┐
│   ユーザー/購入者    │
└──────────┬──────────┘
           │ 支払い（ETH/ERC20）
           ▼
┌─────────────────────────────────────┐
│    GifterraPaySplitter v1           │
│  - 支払い受領（donateNative/ERC20）  │
│  - 分配（release）                   │
│  - イベント発火（DonationReceived）  │
└───────────┬─────────────────────────┘
            │
            ├─────────────┬──────────────────┐
            │             │                  │
            ▼             ▼                  ▼
     ┌──────────┐  ┌──────────┐      ┌─────────────┐
     │ Payee 1  │  │ Payee 2  │  ... │ Payee N     │
     │ (分配先) │  │ (分配先) │      │ (分配先)    │
     └──────────┘  └──────────┘      └─────────────┘

            │ イベント購読（将来）
            ▼
┌─────────────────────────────────────┐
│    GifterraDistributor（将来実装）   │
│  - DonationReceived 購読             │
│  - ルール判定                        │
│  - 自動配布実行                      │
└─────────────────────────────────────┘
```

### 継承構造

```solidity
GifterraPaySplitter
  ├─ PaymentSplitter (OpenZeppelin)
  ├─ Pausable (OpenZeppelin)
  ├─ ReentrancyGuard (OpenZeppelin)
  └─ Ownable (OpenZeppelin)
```

## 主要機能

### 1. 支払い受領（Donation）

#### donateNative()

```solidity
function donateNative(bytes32 sku, bytes32 traceId)
    external payable whenNotPaused nonReentrant
```

- **目的**: ネイティブ通貨（MATIC/ETH）の受領
- **要件**: `msg.value > 0`
- **動作**:
  1. ネイティブ通貨を受領
  2. `DonationReceived` イベントを emit（token = address(0)）
- **セキュリティ**: Pausable, ReentrancyGuard

#### donateERC20()

```solidity
function donateERC20(
    address token,
    uint256 amount,
    bytes32 sku,
    bytes32 traceId
) external whenNotPaused nonReentrant
```

- **目的**: ERC20 トークンの受領
- **要件**:
  - 事前に `approve()` が必要
  - `token != address(0)`
  - `amount > 0`
  - `token != address(this)`（自己送金防止）
- **動作**:
  1. `safeTransferFrom` でトークンを pull
  2. `DonationReceived` イベントを emit
- **セキュリティ**: SafeERC20, Pausable, ReentrancyGuard

### 2. イベント発火

#### DonationReceived

```solidity
event DonationReceived(
    address indexed payer,
    address indexed token,
    uint256 amount,
    bytes32 indexed sku,
    bytes32 traceId
);
```

- **目的**: Distributor やバックエンドが購読する重要イベント
- **パラメータ**:
  - `payer`: 支払者アドレス
  - `token`: トークンアドレス（ネイティブ通貨の場合は `address(0)`）
  - `amount`: 金額
  - `sku`: 商品/用途/カテゴリの識別子（空許容）
  - `traceId`: NFC/注文ID/トレース等の任意識別子（空許容）
- **重要**: このイベントは将来変更しない前提で固定（破壊的変更禁止）

### 3. 分配（Release）

#### OpenZeppelin PaymentSplitter の機能

```solidity
// 個別分配（ネイティブ通貨）
function release(address payable account) public virtual

// 個別分配（ERC20）
function release(IERC20 token, address account) public virtual
```

#### 追加ユーティリティ関数

```solidity
// 全受益者に一括分配（ネイティブ通貨）
function releaseAll() external nonReentrant

// 全受益者に一括分配（ERC20）
function releaseAllERC20(IERC20 token) external nonReentrant
```

- **目的**: 一度の呼び出しで全受益者に分配
- **動作**: 各 payee に対して `release()` を呼び出し（releasable > 0 のみ）
- **セキュリティ**: ReentrancyGuard

### 4. Pause 機能

```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```

- **目的**: 緊急停止機能
- **影響**: donate 関数が revert
- **権限**: Owner のみ

## セキュリティ設計

### ハードニング

1. **ゼロ金額チェック**: `amount > 0` を必須
2. **不正トークンチェック**: `token != address(0)` および `token != address(this)`
3. **リエントランシー対策**: ReentrancyGuard 適用
4. **Pausable**: 緊急停止機能
5. **SafeERC20**: ERC20 操作の安全性確保

### Gas 最適化

- 標準的な範囲での最適化
- 可読性/安全性を優先
- `_getPayeeCount()` は試行錯誤で判定（PaymentSplitter が総数を公開しないため）

## 使用例

### デプロイ

```solidity
address[] memory payees = new address[](3);
payees[0] = 0x...プロジェクト;
payees[1] = 0x...開発チーム;
payees[2] = 0x...マーケティング;

uint256[] memory shares = new uint256[](3);
shares[0] = 50; // 50%
shares[1] = 30; // 30%
shares[2] = 20; // 20%

GifterraPaySplitter splitter = new GifterraPaySplitter(payees, shares);
```

### ネイティブ通貨の寄付

```solidity
// フロントエンド
splitter.donateNative(
    keccak256("product-001"), // sku
    keccak256("order-12345")  // traceId
).send({ value: ethers.utils.parseEther("1.0") });
```

### ERC20 トークンの寄付

```solidity
// 1. Approve
await token.approve(splitter.address, amount);

// 2. Donate
await splitter.donateERC20(
    token.address,
    amount,
    keccak256("product-001"),
    keccak256("order-12345")
);
```

### 分配

```solidity
// 個別分配（ネイティブ通貨）
splitter.release(payeeAddress);

// 全員に一括分配（ネイティブ通貨）
splitter.releaseAll();

// 個別分配（ERC20）
splitter.release(tokenAddress, payeeAddress);

// 全員に一括分配（ERC20）
splitter.releaseAllERC20(tokenAddress);
```

## 統計・View 関数

### getStats()

```solidity
function getStats() external view returns (
    uint256 payeeCount,
    uint256 totalShares_,
    uint256 nativeBalance,
    uint256 totalNativeReleased,
    bool isPaused
)
```

### getERC20Stats()

```solidity
function getERC20Stats(IERC20 token) external view returns (
    uint256 tokenBalance,
    uint256 totalTokenReleased
)
```

### getReleasableNative()

```solidity
function getReleasableNative(address account) external view returns (
    uint256 releasableAmount
)
```

### getReleasableERC20()

```solidity
function getReleasableERC20(IERC20 token, address account) external view returns (
    uint256 releasableAmount
)
```

## 後方互換性

### 破壊的変更禁止

- `DonationReceived` イベントは将来変更しない前提
- 既存の動作・外部 I/F・デプロイ計画に影響なし
- 既存コントラクト（SBT / RewardNFT_v2）の改変不要

### 将来の拡張（v2 以降）

以下の機能は v1 には含まれず、将来の拡張で検討：

1. **Distributor 連携**: イベント購読ではなく、直接コールバック
2. **署名検証**: オフチェーン承認による寄付
3. **動的シェア変更**: 運用中のシェア変更機能
4. **マルチシグ統合**: 分配実行の承認プロセス

## テスト受け入れ基準

### 最低限の動作確認

1. **donateNative**:
   - 送金 → 残高増加 + `DonationReceived` emit
   - pause 中は revert

2. **donateERC20**:
   - approve 済 → 受領 + `DonationReceived` emit
   - approve なしは revert
   - pause 中は revert

3. **release**:
   - 個別分配が正しいシェアで実行
   - releaseAll が全員に分配

4. **イベント**:
   - sku/traceId が空でも正常動作
   - token が address(0) でネイティブ通貨を識別

## 制限事項

### v1 の制限

1. **シェア変更不可**: デプロイ時に固定（OpenZeppelin PaymentSplitter の仕様）
2. **Distributor 連携なし**: イベント発火のみ（購読は外部実装）
3. **署名検証なし**: オンチェーン送金のみ
4. **ガス最適化**: 標準的な範囲（可読性優先）

### 注意事項

- `_getPayeeCount()` は試行錯誤で判定（PaymentSplitter の制約）
- `releaseAll()` は payee 数が多い場合にガス制限に注意
- ERC20 は標準的な実装のみサポート（非標準トークンは非対応）

## バージョン情報

```
GifterraPaySplitter v1.0.0
- Payment Receiver + Distribution + Event Emitter
```

## 関連ドキュメント

- [RewardNFT v2 設計書](./REWARDNFT-V2-CHANGES.md)
- [RewardNFT 設計書](./REWARDNFT-DESIGN.md)
- [OpenZeppelin PaymentSplitter](https://docs.openzeppelin.com/contracts/4.x/api/finance#PaymentSplitter)

## ライセンス

MIT License
