# Remix でのデプロイガイド

**GifterraFactory を Remix でデプロイする手順**

対応ネットワーク: Polygon Amoy (Testnet) / Polygon Mainnet

---

## 目次

1. [事前準備](#事前準備)
2. [Factory デプロイ手順](#factory-デプロイ手順)
3. [テナント作成手順](#テナント作成手順)
4. [コントラクト検証](#コントラクト検証)
5. [よくある質問](#よくある質問)

---

## 事前準備

### 1. MetaMask の設定

#### Polygon Amoy (Testnet) 追加

| 項目 | 設定値 |
|-----|--------|
| ネットワーク名 | Polygon Amoy Testnet |
| RPC URL | https://rpc-amoy.polygon.technology/ |
| チェーンID | 80002 |
| 通貨シンボル | MATIC |
| ブロックエクスプローラー | https://amoy.polygonscan.com/ |

#### Polygon Mainnet 追加

| 項目 | 設定値 |
|-----|--------|
| ネットワーク名 | Polygon Mainnet |
| RPC URL | https://polygon-rpc.com/ |
| チェーンID | 137 |
| 通貨シンボル | MATIC |
| ブロックエクスプローラー | https://polygonscan.com/ |

### 2. テストネット MATIC の取得

**Polygon Amoy Faucet**:
- https://faucet.polygon.technology/
- 1日に1回、少量のテストMATICを取得可能

### 3. Remix の準備

1. https://remix.ethereum.org/ にアクセス
2. 左サイドバー「File Explorer」を開く
3. `contracts/` フォルダを作成

---

## Factory デプロイ手順

### Step 1: コントラクトを Remix にロード

以下のコントラクトファイルを Remix にアップロード：

```
contracts/
├── GifterraFactory.sol
├── Gifterra.sol
├── RewardNFT_v2.sol
├── GifterraPaySplitter.sol
├── JourneyPass.sol
└── RandomRewardEngine.sol
```

**アップロード方法**:
1. Remix の File Explorer で右クリック → "Upload files"
2. または、GitHub から直接インポート可能

### Step 2: コンパイル

1. 左サイドバーから「Solidity Compiler」タブを選択
2. Compiler version: `0.8.19` または `0.8.20` を選択
3. `GifterraFactory.sol` を選択
4. 「Compile GifterraFactory.sol」ボタンをクリック

**エラーが出た場合**:
- OpenZeppelin のインポートパスを確認
- Remix の Auto compile をONにする

### Step 3: Factory デプロイ

1. 左サイドバーから「Deploy & run transactions」タブを選択

2. **Environment 設定**:
   - "Injected Provider - MetaMask" を選択
   - MetaMask が自動的に起動
   - Polygon Amoy または Mainnet に接続されていることを確認

3. **Contract 選択**:
   - ドロップダウンから `GifterraFactory` を選択

4. **コンストラクタ引数入力**:

   | パラメータ | 説明 | 例 |
   |-----------|------|---|
   | `_feeRecipient` | 手数料受取アドレス | 0x... (運営のウォレット) |
   | `_deploymentFee` | テナント作成手数料（wei） | 10000000000000000000 (10 MATIC) |

   **重要**: `_deploymentFee` は wei 単位です。
   - 10 MATIC = `10000000000000000000` (10の後に18個のゼロ)
   - 5 MATIC = `5000000000000000000`
   - 20 MATIC = `20000000000000000000`

5. **デプロイ実行**:
   - 「Deploy」ボタンをクリック
   - MetaMask でトランザクションを承認
   - ガス代: 約 $0.10-0.50（Polygon）

6. **デプロイ確認**:
   - 下部の「Deployed Contracts」セクションに表示される
   - コントラクトアドレスをコピーして保存

**デプロイ例**:
```
_feeRecipient: 0x1234567890123456789012345678901234567890
_deploymentFee: 10000000000000000000

→ Deploy ボタンクリック
→ MetaMask で承認
→ Factory Address: 0xABCDEF... (これを記録)
```

---

## テナント作成手順

### Step 1: Factory に接続

1. Remix の「Deploy & run transactions」タブ
2. 「At Address」ボタンの横の入力欄に Factory アドレスを入力
3. 「At Address」ボタンをクリック
4. 「Deployed Contracts」に Factory が表示される

### Step 2: テナント情報準備

| 項目 | 説明 | 例 |
|-----|------|---|
| `tenantName` | テナント名（店舗名等） | "カフェA Gifterra System" |
| `admin` | テナント管理者アドレス | 0xCafeAdmin... |
| `rewardTokenAddress` | 報酬トークン（Polygon上のERC20） | 0xRewardToken... |
| `tipWalletAddress` | 投げ銭受取ウォレット | 0xCafeTipWallet... |

**重要**: `rewardTokenAddress` は Polygon ネットワーク上に存在するERC20トークンである必要があります。

### Step 3: createTenant 実行

1. 「Deployed Contracts」の Factory を展開
2. `createTenant` 関数を見つける
3. パラメータを入力：

```
tenantName: "カフェA Gifterra System"
admin: 0x1234567890123456789012345678901234567890
rewardTokenAddress: 0xABCDEF1234567890ABCDEF1234567890ABCDEF12
tipWalletAddress: 0x9876543210987654321098765432109876543210
```

4. **VALUE 入力**（重要！）:
   - 「VALUE」欄に手数料を入力
   - 単位を「Ether」に設定
   - 金額: `10` （10 MATIC）

5. 「transact」ボタンをクリック
6. MetaMask で承認

### Step 4: テナント情報取得

トランザクション完了後、イベントからテナント情報を取得：

1. Remix 下部のコンソールでトランザクションをクリック
2. 「logs」セクションを展開
3. `TenantCreated` イベントを確認

**イベント内容例**:
```json
{
  "tenantId": "1",
  "admin": "0x...",
  "tenantName": "カフェA Gifterra System",
  "gifterra": "0xABC123...",
  "rewardNFT": "0xDEF456...",
  "payLitter": "0xGHI789...",
  "journeyPass": "0xJKL012...",
  "randomRewardEngine": "0xMNO345..."
}
```

**これらの5つのアドレスを記録してください。**

### Step 5: テナント情報確認

Factory の `getTenantInfo` 関数を使用：

1. `getTenantInfo` 関数を展開
2. `tenantId` に `1` を入力
3. 「call」ボタンをクリック
4. テナント情報が表示される

---

## コントラクト検証

### Polygonscan での検証

1. **Polygon Amoy**: https://amoy.polygonscan.com/
2. **Polygon Mainnet**: https://polygonscan.com/

#### Factory 検証手順

1. Polygonscan で Factory アドレスを検索
2. 「Contract」タブ → 「Verify and Publish」
3. 以下を入力：

| 項目 | 設定値 |
|-----|--------|
| Compiler Type | Solidity (Single file) |
| Compiler Version | v0.8.19+commit... |
| Open Source License | MIT License |
| Optimization | Yes, 200 runs |

4. コントラクトコードを貼り付け
   - GifterraFactory.sol の全コード
   - すべてのインポートを含む（フラット化）

5. Constructor Arguments (ABI-encoded):
   ```
   0000000000000000000000001234567890123456789012345678901234567890  ← _feeRecipient
   0000000000000000000000000000000000000000000000008ac7230489e80000  ← _deploymentFee (10 MATIC)
   ```

6. 「Verify and Publish」をクリック

**フラット化ツール（推奨）**:
```bash
# Hardhat がある場合
npx hardhat flatten contracts/GifterraFactory.sol > flattened.sol

# または Remix の Flattener プラグインを使用
```

---

## よくある質問

### Q1: "Insufficient deployment fee" エラーが出る

**原因**: VALUE 欄の入力が不足している

**解決策**:
1. Factory の `deploymentFee` 関数を実行して必要額を確認
2. VALUE 欄に正しい金額を入力（単位: Ether）
3. 例: `10` MATIC

### Q2: テストMATICが足りない

**解決策**:
1. https://faucet.polygon.technology/ からテストMATICを取得
2. 1日1回まで取得可能
3. または他の Amoy Faucet を検索

### Q3: コントラクトアドレスを忘れた

**解決策**:
1. MetaMask のトランザクション履歴から確認
2. Polygonscan で自分のアドレスのトランザクション履歴を確認
3. 「Contract Creation」のトランザクションを探す

### Q4: 報酬トークンが Polygon にない

**解決策**:
1. **既存トークンを使用**: Polygon 上の既存ERC20トークン
   - 例: Wrapped MATIC: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`
   - ⚠️ 注意: ステーブルコイン（JPYC等の電子決済手段を除く）は暗号資産交換業登録が必要なため、利用前に法務確認が必要です

2. **独自トークンをデプロイ**: Remix で ERC20 トークンを先にデプロイ
   ```solidity
   import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

   contract MyRewardToken is ERC20 {
       constructor() ERC20("MyReward", "MRW") {
           _mint(msg.sender, 1000000 * 10**18);
       }
   }
   ```

3. **ブリッジを使用**: Ethereum から Polygon へブリッジ
   - 公式ブリッジ: https://portal.polygon.technology/

### Q5: "Admin already has tenant" エラー

**原因**: 同じ admin アドレスで2つ目のテナントを作成しようとした

**解決策**:
1. 別の admin アドレスを使用
2. または、既存テナントの admin を変更してから新規作成

### Q6: ガス代が高すぎる

**確認事項**:
1. 正しく Polygon ネットワークに接続しているか？
   - Ethereum に接続していると100倍以上高い
2. MetaMask の「Network」が「Polygon Amoy」または「Polygon Mainnet」になっているか確認

---

## 運用フロー（Remix版）

### 新規導入者対応（運営側）

1. **情報収集**
   - 店舗名
   - 管理者アドレス
   - 報酬トークンアドレス
   - 投げ銭受取アドレス

2. **Remix で createTenant 実行**
   - VALUE: 10 MATIC を受け取る
   - パラメータ入力
   - デプロイ実行

3. **5つのコントラクトアドレスを通知**
   - Gifterra (SBT)
   - RewardNFT_v2
   - PaySplitter
   - JourneyPass
   - RandomRewardEngine

4. **導入者にマニュアル送付**

### 導入者側（例：カフェA）

1. **5つのコントラクトに「At Address」で接続**
2. **各コントラクトを設定**（Remix の関数呼び出し）
   - Gifterra: ランク閾値、NFT URI設定
   - RewardNFT_v2: SKU登録
   - RandomRewardEngine: 確率テーブル設定
   - etc.

---

## 参考資料

- [Factory 完全ガイド](./FACTORY-DEPLOYMENT-GUIDE.md)
- [システム全体概要](../README-SYSTEM-OVERVIEW.md)
- [アーキテクチャ詳細](./ARCHITECTURE-INTERCONNECTIONS.md)

---

## 推奨手順（チェックリスト）

### Factory デプロイ時

- [ ] MetaMask を Polygon Amoy/Mainnet に接続
- [ ] テストMATICを取得（テストネットの場合）
- [ ] GifterraFactory.sol をコンパイル
- [ ] コンストラクタ引数を準備（feeRecipient, deploymentFee）
- [ ] デプロイ実行
- [ ] Factory アドレスを記録
- [ ] Polygonscan で検証（オプション）

### テナント作成時

- [ ] Factory に「At Address」で接続
- [ ] テナント情報を準備（4つのパラメータ）
- [ ] VALUE 欄に 10 MATIC を入力
- [ ] createTenant 実行
- [ ] 5つのコントラクトアドレスを記録
- [ ] getTenantInfo で確認
- [ ] 導入者に通知

---

**最終更新**: 2025-01-26
**対応バージョン**: GifterraFactory v1.0.0
