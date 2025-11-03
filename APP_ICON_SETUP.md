# GIFTERRAアプリアイコンとスプラッシュスクリーンのセットアップ

## 必要なアセット

### 1. アプリアイコン

#### iOS
- **サイズ**: 1024x1024px (PNG形式、透過なし)
- **配置場所**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- **ファイル名**: `AppIcon-1024.png`

#### Android
複数サイズが必要：
- `mipmap-ldpi/ic_launcher.png` - 36x36px
- `mipmap-mdpi/ic_launcher.png` - 48x48px
- `mipmap-hdpi/ic_launcher.png` - 72x72px
- `mipmap-xhdpi/ic_launcher.png` - 96x96px
- `mipmap-xxhdpi/ic_launcher.png` - 144x144px
- `mipmap-xxxhdpi/ic_launcher.png` - 192x192px

**配置場所**: `android/app/src/main/res/`

### 2. スプラッシュスクリーン

#### iOS
- **サイズ**: 2732x2732px (PNG形式)
- **配置場所**: `ios/App/App/Assets.xcassets/Splash.imageset/`
- **ファイル名**: `splash.png`, `splash@2x.png`, `splash@3x.png`

#### Android
- **サイズ**: 2732x2732px (PNG形式)
- **ファイル名**: `splash.png`
- **配置場所**: `android/app/src/main/res/drawable/`

## セットアップ手順

### 方法1: 自動生成ツールを使用（推奨）

1. **@capacitor/assets をインストール**
```bash
pnpm add -D @capacitor/assets
```

2. **ソース画像を準備**
   - アプリアイコン: `resources/icon.png` (1024x1024px以上)
   - スプラッシュ: `resources/splash.png` (2732x2732px以上)

3. **自動生成**
```bash
npx capacitor-assets generate --iconBackgroundColor '#0a0a0f' --splashBackgroundColor '#0a0a0f'
```

### 方法2: 手動配置

1. **公式のGIFTERRAロゴ（`public/GIFTERRA.sidelogo.png`）をベースにアイコンを作成**
   - オンラインツール使用: https://www.appicon.co/ または https://makeappicon.com/
   - 1024x1024pxのアイコンをアップロード
   - すべてのサイズを一括生成

2. **生成されたアイコンを配置**
   - iOSファイルを `ios/App/App/Assets.xcassets/AppIcon.appiconset/` にコピー
   - Androidファイルを `android/app/src/main/res/` の各mipmapフォルダにコピー

3. **スプラッシュスクリーンを配置**
   - 生成した画像を上記の場所に配置

## 現在の設定（capacitor.config.ts）

```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: "#0a0a0f",
    androidSplashResourceName: "splash",
    androidScaleType: "CENTER_CROP",
    showSpinner: false,
    androidSpinnerStyle: "large",
    iosSpinnerStyle: "small",
    spinnerColor: "#667EEA",
    splashFullScreen: true,
    splashImmersive: true,
  },
}
```

## 次のステップ

アイコンとスプラッシュスクリーンを準備したら：

1. **同期**
```bash
npx cap sync
```

2. **iOSで開く**
```bash
npx cap open ios
```

3. **Androidで開く**
```bash
npx cap open android
```

## 注意事項

- アイコンは正方形で、角丸処理はOSが自動で行います
- スプラッシュスクリーンは中央に重要な要素を配置（セーフエリア: 1024x1024px）
- 背景色は既にダークテーマ（#0a0a0f）に設定済み
- ブランドカラー（NHT purple: #764BA2, JPYC blue: #667EEA）の使用を推奨

## トラブルシューティング

### iOS: CocoaPods エラー
```bash
cd ios/App
pod install
```

### Android: Gradle エラー
Android Studioで開いてGradleの同期を実行

### アイコンが反映されない
```bash
# キャッシュをクリア
npx cap sync --force
```
