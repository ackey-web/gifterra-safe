# Hardhat ローカル開発環境セットアップ

**フロントエンド統合テスト用**

---

## セットアップ完了状況

- ✅ Hardhat インストール済み
- ✅ hardhat.config.cjs 作成済み
- ✅ TestRewardToken コントラクト作成済み
- ✅ test-local.js スクリプト作成済み

---

## 使用方法

### Step 1: ローカルノード起動

```bash
# ターミナル1で実行（起動したまま）
npx hardhat node
```

これにより：
- ローカルブロックチェーンが http://127.0.0.1:8545 で起動
- 10個のテストアカウントが自動生成（各10000 ETH）
- トランザクションログがリアルタイム表示

### Step 2: テストスクリプト実行

```bash
# ターミナル2で実行
npx hardhat run scripts/test-local.js --network localhost
```

**実行内容**:
1. TestRewardToken デプロイ
2. GifterraFactory デプロイ（手数料: 0.01 ETH）
3. テナント作成（Test Cafe A）
4. 可変ランクシステムテスト（4段階 → 6段階に変更）
5. Factory統計確認

**期待される出力**:
```
========================================
Local Test: Factory + Tenant Creation
========================================

Test Accounts:
  Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Tenant1 Admin: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  User1: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

1. Deploying Test ERC20 Token...
   ✅ Test Token deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3

2. Deploying GifterraFactory...
   ✅ Factory deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   Deployment Fee: 0.01 ETH

3. Creating Tenant 1...
   ✅ Tenant created!
   Tenant ID: 1
   Contracts:
     - Gifterra: 0x...
     - RewardNFT_v2: 0x...
     - PaySplitter: 0x...
     - JourneyPass: 0x...
     - RandomRewardEngine: 0x...

4. Testing Variable Rank System...
   Initial Max Rank Level: 4
   ✅ Max Rank Level changed to: 6
   Setting rank thresholds...
   ✅ All Rank Thresholds:
     Rank 1: 1000.0 tokens
     Rank 2: 5000.0 tokens
     Rank 3: 10000.0 tokens
     Rank 4: 50000.0 tokens
     Rank 5: 100000.0 tokens
     Rank 6: 500000.0 tokens

5. Factory Statistics...
   Total Tenants: 1
   Active Tenants: 1
   Fees Collected: 0.01 ETH

========================================
✅ All Tests Passed!
========================================

You can now connect your frontend to:
  Factory Address: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  Tenant ID: 1

Add to .env:
  VITE_FACTORY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  VITE_TENANT_ID=1
```

### Step 3: MetaMask 設定

**ネットワーク追加**:
```
Network Name: Localhost 8545
RPC URL: http://127.0.0.1:8545
Chain ID: 1337
Currency Symbol: ETH
```

**テストアカウントインポート**:

ローカルノード起動時に表示されるPrivate Keyをインポート：
```
Account #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Account #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
...
```

### Step 4: フロントエンド起動

```bash
# ターミナル3で実行
pnpm dev
```

**.env に追加**:
```bash
# ローカルテスト用
VITE_CHAIN_ID=1337
VITE_RPC_URL=http://127.0.0.1:8545
VITE_FACTORY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VITE_TENANT_ID=1
```

---

## 追加のテストスクリプト

### デプロイスクリプト実行

```bash
# Factory だけデプロイ
npx hardhat run scripts/deploy-factory.js --network localhost

# テナント作成
export FACTORY_ADDRESS=0x...
export TENANT_NAME="Test Shop"
export REWARD_TOKEN_ADDRESS=0x...
npx hardhat run scripts/create-tenant.js --network localhost
```

### Hardhat Console（対話モード）

```bash
npx hardhat console --network localhost
```

```javascript
// Console内で実行
const [deployer] = await ethers.getSigners();
const factory = await ethers.getContractAt("GifterraFactory", "0x...");
const stats = await factory.getGlobalStats();
console.log(stats);
```

---

## トラブルシューティング

### 1. "Error: could not detect network"

**原因**: ローカルノードが起動していない

**解決策**: ターミナル1で `npx hardhat node` を実行

### 2. "Nonce too high"

**原因**: MetaMaskのノンスとローカルノードが同期していない

**解決策**:
1. MetaMask → Settings → Advanced → Reset Account
2. または、ローカルノードを再起動

### 3. "Transaction underpriced"

**原因**: ガス価格が低すぎる

**解決策**: MetaMaskでガス価格を手動で設定

### 4. コントラクトが見つからない

**原因**: ローカルノードをリセットした

**解決策**:
1. ローカルノードを再起動
2. `test-local.js` を再実行
3. 新しいアドレスを `.env` に反映

---

## ネットワーク構成

### Hardhat Network（ローカル）
```javascript
// hardhat.config.cjs
networks: {
  hardhat: {
    chainId: 1337,
    mining: {
      auto: true,
      interval: 0  // 即座にマイニング
    }
  },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 1337
  }
}
```

### Polygon Amoy（テストネット）
```javascript
networks: {
  amoy: {
    url: process.env.AMOY_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 80002
  }
}
```

---

## 開発フロー

```
1. ローカルノード起動
   ↓
2. test-local.js でコントラクトデプロイ
   ↓
3. フロントエンド起動（pnpm dev）
   ↓
4. MetaMask をローカルノードに接続
   ↓
5. UI からコントラクト操作
   ↓
6. ターミナル1でトランザクションログ確認
   ↓
7. 問題があれば修正 → ローカルノード再起動 → 2に戻る
```

---

## 次のステップ

1. ✅ Hardhat セットアップ完了
2. ⏭️ フロントエンド拡張実装
   - スーパーアドミン管理画面
   - 可変ランク設定UI
   - Factory統合
3. ⏭️ ローカルノードでE2Eテスト
4. ⏭️ Polygon Amoy デプロイ

---

**参考資料**:
- [Hardhat 公式ドキュメント](https://hardhat.org/docs)
- [フロントエンド拡張計画](./FRONTEND-EXTENSION-PLAN.md)
- [Remix デプロイガイド](./remix-deployment-guide.md)

---

**最終更新**: 2025-01-26
