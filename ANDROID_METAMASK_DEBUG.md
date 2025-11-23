# Android MetaMask デバッグガイド

## 🔴 現在の問題

**症状**: AndroidのMetaMaskでQRスキャン後、確認画面まで表示されるが「送信する」ボタンをタップしてもMetaMaskの承認画面が立ち上がらない

**環境**:
- デバイス: Android
- ウォレット: MetaMask
- ログイン方法: MetaMaskでログイン
- 動作: 確認画面までは正常に表示される
- 問題: 送信ボタンタップ後、反応なし

## 🔍 診断方法

### 方法1: 画面上のデバッグメッセージを確認（推奨）

最新のコードでは、Androidでコンソールが見れない場合のため、画面上にデバッグ情報を表示するようにしています。

#### 手順:
1. QRコードをスキャン
2. 金額を入力（ウォレットQRの場合）
3. 確認画面が表示される
4. **「送信する」ボタンをタップ**
5. **画面上に表示されるメッセージを確認:**
   - `デバッグ: MetaMask=true, 接続=true, チェーンID=0x89` → 正常
   - `デバッグ: window.ethereumが見つかりません` → MetaMaskブラウザを使っていない
   - `MetaMaskエラー: [エラーメッセージ]` → MetaMask側のエラー

#### 期待される動作:
- デバッグメッセージが2秒間表示される
- その後「MetaMaskアプリで承認してください...」と表示される
- MetaMaskアプリに切り替わり、承認画面が表示される

### 方法2: Chrome DevTools リモートデバッグ（上級者向け）

#### 前提条件:
- AndroidデバイスでUSBデバッグを有効化
- USBケーブルでPCと接続
- PCにChrome/Edgeブラウザがインストール済み

#### 手順:

1. **Androidデバイスの設定:**
   - 「設定」→「開発者向けオプション」→「USBデバッグ」をON
   - （開発者向けオプションが表示されない場合: 「設定」→「デバイス情報」→「ビルド番号」を7回タップ）

2. **USBで接続:**
   - AndroidデバイスをPCにUSB接続
   - 「USBデバッグを許可しますか？」→「OK」

3. **PC側でChrome DevToolsを開く:**
   - PCのChromeで `chrome://inspect` にアクセス
   - または Edgeで `edge://inspect` にアクセス

4. **デバイスを選択:**
   - 「Remote Target」セクションに接続したAndroidデバイスが表示される
   - MetaMaskブラウザで開いているページが表示される
   - 対象ページの下にある「inspect」をクリック

5. **DevToolsが開く:**
   - 「Console」タブを選択
   - アプリで「送信する」をタップ
   - コンソールに出力されるログを確認

## 📊 ログの読み方

### ✅ 正常な場合のログ:
```
🔵 トランザクション送信開始: {hasPrivyWallet: false, hasSendTransaction: false, hasSigner: true, ...}
📱 window.ethereum 状態: {isMetaMask: true, isConnected: true, chainId: "0x89", selectedAddress: "0x..."}
📱 モバイルMetaMask検出 - 直接リクエスト方式を使用
📤 eth_sendTransaction リクエスト送信中...
✅ MetaMask トランザクション送信成功: 0x123abc...
✅ トランザクション完了: {...}
```

### ❌ エラーパターン

#### パターン1: window.ethereumが存在しない
```
❌ window.ethereum が存在しません
```
**原因**: MetaMaskブラウザを使用していない
**対策**: MetaMaskアプリ内のブラウザでアクセスする

#### パターン2: isMetaMask = false
```
📱 window.ethereum 状態: {isMetaMask: false, ...}
```
**原因**: MetaMask以外のウォレット（Trust Wallet等）を使用している
**対策**: MetaMaskアプリで開く

#### パターン3: isConnected = false
```
📱 window.ethereum 状態: {isMetaMask: true, isConnected: false, ...}
```
**原因**: ウォレットが接続されていない
**対策**: 一度ログアウトして再度MetaMaskでログインする

#### パターン4: chainIdが0x89以外
```
📱 window.ethereum 状態: {chainId: "0x1", ...}
```
**原因**: Ethereum Mainnet等、Polygon以外のネットワークに接続している
**対策**: MetaMaskでネットワークをPolygon Mainnetに切り替える

#### パターン5: eth_sendTransaction エラー
```
❌ MetaMask直接呼び出しエラー: {code: 4001, message: "User rejected the request"}
```
**原因別対策**:
- `code: 4001` → ユーザーがMetaMaskで拒否した（正常な動作）
- `code: -32602` → パラメータが無効（バグの可能性）
- `code: -32603` → 内部エラー（RPC接続問題）

## 🔧 トラブルシューティング

### ケース1: 画面に何も表示されない

**原因**: JavaScriptエラーで処理が止まっている可能性

**対策**:
1. ページをリロード（F5 または 再読み込みボタン）
2. MetaMaskアプリを再起動
3. ブラウザキャッシュをクリア

### ケース2: 「デバッグ: window.ethereumが見つかりません」と表示

**原因**: MetaMaskブラウザを使用していない

**対策**:
1. MetaMaskアプリを開く
2. 左上のメニュー → 「ブラウザ」をタップ
3. URLバーにアプリのURLを入力
4. または、URLをコピーしてMetaMaskブラウザで開く

### ケース3: 「MetaMaskアプリで承認してください」で止まる

**原因**: MetaMaskアプリに切り替わらない

**考えられる原因**:
1. **Deep Link問題**: AndroidのDeep Linkが機能していない
2. **バックグラウンド制限**: Androidがアプリの自動起動を制限している
3. **MetaMaskバージョン**: 古いバージョンのMetaMaskを使用している

**対策**:
1. **手動でMetaMaskアプリを開く**:
   - ホーム画面でMetaMaskアプリを開く
   - 保留中のトランザクションが表示されるか確認

2. **アプリの権限を確認**:
   - 「設定」→「アプリ」→「MetaMask」
   - 「バックグラウンドでの実行」を許可
   - 「他のアプリの上に重ねて表示」を許可

3. **MetaMaskを最新版に更新**:
   - Google Play Storeで「MetaMask」を検索
   - 「更新」をタップ

4. **WalletConnect方式に切り替え**（将来的な対策）:
   - 現在のDeep Link方式ではなく、WalletConnectプロトコルを使用
   - より確実にMetaMaskアプリと連携できる

## 🎯 根本原因の可能性

### 仮説1: eth_sendTransaction がDeep Linkをトリガーしない
**説明**: AndroidのMetaMaskモバイルブラウザでは、`window.ethereum.request()` の呼び出しが必ずしもMetaMaskアプリへの切り替えをトリガーしない場合がある。

**検証方法**: コンソールで `eth_sendTransaction` の呼び出しが成功しているか確認。成功している場合、リクエスト自体は送信されているがDeep Linkが機能していない。

### 仮説2: Androidのバックグラウンド制限
**説明**: Android 9以降、バッテリー最適化によりアプリのバックグラウンド起動が制限される。

**検証方法**:
- 「設定」→「アプリ」→「MetaMask」→「バッテリー」
- 「最適化しない」に設定

### 仮説3: トランザクションパラメータの問題
**説明**: `from`, `to`, `data`, `value` のいずれかが正しくない場合、MetaMaskがリクエストを無視する可能性。

**検証方法**: コンソールログで送信しているパラメータを確認:
```javascript
{
  from: "0x...", // walletAddress
  to: "0x...",   // paymentData.token (USDTコントラクト)
  data: "0xa9059cbb...", // transfer(address,uint256)
  value: "0x0"   // ETH送信量（ERC20の場合は0）
}
```

## 📱 代替手段: WalletConnect実装（将来の対策）

現在のDeep Link方式で問題が解決しない場合、WalletConnectプロトコルの実装を検討:

### WalletConnectのメリット:
- QRコード/Deep Linkの両方に対応
- より安定したモバイルアプリ連携
- MetaMask以外のウォレットにも対応

### 実装の概要:
```typescript
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';

const walletConnect = new WalletConnectConnector({
  rpc: { 137: 'https://polygon-rpc.com' },
  qrcode: true,
});

await walletConnect.activate();
const provider = await walletConnect.getProvider();
const signer = new ethers.providers.Web3Provider(provider).getSigner();
```

## 📞 サポート情報

### 次に試すべきこと:
1. ✅ 画面上のデバッグメッセージを確認
2. ✅ MetaMaskアプリを最新版に更新
3. ✅ アプリのバックグラウンド実行権限を確認
4. ✅ Chrome DevToolsでリモートデバッグ（可能であれば）
5. ⏳ 上記で解決しない場合、WalletConnect実装を検討

### デバッグ情報の共有:
問題が解決しない場合、以下の情報を共有してください:
- Androidのバージョン（例: Android 13）
- MetaMaskのバージョン（MetaMaskアプリ → 設定 → バージョン情報）
- 画面に表示されたデバッグメッセージ
- （可能であれば）コンソールログのスクリーンショット

---

**最終更新**: 2025-11-24
**ステータス**: 🟡 調査中 - 画面上デバッグ情報の確認待ち
