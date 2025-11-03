# Embedded Wallet + 自前リレイヤー方式 設計書

**Phase 0**: コスト重視のウォレットレス＆ガスレス実装
**最終更新**: 2025-10-28
**ステータス**: 設計中

---

## 🎯 目的

**最小コストで真のウォレットレス＆ガスレス体験を実現**

- ✅ ウォレットレス（メール/SNSログイン）
- ✅ ガスレス（ユーザーはMATIC不要）
- ✅ thirdweb無料枠のみ使用
- ✅ コスト = ガス代実費のみ（月5,000〜45,000円）

---

## 🏗️ アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────┐
│         User (ブラウザ)                      │
├─────────────────────────────────────────────┤
│                                             │
│  1. メールログイン                           │
│     ↓                                       │
│  2. Embedded Wallet作成（thirdweb無料）     │
│     ↓                                       │
│  3. 「Tip送信」ボタンクリック                 │
│     ↓                                       │
│  4. トランザクションに署名（自動）            │
│     ↓                                       │
│  5. 署名をリレイヤーAPIに送信                │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│    Relayer API (Vercel Serverless)          │
├─────────────────────────────────────────────┤
│                                             │
│  1. 署名を検証                               │
│     ↓                                       │
│  2. リレイヤーウォレットでトランザクション実行 │
│     ↓                                       │
│  3. ガス代をリレイヤーが負担                  │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│      Polygon Amoy / Mainnet                 │
├─────────────────────────────────────────────┤
│                                             │
│  - Gifterra Contract（拡張版）               │
│    - tipOnBehalf()                          │
│    - claimRewardOnBehalf()                  │
│    - purchaseOnBehalf()                     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📦 コンポーネント詳細

### 1. Embedded Wallet（フロントエンド）

**役割**: ウォレットレスを実現

```typescript
// src/config/wallets.ts（既存を流用）
import { EmbeddedWallet } from "@thirdweb-dev/wallets";

export const supportedWallets = [
  {
    id: "embedded",
    meta: {
      name: "メール/SNSログイン（推奨・無料）",
      iconURL: "...",
    },
    create: () => new EmbeddedWallet({
      auth: {
        options: ["email", "google"],
      },
    }),
    recommended: true,
  },
  // MetaMask等も残す（上級者向け）
];
```

**コスト**: **無料**（月間1,000ウォレットまで）

---

### 2. メタトランザクション対応コントラクト

**役割**: ユーザーの代わりにリレイヤーがトランザクション実行

#### 署名検証ユーティリティ

```solidity
// contracts/libs/MetaTxLibrary.sol（新規）
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library MetaTxLibrary {
    /**
     * @dev EIP-712準拠の署名検証
     */
    function verify(
        address signer,
        bytes32 messageHash,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);
        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    function getEthSignedMessageHash(bytes32 messageHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
    }

    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
```

#### Gifterraコントラクト拡張

```solidity
// contracts/Gifterra.sol に追加
import "./libs/MetaTxLibrary.sol";

contract Gifterra {
    using MetaTxLibrary for bytes;

    // Nonce管理（リプレイアタック防止）
    mapping(address => uint256) public nonces;

    /**
     * @dev リレイヤー経由でTip送信
     * @param from 実際のTip送信者
     * @param to Tip受取者
     * @param amount Tip金額
     * @param nonce リプレイ攻撃防止用
     * @param signature fromの署名
     */
    function tipOnBehalf(
        address from,
        address to,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external {
        // Nonce検証
        require(nonces[from] == nonce, "Invalid nonce");

        // メッセージハッシュ作成
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "tip",
                from,
                to,
                amount,
                nonce,
                block.chainid
            )
        );

        // 署名検証
        require(
            MetaTxLibrary.verify(from, messageHash, signature),
            "Invalid signature"
        );

        // Nonce更新
        nonces[from]++;

        // Tip実行（内部関数）
        _tip(from, to, amount);

        emit TipOnBehalf(from, to, amount, msg.sender);
    }

    /**
     * @dev リレイヤー経由でReward受取
     */
    function claimRewardOnBehalf(
        address claimer,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(nonces[claimer] == nonce, "Invalid nonce");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "claimReward",
                claimer,
                nonce,
                block.chainid
            )
        );

        require(
            MetaTxLibrary.verify(claimer, messageHash, signature),
            "Invalid signature"
        );

        nonces[claimer]++;

        _claimReward(claimer);

        emit ClaimRewardOnBehalf(claimer, msg.sender);
    }

    /**
     * @dev リレイヤー経由でGIFT HUB特典受取
     */
    function purchaseOnBehalf(
        address buyer,
        string memory productId,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(nonces[buyer] == nonce, "Invalid nonce");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "purchase",
                buyer,
                productId,
                nonce,
                block.chainid
            )
        );

        require(
            MetaTxLibrary.verify(buyer, messageHash, signature),
            "Invalid signature"
        );

        nonces[buyer]++;

        _purchase(buyer, productId);

        emit PurchaseOnBehalf(buyer, productId, msg.sender);
    }

    // Events
    event TipOnBehalf(address indexed from, address indexed to, uint256 amount, address relayer);
    event ClaimRewardOnBehalf(address indexed claimer, address relayer);
    event PurchaseOnBehalf(address indexed buyer, string productId, address relayer);
}
```

---

### 3. リレイヤーAPI（Vercel Serverless）

**役割**: ガス代を負担してトランザクション実行

```typescript
// api/relay/tip.ts（新規）
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../src/contract';

// 環境変数からリレイヤーウォレット取得
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.VITE_ALCHEMY_RPC_URL!;

// Provider & Wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { from, to, amount, nonce, signature } = await req.json();

    // 基本検証
    if (!from || !to || !amount || nonce === undefined || !signature) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // ガススポンサーシップルールをチェック
    const rule = checkGasSponsorshipRule('tip', { amount });
    if (!rule.shouldSponsor) {
      return Response.json({
        error: 'Gas sponsorship not available for this transaction',
        reason: rule.reason
      }, { status: 403 });
    }

    // トランザクション実行
    const tx = await contract.tipOnBehalf(
      from,
      to,
      amount,
      nonce,
      signature,
      {
        gasLimit: 300000, // ガスリミット設定
      }
    );

    // トランザクション完了を待つ
    const receipt = await tx.wait();

    // 成功レスポンス
    return Response.json({
      success: true,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
    });

  } catch (error: any) {
    console.error('❌ Relay error:', error);

    // エラーレスポンス
    return Response.json({
      success: false,
      error: error.message || 'Transaction failed',
    }, { status: 500 });
  }
}

/**
 * ガススポンサーシップルールをチェック
 */
function checkGasSponsorshipRule(
  operation: string,
  context: { amount?: string }
): { shouldSponsor: boolean; reason?: string } {
  // Phase 1ルールを適用
  if (operation === 'tip') {
    const maxAmount = ethers.BigNumber.from('1000000000000000000000'); // 1000 JPYC
    const amount = ethers.BigNumber.from(context.amount || '0');

    if (amount.gt(maxAmount)) {
      return {
        shouldSponsor: false,
        reason: 'Amount exceeds sponsorship limit (1000 JPYC)',
      };
    }
  }

  return { shouldSponsor: true };
}
```

同様に以下も作成：
- `api/relay/claimReward.ts`
- `api/relay/purchase.ts`

---

### 4. フロントエンド統合

```typescript
// src/hooks/useGaslessTransaction.ts（新規）
import { useAddress, useSigner } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { useState } from 'react';

export function useGaslessTransaction() {
  const address = useAddress();
  const signer = useSigner();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * ガスレスでTip送信
   */
  async function sendTipGasless(to: string, amount: string) {
    if (!address || !signer) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    try {
      // Nonceを取得
      const nonce = await contract.nonces(address);

      // メッセージハッシュ作成
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        ['tip', address, to, amount, nonce, 80002] // chainId
      );

      // 署名
      const signature = await signer.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // リレイヤーAPIに送信
      const response = await fetch('/api/relay/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to,
          amount,
          nonce: nonce.toString(),
          signature,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    sendTipGasless,
    isLoading,
  };
}
```

**UIコンポーネントでの使用:**

```typescript
// src/tip-ui/App.tsx（修正）
import { useGaslessTransaction } from '../hooks/useGaslessTransaction';

function TipUI() {
  const { sendTipGasless, isLoading } = useGaslessTransaction();

  const handleTip = async () => {
    try {
      const result = await sendTipGasless(recipient, amount);
      alert(`✅ Tip送信完了！ TxHash: ${result.txHash}`);
    } catch (error) {
      alert(`❌ エラー: ${error.message}`);
    }
  };

  return (
    <button onClick={handleTip} disabled={isLoading}>
      {isLoading ? '送信中...' : 'Tip送信（ガス代無料）'}
    </button>
  );
}
```

---

## 💰 コスト試算

### 初期コスト（開発）

| 項目 | 工数 | 備考 |
|------|------|------|
| スマートコントラクト拡張 | 4時間 | メタトランザクション機能追加 |
| リレイヤーAPI実装 | 3時間 | Vercel Serverless Functions |
| フロントエンド統合 | 2時間 | useGaslessTransaction hook |
| テスト | 2時間 | テストネット動作確認 |
| **合計** | **11時間** | **約1.5日** |

### 月額コスト（運用）

| 項目 | コスト | 備考 |
|------|--------|------|
| **thirdweb Embedded Wallet** | **$0** | 月間1,000ウォレットまで無料 |
| **Vercel Serverless** | **$0** | 無料枠内（月100,000リクエスト） |
| **ガス代（実費）** | **5,000〜45,000円** | DAU 100〜1,000想定 |
| **合計** | **5,000〜45,000円** | **thirdweb Smart Walletの$99/月不要** |

---

## 🔄 将来の移行計画

### Phase 0 → Smart Wallet移行

マネタイズが進み、DAU 500超えた時点で：

```bash
# 1. thirdweb Growthプラン契約（$99/月）
# 2. Smart Wallet Factory取得
# 3. .envで切り替え
VITE_ENABLE_SMART_WALLET=true
VITE_SMART_WALLET_FACTORY=0x...

# 4. デプロイ
# → 既存ユーザーは自動的にSmart Walletに移行
```

**移行は透過的**（ユーザーは何も意識しない）

---

## 🎯 次のステップ

### 実装順序

1. **MetaTxLibrary.sol 作成**
2. **Gifterra.sol 拡張**（tipOnBehalf等）
3. **リレイヤーAPI実装**（/api/relay/*）
4. **useGaslessTransaction hook**
5. **UI統合**
6. **テスト**

---

## 📚 参考資料

- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [Meta Transactions Guide](https://docs.openzeppelin.com/learn/sending-gasless-transactions)
- [thirdweb Embedded Wallet](https://portal.thirdweb.com/connect/embedded-wallet)

---

**🚀 準備完了！実装を開始しましょう！**
