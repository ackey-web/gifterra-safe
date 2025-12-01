# ランク特典自動配布システム - 実装ガイド

## 概要

STUDIOプラン以上のテナントオーナー向けに、ユーザーのKODOMI値（貢献度）に応じてランクアップ式SBTの自動ミント・フラグNFTの自動配布を行うシステムです。

---

## 機能一覧

### 1. **KODOMI閾値設定**
- 各ランク（1-5）に到達するために必要なKODOMI値を設定
- localStorageとスマートコントラクトの両方に保存
- プロフィールページのKODOMIゲージに反映

### 2. **SBT自動ミント（バーン&ミント）**
- ユーザーがTIPを送信し、ランク閾値に到達した際に自動実行
- 旧SBTをバーン → 新SBTをミント
- Gifterraコントラクトの`_updateRank()`関数で自動処理

### 3. **フラグNFT自動配布**
- ランクごとに配布するフラグNFTを設定
- フラグNFT管理画面で作成したNFTから選択
- ランク到達時にフロントエンドで自動配布

### 4. **NFTプレビュー**
- 選択したフラグNFTの画像・説明をリアルタイムプレビュー
- カテゴリ別アイコン表示

### 5. **配布履歴**
- SBTミント・フラグNFT配布の履歴を記録
- 配布統計（総配布数・SBTミント数・NFT配布数）
- Supabaseの`rank_reward_distributions`テーブルに保存

---

## 画面構成

### TIP管理画面 > ランク特典設定タブ

```
┌─────────────────────────────────────────────────────────┐
│ 🎁 ランク特典設定（STUDIO プラン以上）                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📊 KODOMI閾値設定                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🌱 ランク 1: Seed Supporter       [  100] pt        │ │
│ │ 🌿 ランク 2: Grow Supporter       [  300] pt        │ │
│ │ 🌸 ランク 3: Bloom Supporter      [  600] pt        │ │
│ │ 🌈 ランク 4: Mythic Patron        [ 1000] pt        │ │
│ │ ⭐ ランク 5: Legendary Supporter  [ 1500] pt        │ │
│ └─────────────────────────────────────────────────────┘ │
│                          [💾 KODOMI閾値を保存]           │
│                                                          │
│ 🚩 フラグNFT自動配布設定                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🌱 ランク 1  [💳 10%割引クーポン          ▼]        │ │
│ │   ┌──────────────────────────────────────────┐      │ │
│ │   │ [NFT画像] 💳 10%割引クーポン              │      │ │
│ │   │ 特典NFT | 全商品10%割引が適用されます     │      │ │
│ │   └──────────────────────────────────────────┘      │ │
│ │                                                      │ │
│ │ 🌿 ランク 2  [👤 ブロンズ会員証          ▼]        │ │
│ │   ┌──────────────────────────────────────────┐      │ │
│ │   │ [NFT画像] 👤 ブロンズ会員証               │      │ │
│ │   │ 会員証NFT | 限定エリアへのアクセス権      │      │ │
│ │   └──────────────────────────────────────────┘      │ │
│ └─────────────────────────────────────────────────────┘ │
│                          [💾 配布設定を保存]             │
│                                                          │
│ 📜 配布履歴                                [🔄 更新]     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 日時       │ ユーザー  │ ランク │ SBT │ NFT        │ │
│ │──────────────────────────────────────────────────│ │
│ │ 2025/03/01 │ 0x123...  │   2    │  ✓  │ ブロンズ  │ │
│ │ 2025/02/28 │ 0x456...  │   1    │  ✓  │ クーポン  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌────────────┬────────────┬────────────┐               │
│ │ 総配布数    │ SBTミント数 │ NFT配布数  │               │
│ │    125     │     125    │     98     │               │
│ └────────────┴────────────┴────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## データベーススキーマ

### rank_reward_distributions テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | 配布記録ID |
| `tenant_id` | UUID | テナントID |
| `user_address` | TEXT | ユーザーのウォレットアドレス |
| `rank_level` | INTEGER | 到達したランクレベル（1-5） |
| `kodomi_value` | INTEGER | 到達時のKODOMI値 |
| `kodomi_threshold` | INTEGER | その時点のランク閾値 |
| `sbt_minted` | BOOLEAN | SBTがミントされたか |
| `sbt_token_id` | TEXT | ミントされたSBTのトークンID |
| `previous_sbt_burned` | BOOLEAN | 旧SBTがバーンされたか |
| `previous_sbt_token_id` | TEXT | バーンされた旧SBTのトークンID |
| `flag_nft_id` | UUID | 配布されたフラグNFTのID |
| `flag_nft_distributed` | BOOLEAN | フラグNFTが配布されたか |
| `flag_nft_token_id` | TEXT | ミントされたフラグNFTのトークンID |
| `tx_hash` | TEXT | ブロックチェーントランザクションハッシュ |
| `block_number` | BIGINT | ブロック番号 |
| `status` | TEXT | pending, completed, failed |
| `error_message` | TEXT | エラーメッセージ（失敗時） |
| `created_at` | TIMESTAMP | 作成日時 |
| `updated_at` | TIMESTAMP | 更新日時 |

### 配布統計ビュー（v_rank_distribution_stats）

```sql
SELECT * FROM v_rank_distribution_stats;
```

テナントごと・ランクごとの配布統計を取得：
- 総配布数
- SBTミント数
- フラグNFT配布数
- 成功数・失敗数
- 最終配布日時

---

## 実装ファイル

### フロントエンド

| ファイル | 説明 |
|---------|------|
| `src/admin/Dashboard.tsx` | TIP管理画面（ランク特典設定タブ） |
| `src/hooks/useFlagNFTList.ts` | フラグNFTリスト取得フック |
| `src/hooks/useRankThresholds.ts` | ランク閾値取得フック |
| `src/utils/rankRewardDistribution.ts` | 自動配布ロジック |

### バックエンド（Supabase）

| ファイル | 説明 |
|---------|------|
| `supabase/migrations/20250301000003_add_rank_reward_distribution.sql` | 配布履歴テーブル・ビュー作成 |

### スマートコントラクト

| ファイル | 説明 |
|---------|------|
| `contracts/Gifterra.sol` | SBT自動ミント（バーン&ミント機能） |
| `contracts/FlagNFT.sol` | フラグNFTミント機能 |

---

## 動作フロー

### 1. テナントオーナーが設定

```
テナント管理者
  ↓
TIP管理 > ランク特典設定
  ↓
① KODOMI閾値を設定（各ランク 1-5）
② フラグNFTを選択（フラグNFT管理で事前作成）
  ↓
[💾 保存]
  ↓
localStorage + Gifterraコントラクト
```

### 2. ユーザーがTIPを送信

```
ユーザー
  ↓
TIP送信（プロフィールページ）
  ↓
Gifterraコントラクト.tip(amount)
  ↓
totalTips[user] += amount
  ↓
_updateRank(user) 自動実行
  ↓
累積TIP額 >= ランク閾値？
  ↓ YES
旧SBTをバーン
  ↓
新SBTをミント
  ↓
イベント発行: NFTMinted(user, tokenId, level)
```

### 3. フロントエンドで自動配布

```
イベント検知（NFTMinted）
  ↓
checkAndDistributeRankRewards()
  ↓
新しく到達したランクを検出
  ↓
フラグNFT配布設定を確認
  ↓
フラグNFTが設定されている？
  ↓ YES
distributeRankRewards()
  ↓
FlagNFTコントラクト.mint(user, flagNFTId)
  ↓
Supabaseに配布履歴を記録
  ↓
ユーザーに通知
```

---

## 使用方法

### テナントオーナー

#### 1. KODOMI閾値を設定

1. TIP管理画面を開く
2. 「ランク特典設定」タブをクリック
3. 各ランクの必要KODOMI値を入力
4. 「💾 KODOMI閾値を保存」ボタンをクリック

#### 2. フラグNFTを設定

1. 「フラグNFT管理」画面で事前にNFTを作成
2. 「ランク特典設定」タブに戻る
3. 各ランクのセレクトボックスから配布するNFTを選択
4. NFTプレビューで内容を確認
5. 「💾 配布設定を保存」ボタンをクリック

#### 3. 配布履歴を確認

1. 「配布履歴」セクションを確認
2. 「🔄 更新」ボタンで最新の履歴を取得
3. 統計情報で配布状況を把握

### ユーザー

#### 1. TIPを送信してランクアップ

1. テナントのプロフィールページを開く
2. KODOMIゲージで現在のランクと進捗を確認
3. TIPを送信
4. KODOMI値が閾値に到達すると自動的に：
   - SBTがバーン&ミント
   - フラグNFTが配布（設定されている場合）
5. ウォレットで新しいSBT・NFTを確認

---

## API・関数リファレンス

### rankRewardDistribution.ts

#### `distributeRankRewards(params)`

ランク到達時の自動配布を実行

**パラメータ:**
```typescript
{
  userAddress: string;        // ユーザーのウォレットアドレス
  tenantAddress: string;      // テナントのウォレットアドレス
  newRank: number;            // 到達したランクレベル（1-5）
  kodomiValue: number;        // 到達時のKODOMI値
  contract?: any;             // Gifterraコントラクトインスタンス
}
```

**戻り値:**
```typescript
{
  success: boolean;
  sbtMinted: boolean;
  flagNFTDistributed: boolean;
  distributionId?: string;
  error?: string;
}
```

#### `checkAndDistributeRankRewards(params)`

KODOMI値を監視し、新しいランク到達時に自動配布をトリガー

**パラメータ:**
```typescript
{
  userAddress: string;
  tenantAddress: string;
  kodomiValue: number;
  previousKodomiValue: number;
  contract?: any;
}
```

#### `getDistributionHistory(tenantId, limit)`

配布履歴を取得

**パラメータ:**
- `tenantId`: テナントID
- `limit`: 取得件数（デフォルト: 50）

**戻り値:** 配布履歴の配列

#### `getDistributionStats(tenantId)`

配布統計を取得

**パラメータ:**
- `tenantId`: テナントID

**戻り値:**
```typescript
{
  totalDistributions: number;      // 総配布数
  sbtMints: number;                // SBTミント数
  flagNFTDistributions: number;    // フラグNFT配布数
}
```

---

## トラブルシューティング

### Q1: 配布履歴が表示されない

**原因**: Supabaseマイグレーションが未実行

**解決策:**
1. Supabase Dashboard → SQL Editor を開く
2. `supabase/migrations/20250301000003_add_rank_reward_distribution.sql` を実行
3. 「🔄 更新」ボタンをクリック

### Q2: フラグNFTが選択できない

**原因**: フラグNFTが作成されていない

**解決策:**
1. 「フラグNFT管理」画面を開く
2. NFTを作成
3. TIP管理画面に戻ってセレクトボックスを確認

### Q3: SBT自動ミントが実行されない

**原因**: Gifterraコントラクトの閾値設定が未完了

**解決策:**
1. TIP管理 > Rank Settings タブを開く
2. 各ランクの閾値を設定
3. 「設定」ボタンをクリックしてコントラクトに保存

---

## 今後の拡張

### Phase 2: リアルタイム通知

- [ ] ランク到達時にプッシュ通知
- [ ] 配布完了時のトースト通知
- [ ] メール通知機能

### Phase 3: 配布条件の拡張

- [ ] 複数条件の組み合わせ（KODOMI + TIP回数）
- [ ] 期間限定ボーナスランク
- [ ] シーズンごとのランクリセット

### Phase 4: 分析機能

- [ ] ランク別ユーザー分析
- [ ] 配布効果の可視化
- [ ] エンゲージメント予測

---

## まとめ

このシステムにより、以下が実現されました：

✅ **テナントオーナー**: ファンの貢献度に応じた自動特典配布
✅ **ユーザー**: ランクアップの達成感とコレクション要素
✅ **プラットフォーム**: エンゲージメント向上とリテンション強化

KODOMI値を中心としたゲーミフィケーション戦略により、ユーザーとクリエイターの深い関係構築を促進します。

---

**最終更新日**: 2025年3月1日
**バージョン**: 1.0
**対応プラン**: STUDIO / STUDIO PRO / STUDIO PRO MAX
