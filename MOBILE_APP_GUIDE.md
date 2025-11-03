# GIFTERRAモバイルアプリ開発ガイド

## セットアップ完了 ✓

以下のセットアップが完了しました：

- ✅ Capacitorパッケージのインストール（@capacitor/core, @capacitor/cli, @capacitor/ios, @capacitor/android）
- ✅ プロジェクト設定（capacitor.config.ts）
- ✅ 本番ビルドの作成（dist/）
- ✅ iOSプラットフォームの追加（ios/）
- ✅ Androidプラットフォームの追加（android/）
- ✅ アプリアイコン・スプラッシュスクリーンのガイド作成

## プロジェクト構造

```
gifterra-test-stable-4/
├── capacitor.config.ts          # Capacitor設定
├── ios/                          # iOSネイティブプロジェクト
│   └── App/
│       └── App.xcodeproj
├── android/                      # Androidネイティブプロジェクト
│   └── app/
│       └── build.gradle
├── dist/                         # ビルド済みWebアセット
├── CAPACITOR_SETUP.md           # 詳細セットアップガイド
├── APP_ICON_SETUP.md            # アイコン設定ガイド
└── MOBILE_APP_GUIDE.md          # このファイル
```

## 次のステップ

### 1. アプリアイコンとスプラッシュスクリーンの準備

詳細は[APP_ICON_SETUP.md](./APP_ICON_SETUP.md)を参照。

**簡易手順:**
```bash
# 自動生成ツールをインストール
pnpm add -D @capacitor/assets

# resources/フォルダを作成し、以下を配置：
# - icon.png (1024x1024px以上)
# - splash.png (2732x2732px以上)

# 自動生成
npx capacitor-assets generate --iconBackgroundColor '#0a0a0f' --splashBackgroundColor '#0a0a0f'
```

### 2. 開発環境の準備

#### iOS開発の場合

**必要なもの:**
- Mac（macOS 13以上）
- Xcode 15以上
- CocoaPods

**セットアップ:**
```bash
# CocoaPodsをインストール（まだの場合）
sudo gem install cocoapods

# Podをインストール
cd ios/App
pod install
cd ../..

# Xcodeでプロジェクトを開く
npx cap open ios
```

**Xcodeでの設定:**
1. App/App.xcworkspaceを開く
2. Signing & Capabilities → Team を選択
3. Bundle Identifierを確認（com.metatron.gifterra）
4. シミュレータまたは実機で実行

#### Android開発の場合

**必要なもの:**
- Android Studio Hedgehog以上
- JDK 17以上

**セットアップ:**
```bash
# Android Studioでプロジェクトを開く
npx cap open android
```

**Android Studioでの設定:**
1. Gradle同期を実行
2. エミュレータまたは実機を接続
3. Run 'app'を実行

### 3. 開発ワークフロー

```bash
# 1. Webアプリを変更
# src/pages/Mypage.tsx など

# 2. ビルド
pnpm build

# 3. ネイティブアプリに同期
npx cap sync

# 4. ネイティブIDEで実行
npx cap open ios    # iOSの場合
npx cap open android # Androidの場合
```

### 4. ライブリロード開発

開発中は以下の方法でライブリロードが可能：

```bash
# 開発サーバーを起動
pnpm dev
# → http://localhost:5173 で実行中

# capacitor.config.tsに追加（開発時のみ）
server: {
  url: 'http://192.168.1.xxx:5173', // あなたのローカルIP
  cleartext: true
}

# 同期
npx cap sync
```

**注意:** 本番ビルド時はserver設定を削除すること！

### 5. ネイティブ機能の追加（オプション）

#### カメラアクセス
```bash
pnpm add @capacitor/camera
npx cap sync
```

#### プッシュ通知
```bash
pnpm add @capacitor/push-notifications
npx cap sync
```

#### その他のプラグイン
https://capacitorjs.com/docs/plugins

## テストフライト/Google Play配布

### iOSの場合（TestFlight）

1. **アーカイブ作成**
   - Xcode → Product → Archive
   - アーカイブ完了後、Organizer が開く

2. **App Store Connectにアップロード**
   - Distribute App → App Store Connect
   - Export → Upload

3. **TestFlightで配布**
   - App Store Connectでビルドを選択
   - テスターグループに追加
   - 審査後、テスターに配布

### Androidの場合（内部テスト）

1. **APK/AABビルド**
   - Android Studio → Build → Generate Signed Bundle / APK
   - 署名鍵を作成・選択
   - Release ビルドを作成

2. **Google Play Consoleにアップロード**
   - 内部テストトラックにAABをアップロード
   - テスターのメールアドレスを追加

3. **テスター招待**
   - 共有リンクをテスターに送信

## トラブルシューティング

### iOS: "Failed to load module"エラー
```bash
cd ios/App
pod deintegrate
pod install
```

### Android: Gradleビルドエラー
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### ブラウザでは動くがアプリで動かない
- CSP（Content Security Policy）の問題の可能性
- index.htmlの<meta>タグを確認
- Capacitor Configの`server.allowNavigation`を確認

### Web3ウォレット接続の問題
- モバイルアプリではWalletConnectが必要
- 既にプロジェクトに@thirdweb-dev/walletsが含まれています

## 現在の設定

### アプリ情報
- **App ID**: com.metatron.gifterra
- **App名**: GIFTERRA
- **テーマ**: ダークモード（#0a0a0f）
- **アクセントカラー**: JPYC Blue (#667EEA)

### スプラッシュスクリーン設定
- 表示時間: 2秒
- 背景色: #0a0a0f（ダーク）
- スピナー色: #667EEA（JPYC Blue）
- フルスクリーン: 有効

## 参考資料

- [Capacitor公式ドキュメント](https://capacitorjs.com/docs)
- [iOSアプリ開発ガイド](https://capacitorjs.com/docs/ios)
- [Androidアプリ開発ガイド](https://capacitorjs.com/docs/android)
- [Capacitorプラグイン一覧](https://capacitorjs.com/docs/plugins)
- [App Store審査ガイドライン](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play審査ガイドライン](https://play.google.com/console/about/guides/app-review/)

## よくある質問

### Q: テストネットのアプリをストアに出せる？
A: いいえ。ストア審査にはメインネットでの動作が必要です。テストネット版はTestFlightや内部テストでのみ配布可能です。

### Q: アプリのサイズはどれくらい？
A: 約50-80MB（Web3ライブラリが含まれるため）。最適化で削減可能。

### Q: PWAとネイティブアプリの違いは？
A: ネイティブアプリはストア配布、プッシュ通知、カメラアクセスなどが可能。PWAはブラウザから直接インストール可能で、開発が簡単。

### Q: 審査期間は？
A: iOS（App Store）: 1-2日、Android（Google Play）: 数時間-1日

## サポート

問題が発生した場合：
1. [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md)のトラブルシューティングセクションを確認
2. [APP_ICON_SETUP.md](./APP_ICON_SETUP.md)でアセット設定を確認
3. Capacitor公式ドキュメントを参照
4. GitHub Issuesで検索

---

**最終更新**: 2025-10-30
**Capacitorバージョン**: 7.4.4
**プロジェクト**: GIFTERRA by METATRON
