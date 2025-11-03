# Gifterra コントラクト群の連携アーキテクチャ

## 概要

本ドキュメントは、Gifterraエコシステムを構成するコントラクト群の連携関係を整理します。

---

## コントラクト一覧

| コントラクト | バージョン | 状態 | 依存関係 |
|------------|----------|------|---------|
| **Gifterra (SBT)** | デプロイ済み | 本番稼働 | なし（独立） |
| **RewardNFT_v2** | v2.0.0 | 実装済み | なし（独立） |
| **GifterraPaySplitter** | v1.0.1 | 実装済み | なし（独立） |
| **JourneyPass** | v1.0.0 | 実装済み | なし（独立） |
| **RandomRewardEngine** | v1.0.0 | 実装済み | Gifterra, RewardNFT_v2, ERC20 |

---

## アーキテクチャ図

### 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                   独立コントラクト                       │
│              （相互に依存関係なし）                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Gifterra     │  │ PaySplitter  │  │ JourneyPass  │ │
│  │ (SBT)        │  │              │  │              │ │
│  │              │  │              │  │              │ │
│  │ ・投げ銭     │  │ ・寄付受付   │  │ ・フラグ管理 │ │
│  │ ・ランク管理 │  │ ・イベント   │  │ ・256ビット  │ │
│  │ ・デイリー   │  │  発火        │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         ↑                  │                 │         │
│         │読取              │イベント         │イベント │
│         │のみ              │                 │         │
└─────────┼──────────────────┼─────────────────┼─────────┘
          │                  │                 │
          │                  ↓                 ↓
     ┌────┴────┐      ┌──────────────────────────┐
     │         │      │    tools/indexer/        │
     │         │      │   (JSONL出力)            │
     │         │      └──────────────────────────┘
     │         │                 │
     │         │                 ↓
     │         │      ┌──────────────────────────┐
     │         │      │  tools/distributor/      │
     │         │      │  (ルールベース配布)      │
     │         │      └──────────────────────────┘
     │         │                 │
     │         │                 │呼び出し
     │         │                 ↓
     │         │      ┌──────────────────────────┐
     │         │      │    RewardNFT_v2          │
     │         │      │  ・distributeMintBySku() │
     │         │      └──────────────────────────┘
     │         │
     │         │
┌────┴─────────┴────────────────────────────────┐
│      RandomRewardEngine                       │
│      (ランダム報酬配布)                        │
├───────────────────────────────────────────────┤
│ 参照:                                         │
│  - Gifterra.userNFTLevel()                   │
│  - Gifterra.totalTips()                      │
│                                               │
│ 呼び出し:                                     │
│  - RewardNFT_v2.distributeMintBySku()        │
│  - ERC20.transfer()                          │
└───────────────────────────────────────────────┘
```

---

## 詳細な連携関係

### 1. Gifterra (SBT) - 中心的なユーザー管理

**役割**: ユーザーのランク・投げ銭累積額を管理

**公開インターフェース**:
```solidity
// 他のコントラクトから参照可能
function userNFTLevel(address user) external view returns (uint256);
function totalTips(address user) external view returns (uint256);
```

**依存先**: なし（完全独立）

**依存元**:
- RandomRewardEngine（読み取りのみ）

---

### 2. RewardNFT_v2 - 報酬NFT配布器

**役割**: 報酬NFTの発行

**公開インターフェース**:
```solidity
function distributeMintBySku(
    address to,
    bytes32 sku,
    bytes32 triggerId
) external returns (uint256);
```

**必要な権限**:
- 呼び出し元に `DISTRIBUTOR_ROLE` が必要

**依存先**: なし（完全独立）

**依存元**:
- tools/distributor/（オフチェーン）
- RandomRewardEngine

---

### 3. GifterraPaySplitter - 支払い受付＆イベント発火

**役割**: 寄付・支払いの受付とイベント発火

**公開イベント**:
```solidity
event DonationReceived(
    address indexed payer,
    address indexed token,
    uint256 amount,
    bytes32 sku,
    bytes32 traceId
);
```

**依存先**: なし（完全独立）

**依存元**:
- tools/indexer/（イベント監視）
- tools/distributor/（イベントベース配布トリガー）

---

### 4. JourneyPass - フラグ付きNFT

**役割**: スタンプラリー等のフラグ管理

**公開イベント**:
```solidity
event FlagUpdated(
    uint256 indexed tokenId,
    uint8 bit,
    bool value,
    address indexed setter,
    bytes32 traceId
);
```

**依存先**: なし（完全独立）

**依存元**:
- tools/indexer/（イベント監視）
- tools/distributor/（イベントベース配布トリガー）

---

### 5. RandomRewardEngine - ランダム報酬配布

**役割**: ランク別・確率ベースのランダム報酬配布

**依存先**:
```solidity
// 読み取り専用
IGifterra public gifterraSBT;
  - userNFTLevel(address) → ランク取得
  - totalTips(address) → 投げ銭累積額取得

// 書き込み
IRewardNFT public rewardNFT;
  - distributeMintBySku(address, bytes32, bytes32) → NFT配布

IERC20 public rewardToken;
  - transfer(address, uint256) → トークン配布
```

**依存元**: なし（ユーザーが直接呼び出し）

---

## オフチェーンコンポーネント

### tools/indexer/

**役割**: ブロックチェーンイベントの監視・JSONL出力

**監視対象**:
- GifterraPaySplitter.DonationReceived
- JourneyPass.FlagUpdated
- RewardNFT_v2.TokenMinted

**出力**: JSONL形式のイベントログ

---

### tools/distributor/

**役割**: ルールベースの自動NFT配布

**入力**: tools/indexer/ の JSONL出力

**処理**:
1. ルール評価（config/rules.json）
2. 条件マッチング
3. RewardNFT_v2.distributeMintBySku() 呼び出し

---

## 権限管理マトリクス

| コントラクト | 必要な権限設定 | 付与先 |
|------------|--------------|-------|
| **RewardNFT_v2** | DISTRIBUTOR_ROLE | tools/distributor アドレス |
| **RewardNFT_v2** | DISTRIBUTOR_ROLE | RandomRewardEngine アドレス |
| **JourneyPass** | FLAG_SETTER_ROLE | 管理者 or 外部システム |
| **GifterraPaySplitter** | なし | - |

---

## デプロイ順序（推奨）

マルチテナント展開時の推奨デプロイ順序：

```
1. Gifterra (SBT)
   ↓
2. RewardNFT_v2
   ↓
3. GifterraPaySplitter
   ↓
4. JourneyPass
   ↓
5. RandomRewardEngine
   ↓ 権限設定
6. RewardNFT_v2.grantRole(DISTRIBUTOR_ROLE, randomRewardEngineAddress)
```

---

## 独立性の検証

### ✅ 完全独立コントラクト（他に依存しない）

- Gifterra (SBT)
- RewardNFT_v2
- GifterraPaySplitter
- JourneyPass

### ⚠️ 依存関係があるコントラクト

- RandomRewardEngine
  - 依存: Gifterra, RewardNFT_v2, ERC20
  - 理由: ユーザーランク参照、NFT配布実行、トークン配布

---

## マルチテナント化の考慮点

### 各テナントが独立して持つべきコントラクト

```
Tenant A:
  - Gifterra_A
  - RewardNFT_v2_A
  - PaySplitter_A
  - JourneyPass_A
  - RandomRewardEngine_A

Tenant B:
  - Gifterra_B
  - RewardNFT_v2_B
  - PaySplitter_B
  - JourneyPass_B
  - RandomRewardEngine_B
```

### 共有可能なコンポーネント

- tools/indexer/（設定でテナント別に分離）
- tools/distributor/（設定でテナント別に分離）

---

## データフロー例

### 例1: デイリーリワード → ランダムNFT配布

```
1. ユーザー → Gifterra.claimDailyReward()
   - 固定トークン報酬（30 token）

2. ユーザー → RandomRewardEngine.drawDailyReward()
   - Gifterra.userNFTLevel() でランク取得
   - 確率抽選（ランク別）
   - RewardNFT_v2.distributeMintBySku() または
   - ERC20.transfer()
```

### 例2: 投げ銭 → 自動NFT配布

```
1. ユーザー → Gifterra.tip(amount)
   - totalTips 累積
   - ランクアップ判定

2. indexer → PaySplitter.DonationReceived イベント検知

3. distributor → ルール評価
   - 条件マッチ
   - RewardNFT_v2.distributeMintBySku() 実行
```

### 例3: スタンプラリー完了 → 報酬

```
1. 管理者 → JourneyPass.setFlag(tokenId, 7, true)
   - FlagUpdated イベント発火

2. indexer → イベント検知

3. distributor → ルール評価
   - 「フラグ7立った」→ NFT配布
   - RewardNFT_v2.distributeMintBySku() 実行
```

---

## 連携の健全性チェックリスト

### デプロイ後の確認

- [ ] RandomRewardEngine が Gifterra を正しく参照できるか
- [ ] RandomRewardEngine が RewardNFT_v2 を呼び出せるか（DISTRIBUTOR_ROLE）
- [ ] indexer が各コントラクトのイベントを検知できるか
- [ ] distributor が RewardNFT_v2 を呼び出せるか（DISTRIBUTOR_ROLE）
- [ ] 各コントラクトのオーナー設定が正しいか

---

## まとめ

### 設計の特徴

1. **高い独立性**: 4つのコアコントラクトは相互依存なし
2. **柔軟な連携**: RandomRewardEngine のみが依存関係を持つ
3. **イベント駆動**: PaySplitter/JourneyPass はイベント発火のみ
4. **権限分離**: DISTRIBUTOR_ROLE で配布権限を管理

### マルチテナント化への適合性

- ✅ 各コントラクトが独立しているため、テナントごとにセットをデプロイ可能
- ✅ オフチェーンコンポーネント（indexer/distributor）は設定で分離可能
- ✅ 権限管理がロールベースで明確

**次のステップ**: ファクトリーパターンでのマルチテナント展開設計

---

**最終更新**: 2025-01-26
**バージョン**: 1.0.0
