# 🚀 Remix クイックスタート - 5分でデプロイ

## 最短手順でのデプロイ

### ステップ1: Remix準備（1分）
1. https://remix.ethereum.org/ を開く
2. 「Create New Workspace」→ 「Blank Workspace」
3. Solidity コンパイラを `0.8.19` に設定

### ステップ2: ファイルアップロード（2分）

#### 以下の順序でコピー＆ペースト：

**1. GifterraFactory.sol をコピー**
- `contracts/GifterraFactory.sol` の内容をRemixに貼り付け

**2. GifterraCore.sol をコピー**  
- `contracts/GifterraCore.sol` の内容をRemixに貼り付け

**3. StandardNFT.sol をコピー**
- `contracts/StandardNFT.sol` の内容をRemixに貼り付け

**4. IERC2981.sol をコピー**
- `contracts/interfaces/IERC2981.sol` を `interfaces/` フォルダに作成して貼り付け

**5. IERC165.sol をコピー**
- `contracts/interfaces/IERC165.sol` を `interfaces/` フォルダに作成して貼り付け

### ステップ3: コンパイル（30秒）
1. 各ファイルを選択して「Compile」
2. 警告は無視してOK（エラーがなければ成功）

### ステップ4: デプロイ（1分30秒）

#### MetaMask設定
- **Polygon Amoy** に接続
- **テストMATIC** を https://faucet.polygon.technology/ から取得

#### Factory デプロイ
1. 「Deploy & Run」タブ
2. Contract: `GifterraFactory`
3. Deploy パラメータ: `あなたのウォレットアドレス`
4. 「Deploy」→ MetaMask署名

#### システム作成
1. デプロイされたFactoryの `createGifterraSystem` をクリック
2. パラメータ入力：
```
"Test System"
"Test NFT" 
"TEST"
"https://test.com/"
1000
10000000000000000
```
3. 「transact」→ MetaMask署名

## ✅ 成功確認

デプロイ成功すると：
- Remix Consoleにアドレスが表示
- `getSystem(1)` で情報取得可能
- 2つのコントラクト（Core & NFT）が自動生成

## 🎯 即座にテスト可能な機能

### Factory機能
```javascript
// システム統計
getFactoryStats()

// システム情報取得  
getSystem(1)
```

### GifterraCore（特許対象機能）
```javascript
// SBTミント（管理者のみ）
mintSBT("0x[アドレス]", 5)

// 統計取得
getStats()
```

### StandardNFT（特許回避機能）
```javascript
// 手動ミント（管理者のみ）
mint("0x[アドレス]", "https://metadata.uri")

// 統計取得
getStats()
```

## 💡 ポイント

- **テストネット**で必ず動作確認
- **アドレスをメモ**しておく
- **特許対象機能**と**回避機能**の分離を確認
- エラーが出たら**コンパイラバージョン**を確認

---

**🚨 注意**: 本番環境デプロイ前には必ず法務確認を実施してください。