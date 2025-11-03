# JPYC導入ガイド - 電子決済手段対応

**最終更新**: 2025-10-27

## 📋 概要

このガイドは、電子決済手段として発行されるJPYC（JPY Coin）を、Gifterraプラットフォームに即座に統合するための手順書です。

### JPYCとは

- **発行体**: JPYC株式会社
- **種別**: 電子決済手段（日本円ステーブルコイン）
- **レート**: 1 JPYC = 1 JPY
- **ネットワーク**: Polygon（想定）
- **用途**: 決済専用（Reward配布は不可）

---

## 🚀 クイックスタート（発行後すぐに対応）

### ステップ1: JPYCコントラクトアドレスを取得

JPYCが発行されたら、公式サイトから正式なコントラクトアドレスを取得します。

**確認先**:
- 公式サイト: https://jpyc.jp/
- Twitter: @jpyc_JP
- Discord/Telegram等のコミュニティ

**取得情報**:
```
✅ Mainnet Address (Polygon): 0x...
✅ Testnet Address (Polygon Amoy): 0x... (存在する場合)
✅ Decimals: 18 (確認必須)
✅ Symbol: JPYC
```

### ステップ2: 環境変数を設定

#### オプション A: 環境変数で設定（推奨）

**.env または .env.local に追加**:
```bash
# ネットワーク環境
VITE_NETWORK=mainnet

# JPYCメインネットアドレス（電子決済手段）
VITE_JPYC_MAINNET_ADDRESS=0xYOUR_JPYC_MAINNET_ADDRESS

# JPYCテストネットアドレス（存在する場合）
VITE_JPYC_TESTNET_ADDRESS=0xYOUR_JPYC_TESTNET_ADDRESS
```

**メリット**:
- ✅ コード変更不要
- ✅ 即座にデプロイ可能
- ✅ 環境ごとに異なるアドレスを設定可能

#### オプション B: コードで直接設定

**src/config/tokens.ts の104-105行目を編集**:

```typescript
JPYC: {
  id: 'JPYC',
  symbol: 'JPYC',
  name: 'JPY Coin',
  decimals: 18,
  category: 'payment',
  addresses: {
    testnet: '0xYOUR_JPYC_TESTNET_ADDRESS', // ← ここを更新
    mainnet: '0xYOUR_JPYC_MAINNET_ADDRESS', // ← ここを更新
  },
  description: '日本円ステーブルコイン（1 JPYC = 1 JPY）',
},
```

### ステップ3: ビルド＆デプロイ

```bash
# ビルド
pnpm build

# ローカルで確認
pnpm preview

# Vercelにデプロイ（環境変数を設定済みの場合）
vercel --prod
```

#### Vercelでの環境変数設定

1. Vercelダッシュボードへアクセス
2. プロジェクト → Settings → Environment Variables
3. 以下を追加:
   ```
   VITE_NETWORK = mainnet
   VITE_JPYC_MAINNET_ADDRESS = 0x...
   ```
4. **Redeploy**

---

## ✅ 確認チェックリスト

### デプロイ前確認

- [ ] JPYCの公式コントラクトアドレスを取得した
- [ ] アドレスが正しいネットワーク（Polygon Mainnet）のものである
- [ ] decimalsが18であることを確認した
- [ ] testnet環境で動作確認を行った（testnetアドレスがある場合）
- [ ] .envまたはコードにアドレスを設定した
- [ ] `pnpm build` が成功した

### デプロイ後確認

- [ ] 管理画面でJPYCが選択肢に表示される
- [ ] GIFT HUB作成時にJPYCを選択できる
- [ ] 購入フローでJPYC決済が動作する
- [ ] トークンシンボル「JPYC」が正しく表示される
- [ ] PaymentSplitter統計にJPYCが表示される

---

## 🧪 テスト項目

### 1. トークン設定確認

**ブラウザのコンソールで実行**:
```javascript
import { getTokenConfig, debugTokenConfig } from './src/config/tokens.ts';

// JPYC設定を確認
console.log(getTokenConfig('JPYC'));

// 全トークン設定を確認
debugTokenConfig();
```

**期待される出力**:
```javascript
{
  id: 'JPYC',
  symbol: 'JPYC',
  name: 'JPY Coin',
  decimals: 18,
  category: 'payment',
  currentAddress: '0x...' // 設定したアドレス
}
```

### 2. GIFT HUB作成テスト

1. 管理画面にログイン
2. **GIFT HUB管理** → **新規作成**
3. トークン選択で「JPYC」が表示されることを確認
4. JPYCを選択してGIFT HUBを作成
5. 作成されたGIFT HUBの詳細でJPYCが正しく表示されることを確認

### 3. 購入フローテスト

1. JPYC対応のGIFT HUBにアクセス
2. 商品を選択
3. ウォレットにJPYCがあることを確認
4. 購入処理を実行
5. トランザクションが成功することを確認
6. 購入履歴にJPYCでの購入が記録されることを確認

### 4. PaymentSplitter統計確認

1. 管理画面 → **収益管理**
2. JPYCの売上が正しく表示されることを確認
3. トークン別統計にJPYCが含まれることを確認

---

## 🔧 トラブルシューティング

### Q1: JPYCが選択肢に表示されない

**原因**: アドレスが未設定（0x000...000）

**解決策**:
1. `.env`ファイルに`VITE_JPYC_MAINNET_ADDRESS`が設定されているか確認
2. Vercelの環境変数が設定されているか確認
3. ビルドを再実行: `pnpm build`
4. ブラウザのキャッシュをクリア

### Q2: 「Token JPYC address not configured for mainnet」という警告が出る

**原因**: ネットワーク設定とアドレス設定のミスマッチ

**解決策**:
1. `VITE_NETWORK=mainnet` が設定されているか確認
2. `VITE_JPYC_MAINNET_ADDRESS` が正しく設定されているか確認

### Q3: JPYCでの購入時にエラーが発生する

**原因**:
- ウォレットにJPYCが不足している
- JPYCコントラクトへのApproveが必要
- コントラクトアドレスが間違っている

**解決策**:
1. ウォレットのJPYC残高を確認
2. Polygonscanでコントラクトアドレスを確認: https://polygonscan.com/address/0x...
3. JPYCコントラクトに対してApprove処理を実行
4. ネットワークがPolygon Mainnetであることを確認

### Q4: decimalsが18でない場合

**警告**: JPYCのdecimalsが18以外の場合、表示や計算に影響します。

**対応**:
1. 公式ドキュメントでdecimalsを確認
2. `src/config/tokens.ts`の`decimals`フィールドを修正:
   ```typescript
   JPYC: {
     decimals: 6, // 例: USDCと同じ6の場合
     // ...
   }
   ```
3. ビルドして再デプロイ

---

## 📚 関連ファイル

### 設定ファイル

| ファイル | 説明 |
|---------|------|
| [src/config/tokens.ts](../src/config/tokens.ts) | トークンマスターデータ |
| [.env.example](../.env.example) | 環境変数の設定例 |

### JPYC使用箇所

| ファイル | 説明 |
|---------|------|
| [src/admin/vending/components/HubDetailPanelNew.tsx](../src/admin/vending/components/HubDetailPanelNew.tsx) | GIFT HUB作成・編集 |
| [src/vending-ui/App.tsx](../src/vending-ui/App.tsx) | GIFT HUB購入フロー |
| [src/lib/paymentSplitter.ts](../src/lib/paymentSplitter.ts) | PaymentSplitter統計 |
| [src/admin/revenue/RevenueManagement.tsx](../src/admin/revenue/RevenueManagement.tsx) | 収益管理画面 |

---

## 🎯 JPYCの特性（Reward配布制限）

### ユーティリティトークン vs 決済トークン

```typescript
// src/config/tokens.ts

NHT: {
  category: 'utility',  // ← Reward配布可能
  // Tip、購入、Reward配布すべてOK
}

JPYC: {
  category: 'payment',  // ← Reward配布不可
  // TipとGIFT HUB購入のみOK、Reward配布は不可
}
```

### 理由

JPYCは**電子決済手段**であり、資産価値を持つため、Reward配布（無償配布）は法規制上の問題が生じる可能性があります。そのため、決済用途（Tip、GIFT HUB購入）のみに制限しています。

### システム内での制御

`getUtilityTokens()`関数は自動的にJPYCを除外します：

```typescript
// Reward配布時のトークン選択（JPYCは含まれない）
const utilityTokens = getUtilityTokens(); // ['NHT']

// 決済時のトークン選択（JPYCも含まれる）
const paymentTokens = getPaymentTokens(); // ['NHT', 'JPYC']
```

---

## 📞 サポート

JPYC導入に関する質問や問題が発生した場合：

1. **公式ドキュメント**: このガイドを再確認
2. **JPYC公式**: https://jpyc.jp/
3. **開発チーム**: GitHubのIssueを作成

---

## 📝 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-10-27 | 初版作成（電子決済手段発行前の事前準備） |

---

**🎉 JPYC発行おめでとうございます！このガイドを使って、スムーズに導入を進めてください。**
