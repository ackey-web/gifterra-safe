# RandomRewardEngine v1

**ランダム報酬配布エンジン**（コミットメント方式オフチェーン抽選）

## 概要

RandomRewardEngine は、Gifterra エコシステムにランダム報酬配布機能を追加する完全独立型コントラクトです。

### 主な特徴

- ✅ **3つのトリガー対応**：デイリー / マイルストーン / 手動ガチャ
- ✅ **ランク別確率設定**：ユーザーのSBTランクに応じた確率調整
- ✅ **コミットメント方式**：オフチェーン抽選でも透明性を確保
- ✅ **低コスト運用**：月間コスト $50-100（ガス代のみ）
- ✅ **VRF拡張可能**：Phase 2 でハイブリッド方式へ移行可能
- ✅ **既存システム非破壊**：デプロイ済みコントラクトへの影響ゼロ

---

## アーキテクチャ

```
┌─────────────────┐
│ Gifterra (SBT)  │ ← ランク参照（読み取りのみ）
└─────────────────┘
         ↓
┌─────────────────────────┐
│ RandomRewardEngine      │
│ ・3つのトリガー          │
│ ・コミット方式抽選       │
│ ・ランク別確率テーブル    │
└─────────────────────────┘
    ↓               ↓
┌────────────┐  ┌────────────┐
│ ERC20      │  │ RewardNFT  │
│ (トークン)  │  │ (NFT配布)  │
└────────────┘  └────────────┘
```

---

## トリガーの詳細

### 1. デイリーリワード（DAILY_REWARD）

**概要**：24時間ごとに1回抽選可能

**設定**：
- クールダウン: 24時間
- コスト: 無料
- 確率: 低レア中心（Common 70%, Rare 25%, SR 4%, SSR 1%）

**使用例**：
```solidity
// 1. 運営がシードをコミット
bytes32 seed = keccak256(abi.encodePacked("daily-seed-20250126"));
bytes32 seedHash = keccak256(abi.encodePacked(seed));
await engine.commitSeed(seedHash);

// 2. ユーザーが抽選実行（24時間後）
await engine.drawDailyReward(seed, operatorAddress);
```

**フロントエンド実装**：
```typescript
// クールダウン確認
const canDraw = await engine.canDrawDaily(userAddress);

if (canDraw) {
  // UIに「デイリーリワード受取可能」と表示
  // ユーザークリック → バックエンドでシード取得 → 抽選実行
}
```

---

### 2. 投げ銭マイルストーン（TIP_MILESTONE）

**概要**：累積投げ銭額が閾値到達で1回だけ抽選可能

**設定例**：
```
マイルストーン0: 1,000 token  → Common確率UP
マイルストーン1: 5,000 token  → Rare確率UP
マイルストーン2: 10,000 token → SR以上確定
マイルストーン3: 50,000 token → SSR確率UP
```

**使用例**：
```solidity
// 1. マイルストーン追加（運営）
await engine.addMilestone(ethers.parseEther("1000"));  // ID: 0
await engine.addMilestone(ethers.parseEther("5000"));  // ID: 1

// 2. 確率テーブル設定
await engine.setRewardPool(
  TriggerType.TIP_MILESTONE,
  1,  // rank 1
  60, // common 60%
  30, // rare 30%
  8,  // sr 8%
  2   // ssr 2%
);

// 3. ユーザーが閾値到達後に抽選
const canDraw = await engine.canDrawMilestone(userAddress, 0);
if (canDraw) {
  await engine.drawTipMilestone(0, seed, operatorAddress);
}
```

**フロントエンド実装**：
```typescript
// ユーザーの累積投げ銭額取得
const totalTips = await gifterra.totalTips(userAddress);

// 達成可能なマイルストーンを表示
for (let i = 0; i < milestoneCount; i++) {
  const milestone = await engine.milestones(i);
  const hasDrawn = await engine.milestoneDrawn(userAddress, i);

  if (totalTips >= milestone.tipThreshold && !hasDrawn) {
    // UI: 「マイルストーン達成！抽選可能」
  }
}
```

---

### 3. 手動ガチャ（MANUAL_GACHA）

**概要**：トークンを支払って何度でも抽選可能

**設定**：
- クールダウン: なし
- コスト: 100 token / 回
- 確率: 高レア寄り（Common 40%, Rare 40%, SR 15%, SSR 5%）

**使用例**：
```solidity
// 1. ユーザーがトークン承認
await rewardToken.approve(engineAddress, ethers.parseEther("100"));

// 2. ガチャ実行
await engine.drawManualGacha(seed, operatorAddress);
```

**フロントエンド実装**：
```typescript
// ガチャボタン
async function onGachaClick() {
  // 1. トークン残高確認
  const balance = await rewardToken.balanceOf(userAddress);
  const cost = await engine.triggerConfigs(TriggerType.MANUAL_GACHA).costAmount;

  if (balance < cost) {
    alert("トークンが不足しています");
    return;
  }

  // 2. Approve
  await rewardToken.approve(engineAddress, cost);

  // 3. シード取得（バックエンド）
  const { seed, operator } = await fetchSeedFromBackend();

  // 4. 抽選実行
  const tx = await engine.drawManualGacha(seed, operator);
  await tx.wait();

  // 5. イベントから結果取得
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === "RewardDrawn");
  displayResult(event.args);
}
```

---

## コミットメント方式の仕組み

### 透明性確保の3ステップ

```
┌─────────────────────────────────────────────┐
│ Step 1: 運営が事前にシードをコミット         │
│                                             │
│ seed = "random-string-12345"                │
│ seedHash = keccak256(seed)                  │
│ ↓                                           │
│ engine.commitSeed(seedHash)                 │
│                                             │
│ → この時点で結果は確定（変更不可）           │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 2: ユーザーが抽選を実行                 │
│                                             │
│ ユーザーが engine.drawXXX(seed, operator)   │
│ を呼び出し                                   │
│                                             │
│ コントラクト側で検証:                        │
│ keccak256(seed) == seedHash                 │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 3: ユーザーアドレスを混入して抽選       │
│                                             │
│ randomValue = keccak256(                    │
│   seed,           // 事前コミット済み        │
│   userAddress,    // 特定ユーザー優遇防止    │
│   blockTimestamp, // タイミング操作防止      │
│   blockNumber     // 追加のランダム性        │
│ )                                           │
│                                             │
│ → 運営でも特定ユーザーに有利な結果を         │
│   作ることは不可能                           │
└─────────────────────────────────────────────┘
```

### なぜ公平なのか？

1. **事前コミット**: 運営は抽選前に結果を変更できない
2. **ユーザー混入**: ユーザーアドレスが乱数に含まれるため、特定ユーザー優遇不可
3. **使い捨て**: 同じシードは1回しか使えない
4. **完全記録**: すべての抽選履歴がチェーン上に記録される

---

## デプロイ・セットアップ手順

### 1. デプロイ

```javascript
const RandomRewardEngine = await ethers.getContractFactory("RandomRewardEngine");

const engine = await RandomRewardEngine.deploy(
  "0x...", // Gifterra (SBT) アドレス
  "0x...", // RewardNFT_v2 アドレス
  "0x...", // ERC20 トークンアドレス
  owner    // オーナーアドレス
);

await engine.deployed();
console.log("RandomRewardEngine deployed to:", engine.address);
```

### 2. 権限設定

```javascript
// RewardNFT_v2 に DISTRIBUTOR_ROLE を付与
const DISTRIBUTOR_ROLE = await rewardNFT.DISTRIBUTOR_ROLE();
await rewardNFT.grantRole(DISTRIBUTOR_ROLE, engine.address);
```

### 3. トークン送付

```javascript
// エンジンに報酬用トークンを送付
await rewardToken.transfer(engine.address, ethers.parseEther("100000"));
```

### 4. 確率テーブル設定

```javascript
// デイリーリワード - ランク1の確率設定
await engine.setRewardPool(
  0,   // TriggerType.DAILY_REWARD
  1,   // rank 1
  70,  // common 70%
  25,  // rare 25%
  4,   // sr 4%
  1    // ssr 1%
);

// ランク2, 3, 4 も同様に設定...
```

### 5. 報酬額設定

```javascript
// デイリーリワード - ランク1 - Common の報酬
await engine.setRewardAmount(
  0,  // TriggerType.DAILY_REWARD
  1,  // rank 1
  0,  // Rarity.COMMON
  ethers.parseEther("10"),  // 10トークン
  ethers.ZeroHash           // NFTなし（トークンのみ）
);

// Rare の報酬（NFT）
await engine.setRewardAmount(
  0,  // TriggerType.DAILY_REWARD
  1,  // rank 1
  1,  // Rarity.RARE
  0,  // トークンなし
  ethers.encodeBytes32String("REWARD_RARE")  // NFT SKU
);
```

### 6. マイルストーン追加

```javascript
await engine.addMilestone(ethers.parseEther("1000"));   // ID: 0
await engine.addMilestone(ethers.parseEther("5000"));   // ID: 1
await engine.addMilestone(ethers.parseEther("10000"));  // ID: 2
```

---

## バックエンド実装例（シード管理）

### シード生成・コミット

```typescript
import crypto from 'crypto';
import { ethers } from 'ethers';

class SeedManager {
  private seeds = new Map<string, string>();

  // シード生成とコミット
  async generateAndCommitSeed(operator: string): Promise<string> {
    // 1. ランダムシード生成
    const seed = '0x' + crypto.randomBytes(32).toString('hex');

    // 2. ハッシュ計算
    const seedHash = ethers.keccak256(seed);

    // 3. コミット
    const tx = await engine.commitSeed(seedHash);
    await tx.wait();

    // 4. シードを保存（ユーザー抽選時に使用）
    const key = `${operator}-${Date.now()}`;
    this.seeds.set(key, seed);

    return key;
  }

  // ユーザー抽選時にシード取得
  getSeed(key: string): string {
    const seed = this.seeds.get(key);
    if (!seed) throw new Error('Seed not found');

    // 1回使ったら削除（使い捨て）
    this.seeds.delete(key);
    return seed;
  }
}

// API エンドポイント
app.post('/api/gacha/prepare', async (req, res) => {
  const seedKey = await seedManager.generateAndCommitSeed(operatorAddress);
  res.json({ seedKey });
});

app.post('/api/gacha/execute', async (req, res) => {
  const { seedKey } = req.body;
  const seed = seedManager.getSeed(seedKey);

  res.json({ seed, operator: operatorAddress });
});
```

---

## トラブルシューティング

### 1. "Invalid seed"

**原因**: シードのハッシュが一致しない

**解決策**:
```javascript
// コミット時と抽選時で同じシードを使用しているか確認
const seed = "0x1234...";
const seedHash = ethers.keccak256(seed);

// コミット
await engine.commitSeed(seedHash);

// 抽選（同じseedを使用）
await engine.drawDailyReward(seed, operatorAddress);
```

### 2. "Seed already used"

**原因**: 同じシードで2回抽選しようとした

**解決策**: 毎回新しいシードを生成する

### 3. "Cooldown not elapsed"

**原因**: デイリーリワードの24時間待機期間が経過していない

**解決策**:
```javascript
const canDraw = await engine.canDrawDaily(userAddress);
if (!canDraw) {
  const lastDraw = await engine.lastDrawTime(userAddress, 0);
  const nextDraw = lastDraw + 24 * 60 * 60;
  console.log("Next draw available at:", new Date(nextDraw * 1000));
}
```

### 4. "Threshold not reached"

**原因**: マイルストーンの閾値に到達していない

**解決策**:
```javascript
const totalTips = await gifterra.totalTips(userAddress);
const milestone = await engine.milestones(milestoneId);

console.log(`Current: ${totalTips}, Required: ${milestone.tipThreshold}`);
```

---

## Phase 2: ハイブリッド方式への拡張

将来的に以下の機能を追加予定：

### VRF統合

```solidity
// 高額報酬時のみVRF使用
if (rewardAmount >= vrfThreshold) {
    // Chainlink VRF でランダム値取得
    requestRandomWords();
} else {
    // オフチェーン抽選（コミット方式）
    _drawRarity(seed, user, pool);
}
```

### 拡張ポイント

- `vrfEnabled`: VRF有効化フラグ
- `vrfThreshold`: VRF使用する報酬額の閾値
- `_drawRarityVRF()`: VRF版の抽選関数（追加予定）

---

## セキュリティ考慮事項

### 監査チェックリスト

- ✅ ReentrancyGuard 実装済み
- ✅ Pausable 緊急停止機能
- ✅ AccessControl ロールベース権限管理
- ✅ シード使い捨て（重複防止）
- ✅ クールダウン実装
- ✅ 抽選履歴の完全記録

### 運営側のベストプラクティス

1. **シード管理**: セキュアなバックエンドで管理
2. **定期監査**: 抽選履歴の公開・検証
3. **確率公開**: 各レアリティの確率をユーザーに明示
4. **テスト**: テストネットで十分な検証

---

## ライセンス

MIT

---

## サポート

問題が発生した場合は、以下の情報を添えて報告してください：

1. トランザクションハッシュ
2. エラーメッセージ
3. 実行したトリガータイプ
4. ユーザーのランク

---

**最終更新**: 2025-01-26
**バージョン**: v1.0.0
