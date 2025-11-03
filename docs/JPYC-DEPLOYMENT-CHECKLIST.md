# JPYC導入 - デプロイチェックリスト

**目的**: JPYC（電子決済手段）導入時の確認漏れを防ぎ、スムーズなデプロイを実現する

**対象**: 開発者、運用担当者

---

## 📋 事前準備（JPYC発行前）

### ✅ システム確認

- [ ] 環境変数による上書き機能が実装されている（src/config/tokens.ts）
- [ ] .env.exampleにJPYC設定例が記載されている
- [ ] JPYC導入ガイド（JPYC-INTEGRATION-GUIDE.md）を確認した
- [ ] 本番環境のVercelプロジェクトにアクセスできる

### ✅ 情報収集準備

- [ ] JPYC公式サイトをブックマーク: https://jpyc.jp/
- [ ] JPYC公式Twitterをフォロー: @jpyc_JP
- [ ] Polygonscanをブックマーク: https://polygonscan.com/
- [ ] 発行通知を受け取る体制ができている

---

## 🚀 JPYC発行後 - 即座対応フロー

### Phase 1: 情報取得（発行後5分以内）

- [ ] **コントラクトアドレス取得**
  - Mainnet Address (Polygon): `0x_______________________________`
  - Testnet Address (Polygon Amoy): `0x_______________________________`（存在する場合）

- [ ] **基本情報確認**
  - Symbol: `JPYC`
  - Decimals: `____` (18を想定)
  - Name: `JPY Coin`

- [ ] **Polygonscanで確認**
  - URL: `https://polygonscan.com/address/0x___`
  - ✅ コントラクトがVerify済みである
  - ✅ Total Supplyが0より大きい
  - ✅ ERC20標準に準拠している

### Phase 2: ローカル環境での設定（10分以内）

- [ ] **.env.local にアドレスを追加**
  ```bash
  VITE_NETWORK=testnet  # まずtestnetで確認
  VITE_JPYC_TESTNET_ADDRESS=0x...
  VITE_JPYC_MAINNET_ADDRESS=0x...
  ```

- [ ] **ローカルビルド確認**
  ```bash
  pnpm build
  ```
  - ✅ ビルドエラーなし
  - ✅ TypeScriptエラーなし

- [ ] **ローカル動作確認**
  ```bash
  pnpm preview
  ```
  - ✅ ブラウザでアクセスできる
  - ✅ コンソールエラーなし

### Phase 3: 機能テスト（20分以内）

#### 3-1. トークン設定確認

- [ ] ブラウザコンソールで実行:
  ```javascript
  import { getTokenConfig } from '/src/config/tokens.ts';
  console.log(getTokenConfig('JPYC'));
  ```
  - ✅ currentAddressが正しいアドレスになっている
  - ✅ categoryが'payment'である
  - ✅ decimalsが正しい

#### 3-2. 管理画面確認

- [ ] **GIFT HUB作成画面**
  - ✅ トークン選択にJPYCが表示される
  - ✅ JPYCを選択できる
  - ✅ GIFT HUBを作成できる（testnet）

- [ ] **GIFT HUB詳細画面**
  - ✅ JPYCシンボルが正しく表示される
  - ✅ 商品追加でJPYC価格を設定できる

#### 3-3. 購入フローテスト（testnet）

- [ ] **テストウォレット準備**
  - ✅ MetaMaskをPolygon Amoyに切り替え
  - ✅ テスト用JPYCを取得（Faucet等）
  - ✅ ウォレット残高を確認

- [ ] **購入テスト**
  - ✅ JPYC対応GIFT HUBにアクセス
  - ✅ 商品を選択できる
  - ✅ Approveトランザクションが成功
  - ✅ 購入トランザクションが成功
  - ✅ 購入履歴に記録される

#### 3-4. 統計・管理画面確認

- [ ] **収益管理画面**
  - ✅ JPYCの売上が表示される
  - ✅ トークン別統計にJPYCが含まれる
  - ✅ 購入履歴でJPYCフィルタが機能する

### Phase 4: 本番環境デプロイ（30分以内）

#### 4-1. Vercel環境変数設定

- [ ] Vercelダッシュボードにログイン
- [ ] プロジェクト → Settings → Environment Variables
- [ ] 以下の環境変数を追加:
  ```
  VITE_NETWORK = mainnet
  VITE_JPYC_MAINNET_ADDRESS = 0x...
  ```
- [ ] **Production環境にのみ適用**することを確認
- [ ] 保存

#### 4-2. デプロイ実行

- [ ] **方法A: Git Push**
  ```bash
  git add .env.example src/config/tokens.ts docs/
  git commit -m "feat: add JPYC support (electronic payment instrument)"
  git push origin main
  ```
  - ✅ Vercelで自動デプロイが開始される
  - ✅ ビルドが成功する（約2-3分）

- [ ] **方法B: Vercel CLI**
  ```bash
  vercel --prod
  ```

#### 4-3. デプロイ後確認（本番環境）

- [ ] **基本動作確認**
  - ✅ サイトにアクセスできる
  - ✅ 管理画面にログインできる
  - ✅ JPYCがトークン選択に表示される

- [ ] **ブラウザコンソール確認**
  - ✅ エラーがない
  - ✅ 警告がない（または想定内）
  - ✅ JPYCアドレスが正しく設定されている

- [ ] **MetaMask接続テスト**
  - ✅ Polygon Mainnetに切り替え
  - ✅ ウォレット接続が成功する
  - ✅ JPYC残高が表示される（保有している場合）

### Phase 5: 本番購入テスト（実際の購入）

⚠️ **注意**: 実際のJPYCを使用します

- [ ] **少額テスト購入（1-10 JPYC程度）**
  - ✅ JPYC対応GIFT HUBを作成
  - ✅ テスト商品を追加（少額）
  - ✅ 自分のウォレットで購入を実行
  - ✅ Approveトランザクション成功
  - ✅ 購入トランザクション成功
  - ✅ Polygonscanで確認: `https://polygonscan.com/tx/0x...`
  - ✅ 購入履歴に記録される
  - ✅ PaymentSplitterに反映される

- [ ] **エラーケース確認**
  - ✅ 残高不足時のエラー表示
  - ✅ Approve未実行時のエラー表示
  - ✅ ネットワーク不一致時の警告

---

## 📢 リリース後の広報

### ✅ ユーザー告知

- [ ] **公式SNSでアナウンス**
  - JPYCサポート開始を告知
  - 使用方法を簡潔に説明
  - 公式JPYCアカウントをメンション

- [ ] **ドキュメント更新**
  - README.mdにJPYC対応を記載
  - ユーザーガイドを更新

- [ ] **管理画面にお知らせ追加**
  - JPYC導入の通知を表示
  - 使い方ガイドへのリンク

### ✅ モニタリング開始

- [ ] **Vercel Analytics確認**
  - JPYC関連ページのアクセス数
  - エラー発生率

- [ ] **Polygonscan監視**
  - JPYCトランザクション数
  - GifterraコントラクトのJPYC受取履歴

- [ ] **Supabase データ確認**
  - JPYC購入履歴の記録
  - 統計データの正確性

---

## 🚨 ロールバック手順（問題発生時）

### 緊急対応

問題が発生した場合、JPYCを一時的に無効化できます。

#### 方法A: 環境変数をクリア（推奨）

1. Vercel → Environment Variables
2. `VITE_JPYC_MAINNET_ADDRESS` を削除
3. Redeploy

#### 方法B: ネットワークをtestnetに戻す

1. Vercel → Environment Variables
2. `VITE_NETWORK=testnet` に変更
3. Redeploy

### ロールバック後の対応

- [ ] 問題の原因を特定
- [ ] 修正コミットを作成
- [ ] testnet環境で再テスト
- [ ] 本番環境に再デプロイ

---

## 📊 成功指標

### デプロイ完了の判断基準

以下がすべて ✅ になったら成功：

- [ ] 本番環境でJPYCが選択可能
- [ ] 実際の購入トランザクションが成功
- [ ] Polygonscanでトランザクションを確認
- [ ] 購入履歴に正しく記録
- [ ] 統計に反映される
- [ ] エラーが発生していない

### KPI目標（初週）

- JPYCでの初回購入: 24時間以内
- JPYCでの購入件数: 5件以上
- エラー率: 5%以下

---

## 📝 デプロイ記録

### 実施情報

| 項目 | 内容 |
|------|------|
| 実施日時 | YYYY-MM-DD HH:MM |
| 実施者 | |
| JPYCアドレス (Mainnet) | 0x... |
| JPYCアドレス (Testnet) | 0x... |
| Decimals | 18 |
| Vercelデプロイ URL | |
| 初回購入トランザクション | 0x... |

### チェックリスト完了状況

- Phase 1（情報取得）: ⬜ 完了
- Phase 2（ローカル設定）: ⬜ 完了
- Phase 3（機能テスト）: ⬜ 完了
- Phase 4（本番デプロイ）: ⬜ 完了
- Phase 5（本番テスト）: ⬜ 完了

---

## 🎯 次のステップ

JPYC導入後：

1. **ユーザーフィードバック収集**
   - 使いやすさ
   - 問題点

2. **データ分析**
   - JPYC vs NHT の使用率
   - ユーザー属性

3. **機能拡張検討**
   - JPYC専用キャンペーン
   - 手数料最適化

---

**🎉 JPYC導入、頑張ってください！このチェックリストで確実にデプロイしましょう。**
