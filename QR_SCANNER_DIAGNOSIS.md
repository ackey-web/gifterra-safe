# QRスキャナー問題の診断レポート

## 🔍 問題の概要

ウォレットQRコードをカメラでスキャンしようとすると「QRコードの読み取りに失敗しました」というエラーが発生し、html5-qrcode ライブラリがQRコードをデコードできない。

## 🎯 これまでの対策と結果

### 試みた解決策:
1. ✅ **データサイズ削減**: JSON形式 (~140文字) → ethereum: URI形式 (~55文字、60%削減)
2. ✅ **バリデーション修正**: ウォレットQR形式の認識を追加
3. ✅ **スキャナー設定最適化**: aspectRatio、disableFlip などのパラメータ調整
4. ✅ **デバッグログ追加**: 全ステップでのログ出力
5. ✅ **手動入力フォールバック**: ユーザーがアドレスを直接ペーストできる機能

### 結果:
❌ **すべて効果なし** - 依然としてQRコードの読み取りに失敗

## 🧪 診断テストページの作成

デバッグ用のスタンドアロンHTMLページを作成:
- **パス**: `/public/qr-test.html`
- **アクセス**: `https://[デプロイURL]/qr-test.html`

### テストページの機能:
1. **3種類のQR形式をテスト**:
   - ethereum: URI形式 (推奨)
   - JSON形式
   - シンプルアドレス

2. **詳細な診断ログ**:
   - カメラデバイスの列挙
   - カメラ初期化の成功/失敗
   - QRデコードの試行ログ
   - エラーの種類と原因診断

3. **ブラウザ情報の記録**:
   - User Agent
   - Platform
   - Screen解像度

## 🔬 根本原因の仮説

### 仮説1: html5-qrcodeライブラリの互換性問題
**可能性**: 高
- モバイルブラウザ（特にiOS Safari、Android Chrome）でのカメラAPI互換性
- バージョン 2.3.8 が古い可能性
- 特定のデバイス/OSバージョンでの動作不良

**検証方法**:
- テストページで詳細なエラーログを確認
- 別のQRスキャンライブラリで試す（jsQR、zxing-js/browser）

### 仮説2: カメラ権限の問題
**可能性**: 中
- HTTPSでアクセスしているか確認（カメラAPIはHTTPSが必須）
- ブラウザのカメラ権限が正しく付与されているか
- 初回アクセス時の権限ダイアログが拒否された

**検証方法**:
- テストページの診断ログで `NotAllowedError` が出ているか確認
- ブラウザの設定でカメラ権限を確認

### 仮説3: QRコード品質の問題
**可能性**: 低
- 55文字は十分に短い（通常200文字以下なら問題ない）
- Error Correction Level 'H' を使用（最高レベル）
- しかし、画面上のQRコードをカメラでスキャンする場合、モアレや焦点の問題がある可能性

**検証方法**:
- QRコードを印刷してスキャン
- QRコードのサイズを変更（200px → 300px など）
- 別のQR生成ライブラリを試す

### 仮説4: カメラの焦点/解像度の問題
**可能性**: 中
- カメラの自動フォーカスが近距離に対応していない
- qrbox サイズ (250x250) が適切でない
- fps設定 (10) が低すぎる

**検証方法**:
- テストページでqrboxサイズを変更
- fpsを上げる（10 → 30）
- カメラを画面から離してスキャン

## 📋 診断手順

### ステップ1: テストページでの基本診断
1. デプロイ後、`/qr-test.html` にアクセス
2. 「スキャン開始」ボタンをクリック
3. カメラ権限を許可
4. ログエリアを確認:
   - カメラ初期化に成功しているか？
   - 「利用可能なカメラ数」が表示されているか？
   - どんなエラーメッセージが出ているか？

### ステップ2: QR形式テスト
1. ドロップダウンで3つの形式を試す:
   - ethereum: URI (推奨)
   - JSON形式
   - シンプルアドレス
2. それぞれでスキャンを試みる
3. どの形式なら読み取れるか確認

### ステップ3: 環境情報の収集
ログエリアの最初に表示される情報を確認:
- User Agent
- Platform
- Screen解像度

### ステップ4: エラーパターンの特定
以下のどのパターンに該当するか:

#### パターンA: カメラが起動しない
ログ: `❌ カメラ起動失敗`
→ **原因**: 権限、HTTPS、デバイス互換性の問題
→ **対策**: ブラウザ設定確認、別のブラウザで試す

#### パターンB: カメラは起動するがQRが読めない
ログ: `カメラ起動成功` だが `QRコード読み取り成功` が出ない
→ **原因**: QRデコードの問題、ライブラリのバグ
→ **対策**: 別のライブラリに変更

#### パターンC: QRは読めるがバリデーションエラー
ログ: `✅ QRコード読み取り成功!` が出る
→ **原因**: バリデーションロジックの問題
→ **対策**: バリデーション関数の修正（すでに完了）

## 🔧 次のステップ: 代替ソリューション

### オプション1: 別のQRスキャンライブラリに変更

#### jsQR
```typescript
import jsQR from "jsqr";

// カメラストリームからフレームを取得してスキャン
const code = jsQR(imageData.data, imageData.width, imageData.height);
if (code) {
  console.log("QR読み取り成功:", code.data);
}
```

**メリット**: 軽量、シンプル、よくメンテナンスされている
**デメリット**: 自分でカメラストリーム管理が必要

#### zxing-js/browser
```typescript
import { BrowserQRCodeReader } from '@zxing/browser';

const codeReader = new BrowserQRCodeReader();
const result = await codeReader.decodeOnceFromVideoDevice(undefined, 'video');
```

**メリット**: 高性能、Java版ZXingの公式JavaScriptポート
**デメリット**: ファイルサイズが大きい

#### instascan
```typescript
import Instascan from 'instascan';

const scanner = new Instascan.Scanner({ video: videoElement });
scanner.addListener('scan', (content) => {
  console.log(content);
});
```

**メリット**: 使いやすい、モバイル対応
**デメリット**: メンテナンスが止まっている

### オプション2: ハイブリッドアプローチ
複数のライブラリを試して、最初に成功したものを使用:

```typescript
async function scanQR() {
  // 1. html5-qrcode を試す
  try {
    return await scanWithHtml5Qrcode();
  } catch (e) {
    console.log('html5-qrcode 失敗、jsQRを試行');
  }

  // 2. jsQR を試す
  try {
    return await scanWithJsQR();
  } catch (e) {
    console.log('jsQR 失敗、手動入力へ');
  }

  // 3. 手動入力フォールバック
  return showManualInput();
}
```

### オプション3: サーバーサイド処理
クライアント側でカメラ画像を取得し、サーバーでQRデコード:

```typescript
// クライアント: カメラ画像をキャプチャ
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.drawImage(videoElement, 0, 0);
const imageData = canvas.toDataURL('image/png');

// サーバーに送信
const response = await fetch('/api/decode-qr', {
  method: 'POST',
  body: JSON.stringify({ image: imageData })
});

// サーバー: Python + pyzbar などでデコード
```

**メリット**: クライアント互換性問題を回避
**デメリット**: レイテンシ、サーバー負荷

## 📊 推奨アクション

### 即座に実行:
1. ✅ テストページ (`/qr-test.html`) をデプロイ
2. ⏳ 実際のデバイスでテストページを実行
3. ⏳ ログを確認して具体的なエラーパターンを特定

### 診断結果に基づく対応:

#### ケースA: カメラ権限エラー
→ UI上でより明確な権限許可のガイダンスを追加

#### ケースB: ライブラリのデコード失敗
→ **優先対応**: jsQR または zxing-js/browser に変更

#### ケースC: QR品質の問題
→ QRサイズ拡大、Error Correction Level調整、印刷推奨

## 📝 技術的な詳細

### 現在の実装:
- **ライブラリ**: html5-qrcode@2.3.8
- **QR形式**: `ethereum:0xAddress@137` (55文字)
- **Error Correction**: Level H (最高)
- **スキャナー設定**: fps=10, qrbox=250x250, aspectRatio=1.0

### 関連ファイル:
- [src/components/QRScannerCamera.tsx](src/components/QRScannerCamera.tsx) - カメラスキャナー本体
- [src/types/qrPayment.ts](src/types/qrPayment.ts#L120-L143) - QR生成ロジック
- [src/pages/MypageWithSend.tsx](src/pages/MypageWithSend.tsx) - スキャナー使用側
- [public/qr-test.html](public/qr-test.html) - 診断ツール

## 🎯 成功の定義

この問題が解決されたと言える条件:
1. ✅ 実機のモバイルデバイスでウォレットQRがスキャンできる
2. ✅ スキャン成功率が90%以上
3. ✅ カメラ起動からスキャン完了まで5秒以内
4. ✅ 主要ブラウザ（iOS Safari、Android Chrome）で動作

---

**作成日**: 2025-11-24
**最終更新**: 2025-11-24

## 🎯 根本原因の特定 (2025-11-24)

Safari Web Inspectorでの診断結果:
- **症状**: ウォレットQRスキャン時、コンソールに何もログが表示されない
- **原因**: html5-qrcode@2.3.8 がiPhone SafariでQRコードをデコードできない
- **対策**: QRスキャンライブラリを zxing-js/browser に変更

### 実施した修正:

1. **ライブラリ変更**:
   - ❌ 削除: `html5-qrcode@2.3.8`
   - ✅ 追加: `@zxing/browser` + `@zxing/library`

2. **コンポーネント書き換え**:
   - [src/components/QRScannerCamera.tsx](src/components/QRScannerCamera.tsx)
   - `Html5Qrcode` → `BrowserQRCodeReader` (ZXing)
   - より信頼性の高いJava版ZXingの公式JavaScriptポート

3. **期待される効果**:
   - ZXingはJava版の実績があり、モバイルブラウザでの互換性が高い
   - iPhone Safariでも正常にQRデコードが動作するはず

### 次のテスト:
1. デプロイ後、iPhoneでウォレットQRスキャンを試す
2. コンソールに `📸 QRコード読み取り成功 (ZXing):` が表示されることを確認
3. 金額入力モーダルが正常に開くことを確認

**ステータス**: 🟡 修正完了 - デプロイ・テスト待ち
