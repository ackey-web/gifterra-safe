# GIFTERRAのQRスキャナー機能ガイド

## 概要

GIFTERRAにQRスキャナー機能が実装されました。プラットフォームを自動検出して、最適な入力方法を提供します：

- **ネイティブアプリ（iOS/Android）**: カメラでQRコードスキャン
- **Webブラウザ**: 手動入力（将来のアプリ版で完全機能を利用可能）

## 実装された機能

### 1. QRScannerコンポーネント

場所: [src/components/QRScanner.tsx](src/components/QRScanner.tsx)

**主な機能:**
- プラットフォーム自動検出（`Capacitor.isNativePlatform()`）
- ネイティブアプリ：カメラスキャン機能
- Webブラウザ：手動入力フォールバック
- カメラ権限の自動チェック
- エラーハンドリング

**使用例:**
```typescript
import { QRScanner } from '../components/QRScanner';

<QRScanner
  onScan={(data) => {
    console.log('Scanned:', data);
    setAddress(data);
  }}
  onClose={() => setShowQRScanner(false)}
  placeholder="ウォレットアドレスを入力"
/>
```

### 2. Mypageへの統合

場所: [src/pages/Mypage.tsx](src/pages/Mypage.tsx:532-554)

**変更内容:**
- 宛先アドレス入力欄に📷ボタンを追加
- テナントチップモードでは非表示（アドレス自動入力のため）
- モバイルでも最適化されたUIで表示

## 動作フロー

### ネイティブアプリでの使用

```
1. ユーザーが📷ボタンをタップ
   ↓
2. QRScannerモーダルが表示
   ↓
3. 「📷 カメラでスキャン」ボタンをタップ
   ↓
4. カメラ権限をリクエスト
   ↓
5. カメラビューが全画面表示
   ↓
6. QRコードをスキャン
   ↓
7. 自動的にアドレス入力欄に反映
   ↓
8. モーダルが閉じる
```

### Webブラウザでの使用

```
1. ユーザーが📷ボタンをクリック
   ↓
2. QRScannerモーダルが表示
   ↓
3. 「カメラスキャン機能はアプリ版で利用可能」と表示
   ↓
4. 手動入力フォームでアドレスを入力
   ↓
5. 「確定」ボタンをクリック
   ↓
6. アドレス入力欄に反映
   ↓
7. モーダルが閉じる
```

## インストールされたパッケージ

- `@capacitor-community/barcode-scanner@4.0.1` - QRコード/バーコードスキャン用プラグイン

## ネイティブアプリでの設定

### iOS（ios/App/App/Info.plist）

カメラ権限の説明を追加する必要があります：

```xml
<key>NSCameraUsageDescription</key>
<string>QRコードをスキャンして送金先を簡単に入力するためにカメラを使用します</string>
```

### Android（android/app/src/main/AndroidManifest.xml）

カメラ権限が自動で追加されます：

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

## テスト方法

### Web版のテスト

```bash
# 開発サーバーを起動
pnpm dev

# ブラウザでアクセス
open http://localhost:5173/mypage

# 📷ボタンをクリックして動作確認
```

### ネイティブアプリのテスト

#### iOS
```bash
# ビルド
pnpm build

# 同期
npx cap sync ios

# Xcodeで開く
npx cap open ios

# シミュレータまたは実機で実行
# カメラはシミュレータでは動作しないため、実機でテスト
```

#### Android
```bash
# ビルド
pnpm build

# 同期
npx cap sync android

# Android Studioで開く
npx cap open android

# エミュレータまたは実機で実行
```

## トラブルシューティング

### カメラが起動しない（iOS）

**原因**: Info.plistに権限の説明が追加されていない

**解決策**:
```bash
# Xcodeで開く
open ios/App/App/Info.plist

# NSCameraUsageDescriptionを追加
```

### カメラが起動しない（Android）

**原因**: AndroidManifest.xmlに権限が追加されていない

**解決策**:
```bash
# 同期を再実行
npx cap sync android
```

### ブラウザでカメラを使いたい

**現状**: Web版では手動入力のみ

**将来の対応**: WebRTCを使用したブラウザQRスキャンの実装を検討中

**代替案**: ネイティブアプリ版の利用を推奨

### スキャンが遅い

**ネイティブアプリ**: デバイスの性能に依存します

**対策**:
- QRコードを明るい場所で撮影
- QRコードをカメラに近づける
- デバイスを安定させる

## 今後の改善予定

### 短期（次回リリース）
- [x] ネイティブアプリでのQRスキャン実装
- [x] Webでの手動入力フォールバック
- [ ] QRコード生成機能（受け取り用）
- [ ] スキャン履歴の保存

### 中期
- [ ] Web版でのカメラQRスキャン（WebRTC使用）
- [ ] 複数QRコードの一括スキャン（一括送金用）
- [ ] NFTのQRコード表示・スキャン

### 長期
- [ ] AR機能との統合
- [ ] オフラインQRコード検証
- [ ] 生体認証との連携

## 参考リソース

- [Capacitor BarcodeScanner Plugin](https://github.com/capacitor-community/barcode-scanner)
- [Capacitor公式ドキュメント](https://capacitorjs.com/docs)
- [カメラ権限のベストプラクティス](https://capacitorjs.com/docs/guides/permissions)

## よくある質問

### Q: Webブラウザでもカメラスキャンできるようにならないの？
A: 将来的に対応予定ですが、ネイティブアプリの方が高速で安定しているため、本格利用にはアプリ版を推奨します。

### Q: QRコードの種類は何でも読み取れる？
A: ウォレットアドレス（0x...）が含まれているQRコードであれば読み取れます。

### Q: スキャンに失敗した場合は？
A: 手動入力フォームにフォールバックできます。QRScannerモーダル内で直接入力可能です。

### Q: テナントチップでもQRスキャンできる？
A: テナントチップモードでは、テナント選択時にアドレスが自動入力されるため、QRスキャンボタンは表示されません。

### Q: 複数のアドレスを一度にスキャンできる？
A: 現在は1つずつですが、一括送金機能と合わせて将来的に対応予定です。

---

**最終更新**: 2025-10-30
**バージョン**: GIFTERRA v1.0 + QRScanner機能
**プロジェクト**: GIFTERRA by METATRON
