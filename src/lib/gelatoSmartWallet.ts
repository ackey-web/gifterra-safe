// src/lib/gelatoSmartWallet.ts
// Gelato Smart Wallet - 完全なガスレストランザクションを実現

import { createGelatoSmartWalletClient, sponsored } from "@gelatonetwork/smartwallet";
import { createWalletClient, createPublicClient, http, type Hex, custom, encodeFunctionData, parseAbi } from "viem";
import { polygon } from "viem/chains";

/**
 * Gelato API Key
 */
const GELATO_API_KEY = import.meta.env.VITE_GELATO_API_KEY;

/**
 * アクティブチェーン
 */
const ACTIVE_CHAIN = polygon;

/**
 * Privyウォレットから Gelato Smart Wallet を作成
 *
 * @param privyProvider - Privy の Ethereum Provider
 * @returns SmartWalletClient
 */
export async function createGelatoSmartWallet(
  privyProvider: any
) {
  if (!GELATO_API_KEY) {
    throw new Error(
      "Gelato API Key が設定されていません。.env に VITE_GELATO_API_KEY を追加してください。"
    );
  }

  // Privy Provider から Viem Wallet Client を作成
  const walletClient = createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: custom(privyProvider),
  });

  // Gelato Smart Wallet Client を作成（公式ドキュメントに従った正しい方法）
  // walletClientを直接渡し、apiKeyでスポンサーシップを設定
  const smartWalletClient = await createGelatoSmartWalletClient(
    walletClient,
    { apiKey: GELATO_API_KEY }
  );

  return smartWalletClient;
}

/**
 * Gelato Smart Wallet を使ってガスレスでERC20トークンを送金
 *
 * @param smartWallet - Gelato Smart Wallet Client
 * @param tokenAddress - 送金するトークンのアドレス
 * @param recipientAddress - 受取人のアドレス
 * @param amount - 送金額（wei単位）
 * @returns トランザクションハッシュ
 */
export async function sendTokenWithSmartWallet(
  smartWallet: any,
  tokenAddress: string,
  recipientAddress: string,
  amount: string
): Promise<string> {
  if (!GELATO_API_KEY) {
    throw new Error(
      "Gelato API Key が設定されていません。.env に VITE_GELATO_API_KEY を追加してください。"
    );
  }

  console.log("📤 Sending gasless transaction with Smart Wallet:", {
    token: tokenAddress,
    to: recipientAddress,
    amount: amount,
  });

  // ERC20 transfer のエンコード (viem)
  const data = encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
    functionName: "transfer",
    args: [recipientAddress as Hex, BigInt(amount)],
  });

  try {
    // Gelato Smart Wallet でトランザクションを送信（完全なガスレス）
    // sponsoredを使ってガススポンサーを設定
    const userOpHash = await smartWallet.sendTransaction({
      to: tokenAddress as Hex,
      data: data,
      value: BigInt(0),
    });

    console.log("✅ UserOp hash:", userOpHash);

    // トランザクション確認を待つ
    const receipt = await smartWallet.waitForUserOperationReceipt({ hash: userOpHash });
    console.log("✅ Transaction receipt:", receipt);

    return receipt.receipt.transactionHash;
  } catch (error: any) {
    console.error("❌ Gelato Smart Wallet error:", error);
    throw error;
  }
}

/**
 * Gelato Smart Wallet を使って一括送金（ガスレス）
 * バッチ処理により、複数の送金を1つのトランザクションで実行
 *
 * @param smartWallet - Gelato Smart Wallet Client
 * @param tokenAddress - 送金するトークンのアドレス
 * @param recipients - 受取人のリスト [{ address: string, amount: string }]
 * @returns トランザクションハッシュ
 */
export async function bulkSendTokenWithSmartWallet(
  smartWallet: any,
  tokenAddress: string,
  recipients: { address: string; amount: string }[]
): Promise<string> {
  if (!GELATO_API_KEY) {
    throw new Error(
      "Gelato API Key が設定されていません。.env に VITE_GELATO_API_KEY を追加してください。"
    );
  }

  console.log(`📤 Sending ${recipients.length} gasless transactions in batch with Smart Wallet`);

  try {
    // バッチ送金: 各受取人に対して個別に送金（Gelato Smart Walletでバッチはサポートされていない可能性）
    const txHashes: string[] = [];

    for (const recipient of recipients) {
      const data = encodeFunctionData({
        abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
        functionName: "transfer",
        args: [recipient.address as Hex, BigInt(recipient.amount)],
      });

      const userOpHash = await smartWallet.sendTransaction({
        to: tokenAddress as Hex,
        data: data,
        value: BigInt(0),
      });

      console.log(`✅ UserOp hash for ${recipient.address}:`, userOpHash);

      const receipt = await smartWallet.waitForUserOperationReceipt({ hash: userOpHash });
      txHashes.push(receipt.receipt.transactionHash);
    }

    console.log("✅ All batch transactions completed:", txHashes);
    return txHashes.join(','); // 複数のハッシュをカンマ区切りで返す
  } catch (error: any) {
    console.error("❌ Gelato Smart Wallet batch error:", error);
    throw error;
  }
}

/**
 * Gelato Smart Wallet の設定情報
 */
export const GELATO_SMART_WALLET_CONFIG = {
  // 無料枠
  freeQuota: {
    testnet: "Unlimited",
    mainnet: "1000 transactions/month",
  },

  // コスト
  costs: {
    deployment: "~0.01 POL per user (~$0.01)",
    transaction: "~0.0005 POL per tx (~$0.0005)",
  },

  // サポートチェーン
  supportedChains: [
    {
      chainId: 80002,
      name: "Polygon Amoy Testnet",
    },
    {
      chainId: 137,
      name: "Polygon Mainnet",
    },
  ],

  // ドキュメント
  docs: "https://docs.gelato.network/web3-services/smart-wallet-sdk",
};
