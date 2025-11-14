#!/bin/bash
# iOS開発環境セットアップスクリプト
# Xcodeインストール完了後に実行してください

set -e  # エラーが発生したら停止

echo "=========================================="
echo "GIFTERRA iOS開発環境セットアップ"
echo "=========================================="
echo ""

# Step 1: Xcode開発者ディレクトリの切り替え
echo "Step 1: Xcode開発者ディレクトリを設定中..."
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
echo "✓ Xcode開発者ディレクトリを設定しました"
echo ""

# Step 2: Xcodeの初回起動処理
echo "Step 2: Xcodeの初回起動処理を実行中..."
sudo xcodebuild -runFirstLaunch
echo "✓ Xcodeの初回起動処理が完了しました"
echo ""

# Step 3: CocoaPodsのインストール確認
echo "Step 3: CocoaPodsをインストール中..."
if ! command -v pod &> /dev/null; then
    echo "CocoaPodsをインストールします..."
    sudo gem install cocoapods
    echo "✓ CocoaPodsをインストールしました"
else
    echo "✓ CocoaPodsは既にインストールされています"
fi
echo ""

# Step 4: CocoaPodsの依存関係をインストール
echo "Step 4: iOS依存関係をインストール中..."
cd ios/App
pod install
cd ../..
echo "✓ iOS依存関係をインストールしました"
echo ""

# Step 5: Capacitorプロジェクトを同期
echo "Step 5: Capacitorプロジェクトを同期中..."
npx cap sync ios
echo "✓ Capacitorプロジェクトを同期しました"
echo ""

echo "=========================================="
echo "✓ セットアップが完了しました！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. 以下のコマンドでXcodeを開きます:"
echo "   npx cap open ios"
echo ""
echo "2. Xcodeで以下の設定を行います:"
echo "   - 左側のプロジェクトナビゲーターで「App」を選択"
echo "   - 「Signing & Capabilities」タブを開く"
echo "   - 「Team」でApple IDを選択（初回は「Add Account」でサインイン）"
echo ""
echo "3. iPhoneをUSBケーブルでMacに接続"
echo ""
echo "4. Xcodeの上部でデバイスを選択して、再生ボタン（▶️）をクリック"
echo ""
