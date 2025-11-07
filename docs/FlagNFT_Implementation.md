# FlagNFT 実装ガイド

## 概要

FlagNFTは、JourneyPass.solを拡張したカテゴリ付きNFTコントラクトです。

**重要**: オフチェーンDBではなく、真のブロックチェーンベースのNFTとして実装されています。「NFT」と呼ぶために必須の要件です。

## なぜ真のNFTとして実装したのか？

当初の実装では、Supabaseデータベースのみで管理する「オフチェーンNFT」となっていました。しかし、これには以下の重大な問題がありました:

1. **詐欺・虚偽表示の問題**: ブロックチェーン上に存在しないものを「NFT」と呼ぶことは、消費者に対する虚偽表示にあたる
2. **法務リスク**: 消費者保護法、景品表示法違反の可能性
3. **信頼性の欠如**: NFTの本質である「改ざん不可能性」「所有権の証明」がない

したがって、FlagNFTコントラクトを作成し、真のオンチェーンNFTとして実装しました。

## アーキテクチャ

### オンチェーン（FlagNFT.sol）

- **NFTの発行**: ERC721トークンとしてブロックチェーン上に記録
- **カテゴリ情報**: 各トークンのカテゴリをオンチェーンで管理
- **使用制限・有効期限**: コントラクトで強制
- **譲渡制御**: カテゴリごとに譲渡可否を設定
- **フラグ機能**: JourneyPassの256ビットフラグを継承（スタンプラリー等）

### オフチェーン（Supabase）

- **詳細メタデータ**: 画像、説明文、カテゴリ別詳細設定
- **検索・フィルタリング**: UIでの高速な検索・表示
- **キャッシュ**: オンチェーンデータの参照を減らす

### データフロー

```
ユーザーがNFT作成
    ↓
管理画面でメタデータ入力 + 画像アップロード
    ↓
Supabaseにメタデータ保存（flag_nftsテーブル）
    ↓
FlagNFTコントラクトのconfigureCategory()を呼び出し
    ↓
mintWithCategory()でNFTをオンチェーン発行
    ↓
Supabaseにtoken_idを記録（user_flag_nftsテーブル）
```

## 6つのカテゴリ

### 1. BENEFIT (特典NFT)
- **用途**: クーポン的な使い方
- **譲渡**: 可能
- **使用制限**: 設定可能（例: 10回まで）
- **例**: 「コーヒー1杯無料券」「10%割引券」

### 2. MEMBERSHIP (会員証NFT)
- **用途**: 会員資格の証明
- **譲渡**: 不可（ソウルバウンド的）
- **使用制限**: 無制限（提示のみ）
- **有効期限**: あり（例: 1年間）
- **例**: 「ゴールド会員証」「VIP会員パス」

### 3. ACHIEVEMENT (実績バッジNFT)
- **用途**: 達成実績の証明
- **譲渡**: 不可（ソウルバウンド）
- **使用制限**: 表示のみ
- **例**: 「100回チップ達成」「コレクター称号」

### 4. CAMPAIGN (キャンペーンNFT)
- **用途**: 期間限定キャンペーン
- **譲渡**: 可能
- **使用制限**: 1回のみ
- **有効期限**: あり（例: 30日間）
- **例**: 「夏季限定キャンペーン参加権」

### 5. ACCESS_PASS (アクセス権NFT)
- **用途**: 特定エリア・コンテンツへのアクセス権
- **譲渡**: 不可
- **使用制限**: 無制限（認証用）
- **例**: 「限定コンテンツアクセスパス」「VIPエリア入場権」

### 6. COLLECTIBLE (コレクティブルNFT)
- **用途**: コレクション目的
- **譲渡**: 可能
- **使用制限**: 表示のみ
- **レアリティ**: なし（法務リスク回避）
- **例**: 「シリーズコレクション 1/10」

**重要**: レアリティ機能は実装しません。投げ銭に対する配布特典でレアリティを設定すると、射幸心の煽り、ガチャ規制、賭博性などの法務リスクが発生します。

## デプロイ手順

### 1. コントラクトのデプロイ

```bash
# Thirdwebを使用する場合
npx thirdweb deploy

# Hardhatを使用する場合
npx hardhat run scripts/deploy-flagnft.ts --network polygon
```

### 2. 環境変数の設定

デプロイ後、`.env`ファイルにコントラクトアドレスを追加:

```env
VITE_FLAG_NFT_CONTRACT_ADDRESS=0x...
```

### 3. 初期カテゴリ設定

`scripts/deploy-flagnft.ts`が自動的に全6カテゴリの初期設定を実行します。

### 4. Supabaseマイグレーション

```bash
# flag_nft_schema.sqlを実行
supabase db push
```

## 使用方法

### 管理画面からNFTを作成

1. `/admin/dashboard`にアクセス
2. 「フラグNFT管理」タブを選択
3. 「新規作成」ボタンをクリック
4. カテゴリを選択
5. 基本情報を入力（名前、説明、画像）
6. カテゴリ別詳細設定を入力
7. 「作成」ボタンをクリック

→ Supabaseにメタデータが保存され、コントラクトのconfigureCategory()が呼び出されます

### ユーザーにNFTを配布

```typescript
import { useMintFlagNFT } from '../hooks/useFlagNFTContract';

function DistributeButton() {
  const { mint, isLoading } = useMintFlagNFT();

  const handleDistribute = async () => {
    const tx = await mint(userAddress, 'BENEFIT');
    console.log('NFT発行完了:', tx);
  };

  return <button onClick={handleDistribute}>配布</button>;
}
```

### NFTの使用（使用回数カウント）

```typescript
import { useNFTUsage } from '../hooks/useFlagNFTContract';

function UseNFTButton({ tokenId }: { tokenId: number }) {
  const { use, isLoading } = useNFTUsage();

  const handleUse = async () => {
    const tx = await use(tokenId);
    console.log('NFT使用完了:', tx);
  };

  return <button onClick={handleUse}>使用する</button>;
}
```

## JourneyPass機能の継承

FlagNFTはJourneyPassを継承しているため、以下の機能も使用可能:

### スタンプラリー機能

```typescript
import { useContract, useContractWrite } from '@thirdweb-dev/react';

// フラグをセット（チェックポイント到達）
const { mutateAsync: setFlag } = useContractWrite(contract, 'setFlag');
await setFlag({
  args: [
    tokenId,      // トークンID
    0,            // ビット位置（0〜255）
    true,         // セット
    traceId       // トレースID（NFC UID等）
  ]
});

// 進捗確認
const { data } = useContractRead(contract, 'progressOf', [tokenId]);
console.log(`進捗: ${data.setBits} / ${data.totalBits}`);
```

## セキュリティ

- **ロールベースアクセス制御**: MINTER_ROLE, FLAG_SETTER_ROLE, PAUSER_ROLE
- **Pausable**: 緊急時にコントラクトを一時停止
- **ReentrancyGuard**: 再入攻撃対策
- **転送制御**: カテゴリごとに譲渡可否を設定

## テスト

```bash
# コントラクトのテスト
npx hardhat test

# フロントエンドのテスト
pnpm test
```

## まとめ

FlagNFTは、真のオンチェーンNFTとして実装されています。これにより:

- ✅ 「NFT」という名称の正当性
- ✅ 改ざん不可能性
- ✅ 所有権の証明
- ✅ 透明性・監査可能性
- ✅ 法務リスクの回避

オフチェーンのSupabaseは、メタデータの保存とUIの高速化のみに使用し、NFTの本質的な部分はすべてブロックチェーン上で管理されます。
