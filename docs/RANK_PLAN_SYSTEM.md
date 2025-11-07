# ランクプラン固定制 🎖️

## 概要

Gifterraのランクシステムは**固定プラン制**を採用し、プラットフォーム全体での一貫したユーザー体験を提供します。

## プラン名称について

**重要**: Smart ContractとSupabaseで統一された命名を使用します。

| プラン名 | 段階数 | enum値 |
|---------|-------|-------|
| **STUDIO** | 3段階 | 0 |
| **STUDIO_PRO** | 5段階 | 1 |
| **STUDIO_PRO_MAX** | 10段階 | 2 |
| **CUSTOM** | 可変 | 3 |

変換関数は [src/types/tenantApplication.ts](../src/types/tenantApplication.ts) で提供されています:
```typescript
import { rankPlanToContractValue } from '@/types/tenantApplication';

// STUDIO → 0 (enum値)
const enumValue = rankPlanToContractValue('STUDIO'); // 0
```

## プラン種類

### 📦 標準プラン（一般テナント向け）

| プラン | 段階数 | 対象 | 閾値（JPYC） |
|--------|--------|------|--------------|
| **STUDIO** | 3段階 | 小規模テナント | 0 / 10,000 / 50,000 |
| **STUDIO_PRO** | 5段階 | 中規模テナント | 0 / 5,000 / 20,000 / 50,000 / 100,000 |
| **STUDIO_PRO_MAX** | 10段階 | 大規模・長期運用 | 0 / 3,000 / 10,000 / 30,000 / 100,000 / 300,000 / 600,000 / 1,000,000 / 2,000,000 / 5,000,000 |

### 🔧 CUSTOM プラン（特別用途）

**対象**:
- 運営側デフォルトテナント
- 完全フルカスタムオーダーのテナント
- 特別な要件があるテナント

**特徴**:
- 段階数・閾値・NFT URIを完全に自由設定可能
- テナント管理者が手動で設定
- スーパーアドミンの承認が必要

## テナント作成時の選択

### GifterraFactory.createTenant()

```solidity
function createTenant(
    string memory tenantName,
    address admin,
    address rewardTokenAddress,
    address tipWalletAddress,
    RankPlanRegistry.PlanType rankPlan  // ← プラン選択
) external payable returns (uint256)
```

**例**:
```solidity
// 標準プランの場合
factory.createTenant(
    "My Cafe",
    adminAddress,
    jpycAddress,
    tipWallet,
    RankPlanRegistry.PlanType.STUDIO_PRO  // 5段階プラン
);

// CUSTOMプランの場合
factory.createTenant(
    "Official Gifterra Store",
    adminAddress,
    jpycAddress,
    tipWallet,
    RankPlanRegistry.PlanType.CUSTOM  // 後で手動設定
);
```

## CUSTOMプランの設定方法

CUSTOMプランを選択した場合、テナント管理者は以下の関数で手動設定します：

```solidity
// Gifterraコントラクト（テナント管理者のみ）

// 1. ランク数を設定
gifterra.setMaxRankLevel(6);  // 6段階に設定

// 2. 各レベルの閾値を設定
gifterra.setRankThreshold(1, 0);           // Lv1: 0 JPYC
gifterra.setRankThreshold(2, 5000e18);     // Lv2: 5,000 JPYC
gifterra.setRankThreshold(3, 15000e18);    // Lv3: 15,000 JPYC
gifterra.setRankThreshold(4, 40000e18);    // Lv4: 40,000 JPYC
gifterra.setRankThreshold(5, 100000e18);   // Lv5: 100,000 JPYC
gifterra.setRankThreshold(6, 500000e18);   // Lv6: 500,000 JPYC

// 3. 各レベルのNFT URIを設定
gifterra.setNFTRankUri(1, "https://api.example.com/rank/1.json");
gifterra.setNFTRankUri(2, "https://api.example.com/rank/2.json");
// ... 以下同様
```

## 設計理由

### ✅ メリット

**1. ユーザー体験の統一**
- 複数テナントを応援するユーザーが混乱しない
- 「Gifterraでの貢献度」という一貫したストーリー

**2. 管理コストの削減**
- サポート問い合わせが単純化
- ドキュメント整備が容易

**3. スコアシステムとの整合性**
- 二軸スコアと同様、プラットフォーム共通の評価基準

**4. 柔軟性の確保**
- CUSTOMプランで特別な要件に対応可能

### ⚠️ 制約

**一般テナント**:
- 固定プラン（STUDIO/STUDIO_PRO/STUDIO_PRO_MAX）から選択のみ
- 独自の段階数・閾値は設定不可

**理由**: プラットフォーム全体の品質と一貫性を担保するため

## スーパーアドミン機能

### プラン管理

```solidity
// RankPlanRegistry（スーパーアドミンのみ）

// プラン更新
registry.updatePlan(
    RankPlanRegistry.PlanType.STUDIO_PRO,
    "STUDIO PRO Plan v2",
    "Updated description",
    newThresholds,
    newRankNames,
    newUriTemplates
);

// プラン有効化/無効化
registry.activatePlan(RankPlanRegistry.PlanType.STUDIO_PRO_MAX);
registry.deactivatePlan(RankPlanRegistry.PlanType.STUDIO);
```

### 使用統計

```solidity
// プラン使用統計を取得
(uint256 studioCount, uint256 studioProCount, uint256 studioProMaxCount) =
    registry.getPlanUsageStats();
```

## デプロイ手順

### 1. RankPlanRegistry をデプロイ

```bash
npx hardhat run scripts/deploy-rank-plan-registry.js --network polygon-amoy
# 出力: RankPlanRegistry deployed at: 0x...
```

### 2. GifterraFactory にレジストリを設定

```solidity
factory.setRankPlanRegistry(registryAddress);
```

### 3. テナント作成時にプラン選択

```solidity
factory.createTenant(..., RankPlanRegistry.PlanType.STUDIO_PRO);
```

## トラブルシューティング

### Q: CUSTOMプランで設定を忘れた場合は？

A: テナント管理者が後から設定可能です。初期状態では`maxRankLevel = 4`（デフォルト）が設定されています。

### Q: 標準プランを選択後、カスタマイズしたい場合は？

A: 標準プランは固定です。どうしても必要な場合は、スーパーアドミンに連絡して新しいテナントをCUSTOMプランで作成してもらってください。

### Q: プランの閾値を途中で変更できますか？

A: スーパーアドミンが`updatePlan()`で変更可能ですが、全テナントに影響します。個別テナントの変更はCUSTOMプラン限定です。

## まとめ

| 項目 | 標準プラン | CUSTOMプラン |
|------|-----------|-------------|
| **選択可能な段階数** | 固定（3/5/10） | 自由 |
| **閾値** | 固定 | 自由 |
| **対象** | 一般テナント | 運営・特別オーダー |
| **設定方法** | 自動 | 手動 |
| **変更可否** | 不可（プラットフォーム共通） | 可（テナント独自） |

この設計により、**統一性と柔軟性のバランス**を実現しています。
