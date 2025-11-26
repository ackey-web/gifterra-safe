# PaymentGatewayWithPermit デプロイガイド

## 🚀 デプロイ前の準備

### 1. 環境変数の設定

`.env`ファイルに以下を追加：

```bash
# デプロイ用秘密鍵（デプロイヤーアカウント）
PRIVATE_KEY=your_private_key_here

# Polygon Mainnet RPC URL（推奨: Alchemy, Infura, QuickNode）
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID

# JPYCトークンアドレス（Polygon Mainnet）
JPYC_MAINNET_ADDRESS=0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c

# プラットフォーム手数料受取アドレス（オプション、デフォルト=deployer）
PLATFORM_FEE_RECIPIENT=0xYourPlatformFeeRecipientAddress
```

### 2. デプロイヤーアカウントの準備

- デプロイには **MATIC (Polygon Gas)** が必要です
- 推奨: 0.1 MATIC以上

残高確認:
```bash
npx hardhat run scripts/check-balance.cjs --network polygon
```

## 📦 デプロイ手順

### Option A: コンパイルエラーを修正してからデプロイ

既存のコントラクトにコンパイルエラーがある場合、まず修正が必要です：

1. **ScoreRegistry.solの修正**
   ```bash
   # contracts/ScoreRegistry.sol:276 の recordScore を修正
   ```

2. **GifterraPaySplitterV2.solの修正**
   ```bash
   # contracts/GifterraPaySplitterV2.sol:396 の重複宣言を修正
   ```

3. **全コントラクトをコンパイル**
   ```bash
   npx hardhat compile
   ```

4. **PaymentGatewayをデプロイ**
   ```bash
   npx hardhat run scripts/deploy-payment-gateway.cjs --network polygon
   ```

### Option B: PaymentGatewayのみを手動デプロイ

コンパイル済みバイトコードを使用して直接デプロイする方法：

1. **RemixまたはHardhat Consoleを使用**

Remixでデプロイ:
```solidity
// 1. contracts/PaymentGatewayWithPermit.sol をRemixにコピー
// 2. Compiler: 0.8.19, Optimizer: 200 runs
// 3. Deploy & Run: Injected Provider (MetaMask)
// 4. Constructor Args:
//    - _jpycAddress: 0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c
//    - _platformFeeRecipient: <your_address>
```

2. **Hardhat Consoleでデプロイ**
```bash
npx hardhat console --network polygon
```

```javascript
const PaymentGateway = await ethers.getContractFactory("PaymentGatewayWithPermit");
const jpyc = "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c";
const recipient = "<your_address>";
const gateway = await PaymentGateway.deploy(jpyc, recipient);
await gateway.deployed();
console.log("Deployed to:", gateway.address);
```

## ✅ デプロイ後の確認

### 1. コントラクトアドレスを記録

```bash
# .env に追加
VITE_PAYMENT_GATEWAY_ADDRESS=0xDeployedContractAddress
```

### 2. Polygonscanで検証

```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS> "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c" "<PLATFORM_FEE_RECIPIENT>"
```

### 3. コントラクト機能をテスト

Hardhat Consoleでテスト:
```javascript
const gateway = await ethers.getContractAt("PaymentGatewayWithPermit", "<CONTRACT_ADDRESS>");

// JPYCアドレス確認
console.log("JPYC:", await gateway.jpyc());

// 手数料率確認（初期値: 0）
console.log("Fee Rate:", await gateway.platformFeeRate());

// 手数料受取人確認
console.log("Fee Recipient:", await gateway.platformFeeRecipient());
```

## 🧪 テストページでの動作確認

1. **開発サーバー起動**
   ```bash
   pnpm dev
   ```

2. **QRコード生成**
   ```
   http://localhost:5173/gasless-qr-test
   ```
   - ウォレット接続
   - 金額入力（例: 10 JPYC）
   - QRコード生成

3. **ガスレス決済テスト**
   ```
   http://localhost:5173/gasless-scanner-test
   ```
   - QRコードをスキャン
   - Permit署名（ガス代不要）
   - 決済実行

## 🔧 トラブルシューティング

### エラー: "execution reverted: Permit expired"
- Permitの有効期限が切れています
- QRコードを再生成してください

### エラー: "Request already processed"
- 同じrequestIDで2回決済しようとしています
- 新しいQRコードを生成してください

### エラー: "Insufficient balance"
- JPYCの残高が不足しています
- 残高を確認してください

### コンパイルエラーが解決できない場合

既存のコントラクトを一時的に移動：
```bash
mkdir -p contracts_backup
mv contracts/ScoreRegistry.sol contracts_backup/
mv contracts/GifterraPaySplitterV2.sol contracts_backup/
npx hardhat compile
npx hardhat run scripts/deploy-payment-gateway.cjs --network polygon
mv contracts_backup/* contracts/
```

## 📊 デプロイコスト見積もり

- **Gas使用量**: 約 2,000,000 gas
- **コスト（MATIC）**:
  - 30 Gwei: 0.06 MATIC (約 $0.06)
  - 50 Gwei: 0.10 MATIC (約 $0.10)
  - 100 Gwei: 0.20 MATIC (約 $0.20)

## 🔗 参考リンク

- [PaymentGatewayWithPermit.sol](contracts/PaymentGatewayWithPermit.sol)
- [deploy-payment-gateway.cjs](scripts/deploy-payment-gateway.cjs)
- [Polygon Mainnet Explorer](https://polygonscan.com/)
- [JPYC公式](https://jpyc.jp/)

---

デプロイが完了したら、[GASLESS_PAYMENT_TEST.md](GASLESS_PAYMENT_TEST.md)を参照してテストを実行してください。
