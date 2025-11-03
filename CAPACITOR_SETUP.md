# Capacitorセットアップ手順（後日実行用）

GIFTERRAをiOS/Androidアプリ化するための手順書です。

## 前提条件

- Xcode（iOSアプリ開発用）
- Android Studio（Androidアプリ開発用）
- Node.js環境が正常に動作していること

## セットアップ手順

### 1. 環境のクリーンアップ

```bash
# すべてのpnpmプロセスを停止
pkill -9 pnpm

# node_modulesを削除
rm -rf node_modules

# pnpmキャッシュをクリーンアップ
pnpm store prune

# 依存関係を再インストール
pnpm install
```

### 2. Capacitorパッケージのインストール

```bash
# Capacitorのコアパッケージをインストール
pnpm add @capacitor/core
pnpm add -D @capacitor/cli

# iOS/Androidプラットフォームを追加
pnpm add @capacitor/ios @capacitor/android
```

### 3. プロジェクトのビルド

```bash
# Viteでプロジェクトをビルド
pnpm build
```

これにより`dist`フォルダが生成されます（capacitor.config.tsで指定済み）。

### 4. プラットフォームの追加

```bash
# iOSプロジェクトを追加
npx cap add ios

# Androidプロジェクトを追加
npx cap add android
```

### 5. ビルドをネイティブプロジェクトにコピー

```bash
# ビルド成果物をコピー
npx cap copy

# すべてを同期（推奨）
npx cap sync
```

### 6. ネイティブIDEで開く

```bash
# Xcodeで開く（iOS）
npx cap open ios

# Android Studioで開く（Android）
npx cap open android
```

## 開発時のワークフロー

### コード変更後

```bash
# 1. Viteでビルド
pnpm build

# 2. ネイティブプロジェクトに同期
npx cap sync

# 3. 各IDEでリビルド・実行
```

### ライブリロード開発

```bash
# Vite開発サーバーを起動
pnpm dev

# capacitor.config.tsに追加:
# server: {
#   url: 'http://localhost:5173',
#   cleartext: true
# }

# その後、npx cap sync を実行
```

## トラブルシューティング

### node_modulesのロック問題

```bash
# Macを再起動してからクリーンアップ
rm -rf node_modules
pnpm install --force
```

### thirdwebパッケージのエラー

```bash
# 特定のディレクトリを強制削除
rm -rf node_modules/.pnpm/thirdweb*
pnpm install
```

### Capacitorプラグインの追加

例：カメラ機能を追加する場合

```bash
pnpm add @capacitor/camera
npx cap sync
```

## App Store / Google Play 申請時の注意点

### テストネット版として申請する場合

1. **アプリ名に「Beta」「Testnet」を追加**
   - 例：「GIFTERRA (Testnet)」

2. **説明文に明記**
   ```
   このアプリはPolygon Amoy テストネットで動作しています。
   実際の金銭的価値を持つトークンは使用しません。
   テスト用トークンで機能をお試しいただけます。
   ```

3. **審査員向けテスト手順を準備**
   - テストウォレットの作成方法
   - テストトークンの取得方法
   - 基本的な操作フロー

### メインネット対応後

- 接続先を変更するだけ（[src/config](src/config)内の設定）
- アップデート審査は初回より速い（1-3日）

## 設定ファイル

### capacitor.config.ts

すでに作成済み：
- アプリID: `com.metatron.gifterra`
- アプリ名: `GIFTERRA`
- ビルド出力: `dist`
- スプラッシュスクリーン設定済み

## 参考リンク

- [Capacitor公式ドキュメント](https://capacitorjs.com/docs)
- [iOS開発者プログラム](https://developer.apple.com/)
- [Google Play Console](https://play.google.com/console)
