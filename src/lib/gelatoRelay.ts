// src/lib/gelatoRelay.ts
// Gelato Relay設定 - ガスレストランザクションを実現

import { GelatoRelay, CallWithSyncFeeRequest } from "@gelatonetwork/relay-sdk";
import { ethers } from "ethers";

/**
 * Gelato API Key (1Balance)
 * 環境変数から取得
 */
const GELATO_API_KEY = import.meta.env.VITE_GELATO_API_KEY;

/**
 * Gelato Relayクライアント
 *
 * 新バージョン (1Balance) を使用
 * 無料枠: テストネット無制限、メインネット月1000リクエストまで無料
 */
export const relay = new GelatoRelay();

/**
 * アクティブチェーンID
 * Polygon Mainnet = 137
 */
export const CHAIN_ID = 137;

/**
 * Gelato Relayを使用してガスレスでERC20トークンを送金
 *
 * Relay Callモード: 送金するトークン自体から手数料が引かれます
 * 例: JPYC 100円を送金 → 受取人には約99.9円届く（手数料0.1円が引かれる）
 *
 * @param signer - ユーザーのSigner（署名用）
 * @param tokenAddress - 送金するトークンのアドレス
 * @param recipientAddress - 受取人のアドレス
 * @param amount - 送金額（wei単位）
 * @returns トランザクションハッシュ
 */
export async function sendTokenGasless(
  signer: ethers.Signer,
  tokenAddress: string,
  recipientAddress: string,
  amount: string
): Promise<string> {
  // ERC20 transfer()のエンコード
  const erc20Interface = new ethers.utils.Interface([
    "function transfer(address to, uint256 amount) returns (bool)",
  ]);

  const data = erc20Interface.encodeFunctionData("transfer", [
    recipientAddress,
    amount,
  ]);

  // Signerのアドレスを取得
  const signerAddress = await signer.getAddress();

  // Gelato Relay Call リクエストの構築
  // 送金するトークンと同じトークンで手数料を支払う
  const request: CallWithSyncFeeRequest = {
    chainId: BigInt(CHAIN_ID),
    target: tokenAddress,
    data: data,
    feeToken: tokenAddress, // 送金するトークンと同じトークンで手数料を支払う
    isRelayContext: true,
  };

  // Gelato Relayで送信（Relay Call - トークンから手数料を引く）
  try {
    if (!GELATO_API_KEY) {
      throw new Error(
        "Gelato API Key が設定されていません。.env に VITE_GELATO_API_KEY を追加してください。"
      );
    }

    // Relay Call（トークンから手数料を引く）- リトライロジック付き
    let lastError: any;
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await relay.callWithSyncFee(
          request,
          GELATO_API_KEY
        );

        return response.taskId;
      } catch (error: any) {
        lastError = error;

        // レート制限エラーの場合はリトライ
        if (error.message?.includes("Too many requests") && i < maxRetries - 1) {
          const waitTime = (i + 1) * 2000; // 2秒、4秒、6秒と増加

          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("❌ Gelato Relay error:", error);

    // エラーメッセージをより詳細に表示
    if (error.message) {
      console.error("Error message:", error.message);
    }
    if (error.response) {
      console.error("Error response:", error.response);
    }

    throw error;
  }
}

/**
 * Gelato Relayを使用して一括送金（ガスレス）
 *
 * @param signer - ユーザーのSigner
 * @param tokenAddress - 送金するトークンのアドレス
 * @param recipients - 受取人のリスト [{ address: string, amount: string }]
 * @returns トランザクションハッシュのリスト
 */
export async function bulkSendTokenGasless(
  signer: ethers.Signer,
  tokenAddress: string,
  recipients: { address: string; amount: string }[]
): Promise<string[]> {
  const taskIds: string[] = [];

  // 各受取人に対して送金
  for (const recipient of recipients) {
    const taskId = await sendTokenGasless(
      signer,
      tokenAddress,
      recipient.address,
      recipient.amount
    );
    taskIds.push(taskId);
  }

  return taskIds;
}

/**
 * タスクステータスの確認
 *
 * @param taskId - Gelato RelayのタスクID
 * @returns タスクステータス
 */
export async function getTaskStatus(taskId: string) {
  const status = await relay.getTaskStatus(taskId);
  return status;
}

/**
 * トランザクション完了を待機
 *
 * @param taskId - Gelato RelayのタスクID
 * @param maxWaitTime - 最大待機時間（ミリ秒）デフォルト: 60秒
 * @param checkInterval - チェック間隔（ミリ秒）デフォルト: 2秒
 * @returns トランザクションハッシュ
 */
export async function waitForTaskCompletion(
  taskId: string,
  maxWaitTime: number = 60000,
  checkInterval: number = 2000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const status = await getTaskStatus(taskId);

    if (status?.taskState === 'ExecSuccess' || status?.taskState === 'CheckSuccess') {

      return status.transactionHash;
    }

    if (status?.taskState === 'Cancelled' || status?.taskState === 'ExecReverted') {
      throw new Error(`Transaction failed: ${status.taskState}`);
    }

    // 待機
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Transaction timeout: Max wait time exceeded');
}

/**
 * Gelato Relayの設定情報
 */
export const GELATO_CONFIG = {
  // 無料枠
  freeQuota: {
    requestsPerMonth: 1000,
    description: "月間1000リクエストまで無料",
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
  docs: "https://docs.gelato.network/web3-services/relay",
};
