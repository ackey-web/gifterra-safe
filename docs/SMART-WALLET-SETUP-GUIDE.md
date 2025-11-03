# スマートウォレット実装ガイド

**ステータス**: Phase 1 実装完了
**最終更新**: 2025-10-28

---

## 🎯 概要

Gifterraに**スマートウォレット（Account Abstraction / ERC-4337）**を実装しました。

### 実現できること

✅ **完全なウォレットレス体験**
- メール/SNSログインだけで利用開始
- ウォレットアプリ不要
- ガス代（MATIC）不要

✅ **ハイブリッド方式**
- 従来のウォレット（MetaMask等）も並存
- ユーザーが自由に選択可能

✅ **段階的なガス代負担**
- Phase 1: プラットフォーム全額負担
- Phase 2: ハイブリッド（プラットフォーム + テナント）

---

## 📦 実装済みの内容

### 1. コードの変更

#### ✅ [src/config/wallets.ts](../src/config/wallets.ts)
- SmartWallet設定を追加
- フィーチャーフラグで有効/無効を切り替え可能
- 環境変数でコントロール

#### ✅ [src/config/gasSponsorshipRules.ts](../src/config/gasSponsorshipRules.ts)（新規）
- Phase 1ルール: プラットフォーム全額負担
- Phase 2ルール: ハイブリッド方式
- 操作別のスポンサーロジック

#### ✅ [.env](./.env)
- スマートウォレット設定を追加
- `VITE_SMART_WALLET_FACTORY`
- `VITE_PAYMASTER_URL`
- `VITE_GAS_SPONSORSHIP_PHASE`

---

## 🚀 セットアップ手順

### Step 1: thirdwebダッシュボードでの設定

#### 1-1. Account Factory取得

1. **thirdwebダッシュボードにアクセス**
   ```
   https://thirdweb.com/dashboard
   ```

2. **Smart Walletsページに移動**
   - 左メニューから「Wallets」→「Smart Wallets」を選択

3. **Account Factoryをデプロイ**
   - 「Deploy Account Factory」ボタンをクリック
   - ネットワーク選択: **Polygon Amoy Testnet (Chain ID: 80002)**
   - デプロイ完了後、Factory Addressをコピー

   例: `0x1234567890abcdef1234567890abcdef12345678`

#### 1-2. Paymaster設定（ガスレスに必要）

1. **Engineページに移動**
   - 左メニューから「Engine」を選択

2. **Paymasterを作成**
   - 「Create Paymaster」ボタンをクリック
   - ネットワーク選択: **Polygon Amoy Testnet**
   - 作成完了後、Paymaster URLをコピー

   例: `https://paymaster.thirdweb.com/80002/v1/abc123...`

3. **ガスクレジットをチャージ**
   - Paymasterに資金を追加（テスト用に少額でOK）
   - 推奨: 初回は 0.5 MATIC（約25円）

---

### Step 2: 環境変数の設定

`.env`ファイルに以下を設定：

```bash
# Smart Wallet Factory Address (Step 1-1で取得)
VITE_SMART_WALLET_FACTORY=0x1234567890abcdef1234567890abcdef12345678

# Paymaster URL (Step 1-2で取得)
VITE_PAYMASTER_URL=https://paymaster.thirdweb.com/80002/v1/abc123...

# Gas Sponsorship Phase (Phase 1推奨)
VITE_GAS_SPONSORSHIP_PHASE=1

# Smart Wallet有効化（デフォルト: true）
# トラブル時にfalseにすると従来のウォレットのみになる
# VITE_ENABLE_SMART_WALLET=true
```

---

### Step 3: ローカルテスト

```bash
# 開発サーバー起動
pnpm dev

# ブラウザで確認
# http://localhost:5173
```

#### テスト項目

1. **ウォレット接続**
   - ✅ 「簡単ログイン（推奨・ガスレス）」が表示される
   - ✅ メールアドレスでログインできる
   - ✅ ウォレットアドレスが生成される

2. **ガスレストランザクション**
   - ✅ Tip送信がガス代なしで実行できる
   - ✅ Reward受取がガス代なしで実行できる
   - ✅ GIFT HUBで特典配布がガス代なしで実行できる

3. **従来のウォレット**
   - ✅ MetaMaskも引き続き使える
   - ✅ Coinbase Walletも使える

---

### Step 4: テストネットデプロイ

```bash
# ビルド
pnpm build

# Vercel Previewデプロイ
vercel --prod

# または
git push origin main
# → Vercelが自動デプロイ
```

#### デプロイ後の確認

1. **環境変数をVercelに設定**
   - Vercelダッシュボード → Settings → Environment Variables
   - `.env`の内容をコピー

2. **動作確認**
   - デプロイされたURLにアクセス
   - 本番環境と同じ手順でテスト

---

## 📊 Phase 1 vs Phase 2

### Phase 1: プラットフォーム全額負担（現在）

```
全ての操作 → Gifterraがガス代負担
```

**メリット:**
- ✅ ユーザー体験が最高
- ✅ テナント参加障壁ゼロ
- ✅ シンプル

**コスト:**
- 100 DAU: 約 4,500円/月
- 1000 DAU: 約 45,000円/月

### Phase 2: ハイブリッド方式（将来）

```
Tip/Reward → Gifterraが負担
特典配布 → テナントの売上から2%自動控除
その他 → ユーザー負担
```

**メリット:**
- ✅ コストを50%削減
- ✅ スケーラブル
- ✅ テナントも設定不要

**移行方法:**
```bash
# .envで切り替えるだけ
VITE_GAS_SPONSORSHIP_PHASE=2
```

---

## 🔧 トラブルシューティング

### エラー: "Smart Wallet not available"

**原因:**
- `VITE_SMART_WALLET_FACTORY`が未設定

**解決策:**
```bash
# .envを確認
echo $VITE_SMART_WALLET_FACTORY

# 空の場合は設定
VITE_SMART_WALLET_FACTORY=0x...
```

---

### エラー: "insufficient funds for gas"

**原因:**
- Paymasterに資金がない
- Paymaster URLが間違っている

**解決策:**
1. thirdwebダッシュボードでPaymaster残高を確認
2. 資金を追加（0.5 MATIC以上推奨）
3. Paymaster URLが正しいか確認

---

### スマートウォレットを一時的に無効化したい

```bash
# .envに追加
VITE_ENABLE_SMART_WALLET=false

# または環境変数を削除
VITE_SMART_WALLET_FACTORY=
```

→ 従来のウォレット（MetaMask等）のみが表示される

---

## 📈 モニタリング

### ガス代の使用状況を確認

```typescript
import { getGasSponsorStats } from './config/gasSponsorshipRules';

// 統計取得
const stats = await getGasSponsorStats();

console.log('総スポンサー回数:', stats.totalSponsored);
console.log('総コスト:', stats.totalCost, 'wei');
console.log('プラットフォーム負担:', stats.platformCost);
```

### thirdwebダッシュボードで確認

1. **Gas Usage**
   - Engine → Paymasters → 使用状況

2. **Transaction History**
   - Wallets → Smart Wallets → Transactions

---

## 🎯 次のステップ

### ✅ 完了
- [x] コード実装
- [x] Phase 1ルール実装
- [x] Phase 2ルール設計
- [x] ドキュメント作成

### 🔲 TODO（あなたが実施）
- [ ] thirdwebダッシュボードでFactory取得
- [ ] Paymaster設定とチャージ
- [ ] 環境変数設定
- [ ] ローカルテスト
- [ ] テストネットデプロイ

### 🔮 将来の拡張
- [ ] カスタムPaymasterロジック（Phase 2用）
- [ ] PaymentSplitterV2拡張（ガスプール機能）
- [ ] 使用量アラート機能
- [ ] コスト最適化AI

---

## 📚 参考資料

- [thirdweb Smart Wallet](https://portal.thirdweb.com/wallets/smart-wallet)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Gifterra Architecture](./ARCHITECTURE.md)
- [Gas Sponsorship Rules](../src/config/gasSponsorshipRules.ts)

---

**🎉 準備完了！thirdwebダッシュボードでの設定を開始してください！**
