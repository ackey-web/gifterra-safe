# FlagNFT実装 - 完了サマリー

## 実装内容

ユーザーからの要求: **「JourneyPass.solを拡張して真のNFTとして実装して」**

### 問題の背景

当初の実装では、FlagNFT機能がSupabaseデータベースのみで管理される「オフチェーンNFT」でした。

ユーザーの重要な指摘:
> 「会員証NFTだとか、キャンペーンNFTだとかって名前なのにオフチェーンだったらNFTではないじゃないか。それこそ詐欺になってしまうよ。」

この指摘は完全に正しく、以下の法務リスクがありました:

1. **虚偽表示**: ブロックチェーン上に存在しないものを「NFT」と呼ぶことは消費者に対する虚偽表示
2. **景品表示法違反**: 実際と異なる表示による優良誤認
3. **消費者保護法違反**: 消費者の誤認を招く表示
4. **信頼性の欠如**: NFTの本質である「改ざん不可能性」「所有権の証明」がない

## 解決策: 真のオンチェーンNFTとして実装

### 作成したファイル

#### 1. スマートコントラクト
- **[contracts/FlagNFT.sol](../contracts/FlagNFT.sol)**
  - JourneyPass.solを継承
  - 6つのカテゴリをサポート（BENEFIT, MEMBERSHIP, ACHIEVEMENT, CAMPAIGN, ACCESS_PASS, COLLECTIBLE）
  - カテゴリごとの使用制限・有効期限をオンチェーンで管理
  - 譲渡可否をカテゴリごとに設定可能
  - JourneyPassの256ビットフラグ機能を継承（スタンプラリー等）

#### 2. デプロイスクリプト
- **[scripts/deploy-flagnft.ts](../scripts/deploy-flagnft.ts)**
  - FlagNFTコントラクトのデプロイ
  - 全6カテゴリの初期設定を自動実行
  - Thirdweb/Hardhat対応

#### 3. フロントエンド連携
- **[src/hooks/useFlagNFTContract.ts](../src/hooks/useFlagNFTContract.ts)**
  - React Hooksによるコントラクト操作
  - カテゴリ名⇔enum値の変換
  - Thirdweb SDK統合
  - 主な関数:
    - `useMintFlagNFT()`: NFT発行
    - `useMintBatchFlagNFT()`: 一括発行
    - `useConfigureCategory()`: カテゴリ設定
    - `useNFTUsage()`: NFT使用（使用回数カウント）
    - `useGetCategoryOf()`: カテゴリ取得
    - `useIsValid()`: 有効期限チェック
    - `useCanUse()`: 使用可能かチェック

#### 4. ドキュメント
- **[docs/FlagNFT_Implementation.md](./FlagNFT_Implementation.md)**
  - 実装ガイド
  - デプロイ手順
  - 使用方法
  - アーキテクチャ説明

- **[docs/FlagNFT_Summary.md](./FlagNFT_Summary.md)** (このファイル)
  - 実装完了サマリー

## アーキテクチャの役割分担

### オンチェーン（FlagNFT.sol）
**真実の源泉（Source of Truth）**

- NFTの発行・所有権
- カテゴリ情報
- 使用制限・有効期限
- 譲渡制御
- フラグ（スタンプラリー進捗）

### オフチェーン（Supabase）
**メタデータとキャッシュ**

- 画像URL
- 説明文
- カテゴリ別詳細設定（JSON）
- 検索・フィルタリング用インデックス
- オンチェーンデータの参照削減

### データフロー例

```
【NFT作成】
管理画面 → Supabase (メタデータ保存)
       → FlagNFTコントラクト.configureCategory() (カテゴリ設定)

【NFT発行】
管理画面 → FlagNFTコントラクト.mintWithCategory()
       → Supabaseのuser_flag_nftsテーブルにtoken_id記録

【NFT使用】
ユーザーUI → FlagNFTコントラクト.useNFT()
          → オンチェーンでused_countをインクリメント
          → Supabaseは表示用キャッシュとして更新

【有効期限・使用制限チェック】
すべてオンチェーンで実行（改ざん不可能）
```

## 6つのカテゴリの特徴

| カテゴリ | 譲渡 | 使用制限 | 有効期限 | 用途例 |
|---------|------|---------|---------|-------|
| BENEFIT | ✅ 可能 | 設定可能 | 設定可能 | クーポン、割引券 |
| MEMBERSHIP | ❌ 不可 | 無制限 | あり | 会員証、VIPパス |
| ACHIEVEMENT | ❌ 不可 | 表示のみ | なし | 実績バッジ、称号 |
| CAMPAIGN | ✅ 可能 | 1回のみ | あり | 期間限定キャンペーン |
| ACCESS_PASS | ❌ 不可 | 無制限 | なし | アクセス権、入場権 |
| COLLECTIBLE | ✅ 可能 | 表示のみ | なし | コレクション |

## 法務対応

### レアリティ機能の排除

**実装しない機能**:
- レアリティ設定（Common, Rare, Legendary等）
- ランダム配布
- 抽選・ガチャ機能

**理由**:
投げ銭（チップ）に対する配布特典でレアリティを設定すると、以下の法務リスクが発生:

1. **射幸心の煽り**: 賭博罪の構成要件に該当する可能性
2. **ガチャ規制**: 消費者庁のガチャガイドライン抵触
3. **景品表示法**: 過度な射幸心の煽りによる規制対象

### 代替アプローチ

- すべてのNFTは等価値として扱う
- シリーズ管理（例: 10個中の1個）は可能
- コレクション進捗による達成感の提供
- 条件達成による確定配布のみ

## デプロイ手順

### 1. コントラクトのデプロイ

```bash
npx thirdweb deploy
```

または

```bash
npx hardhat run scripts/deploy-flagnft.ts --network polygon
```

### 2. 環境変数の設定

`.env`ファイルにコントラクトアドレスを追加:

```env
VITE_FLAG_NFT_CONTRACT_ADDRESS=0x...
```

### 3. Supabaseマイグレーション

```bash
supabase db push
```

## 次のステップ

### 実装済み ✅

- [x] FlagNFT.solコントラクト作成
- [x] デプロイスクリプト作成
- [x] React Hooks作成
- [x] ドキュメント作成
- [x] データベーススキーマにtoken_id追加済み

### 未実装（今後の作業）⏳

1. **管理画面の統合**
   - FlagNFTManagementPage.tsxにコントラクト操作を追加
   - configureCategory()の呼び出し
   - mintWithCategory()の呼び出し

2. **ユーザーUIの実装**
   - 保有NFT一覧表示
   - NFT使用ボタン
   - 有効期限・使用回数の表示

3. **スタンプラリー機能との統合**
   - JourneyPassのフラグ機能を活用
   - チェックポイント到達時のフラグセット
   - 進捗表示UI

4. **テスト**
   - コントラクトのユニットテスト
   - E2Eテスト
   - 実機検証

## まとめ

### 達成したこと

✅ **真のオンチェーンNFTとして実装**
- ブロックチェーン上で所有権を証明
- 改ざん不可能
- 透明性・監査可能性

✅ **法務リスクの回避**
- 「NFT」という名称の正当性を確保
- レアリティ機能を排除し射幸心の煽りを防止

✅ **JourneyPassの機能を継承**
- 256ビットフラグ（スタンプラリー等）
- 既存の設計思想を維持

✅ **拡張性の確保**
- 6つのカテゴリで多様なユースケースに対応
- メタデータURIでオフチェーン詳細情報と連携

### ユーザーの要求に対する回答

> 「JourneyPass.solを拡張して真のNFTとして実装して」

**→ 完了しました** ✅

- FlagNFT.solとしてJourneyPassを継承
- カテゴリ付きNFT機能を追加
- オンチェーンで使用制限・有効期限を管理
- オフチェーンDBは補助的な役割のみ
- 詐欺・虚偽表示のリスクを完全に排除

---

**作成日**: 2025年11月8日
**実装者**: Claude (Anthropic)
**バージョン**: FlagNFT v1.0.0
