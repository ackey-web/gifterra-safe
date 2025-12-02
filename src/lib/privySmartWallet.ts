// src/lib/privySmartWallet.ts
// Privy Smart Wallet + Pimlico - 完全なガスレストランザクションを実現

import { createPublicClient, createWalletClient, custom, http, type Hex, encodeFunctionData, parseAbi, type Account } from "viem";
import { polygon } from "viem/chains";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient, type SmartAccountSigner } from "permissionless";

// EntryPoint v0.6 Address
const ENTRYPOINT_ADDRESS_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

/**
 * Pimlico API Key
 */
const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY;

/**
 * アクティブチェーン - Polygon Mainnet
 */
const ACTIVE_CHAIN = polygon;

/**
 * Pimlico Bundler & Paymaster URL
 */
const PIMLICO_URL = `https://api.pimlico.io/v2/${ACTIVE_CHAIN.id}/rpc?apikey=${PIMLICO_API_KEY}`;

/**
 * Privyウォレットから Pimlico Smart Wallet を作成
 *
 * @param privyProvider - Privy の Ethereum Provider
 * @returns SmartAccountClient
 */
export async function createPrivySmartWallet(privyProvider: any) {
  if (!PIMLICO_API_KEY) {
    throw new Error(
      "Pimlico API Key が設定されていません。.env に VITE_PIMLICO_API_KEY を追加してください。"
    );
  }

  // Public Client
  const publicClient = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(),
  });

  // Pimlico Client (Paymaster)
  const pimlicoClient = createPimlicoClient({
    transport: http(PIMLICO_URL),
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });

  // Owner (Privy Embedded Wallet)
  const [ownerAddress] = await privyProvider.request({ method: 'eth_requestAccounts' });

  // Wallet Client with Account
  const walletClient = createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: custom(privyProvider),
  });

  // Get the account from wallet client
  const [account] = await walletClient.getAddresses();

  // Create SmartAccountSigner
  const smartAccountSigner: SmartAccountSigner = {
    account: {
      address: account as Hex,
      type: 'json-rpc' as const,
    } as Account,

    async signMessage({ message }: { message: any }) {
      const signature = await privyProvider.request({
        method: 'personal_sign',
        params: [typeof message === 'string' ? message : message.raw, account],
      });
      return signature as Hex;
    },

    async signTypedData(typedData: any) {
      const signature = await privyProvider.request({
        method: 'eth_signTypedData_v4',
        params: [account, JSON.stringify(typedData)],
      });
      return signature as Hex;
    },

    async signTransaction(transaction: any) {
      throw new Error('signTransaction not supported for smart accounts');
    },
  };

  // Simple Smart Account
  const simpleSmartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: smartAccountSigner,
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });

  // Smart Account Client (with Paymaster)
  const smartAccountClient = createSmartAccountClient({
    account: simpleSmartAccount,
    chain: ACTIVE_CHAIN,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
  });

  return smartAccountClient;
}

/**
 * Privy Smart Wallet を使ってガスレスでERC20トークンを送金
 *
 * @param smartWallet - Smart Wallet Client
 * @param tokenAddress - 送金するトークンのアドレス
 * @param recipientAddress - 受取人のアドレス
 * @param amount - 送金額（wei単位）
 * @returns トランザクションハッシュ
 */
export async function sendTokenWithPrivySmartWallet(
  smartWallet: any,
  tokenAddress: string,
  recipientAddress: string,
  amount: string
): Promise<string> {

  // ERC20 transfer のエンコード
  const data = encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
    functionName: "transfer",
    args: [recipientAddress as Hex, BigInt(amount)],
  });

  try {
    // Privy Smart Wallet でトランザクションを送信（完全なガスレス）
    // Pimlicoのpaymasterが自動的にガス代をスポンサー
    const userOpHash = await smartWallet.sendTransaction({
      to: tokenAddress as Hex,
      data: data,
      value: BigInt(0),
    });

    // トランザクション確認を待つ
    const receipt = await smartWallet.waitForUserOperationReceipt({ hash: userOpHash });

    return receipt.receipt.transactionHash;
  } catch (error: any) {
    console.error('❌ Privy Smart Wallet error:', error);
    throw error;
  }
}

/**
 * Privy Smart Wallet の設定情報
 */
export const PRIVY_SMART_WALLET_CONFIG = {
  // Paymaster Provider
  provider: "Pimlico",

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
  docs: {
    privy: "https://docs.privy.io/guide/react/wallets/smart-wallets",
    pimlico: "https://docs.pimlico.io/guides/how-to/signers/privy",
  },
};
