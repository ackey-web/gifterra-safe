// src/lib/paymentSplitter.ts
// PaymentSplitter収益管理機能

import { createPublicClient, http, parseAbiItem } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { PAYMENT_SPLITTER_ABI } from '../contract';
import type { TokenId } from '../config/tokens';
import { getTokenConfig } from '../config/tokens';

/**
 * 寄付イベントのデータ構造
 */
export interface DonationEvent {
  token: string;           // ERC20トークンアドレス
  amount: bigint;          // 寄付額（wei）
  sku: string;             // 商品SKU（bytes32をstring化）
  traceId: string;         // トレースID（bytes32をstring化）
  timestamp: number;       // ブロックタイムスタンプ
  transactionHash: string; // トランザクションハッシュ
  blockNumber: bigint;     // ブロック番号
}

/**
 * 収益サマリー
 */
export interface RevenueSummary {
  totalDonations: bigint;       // 総寄付額（wei）
  totalDonationsFormatted: string; // フォーマット済み総額
  donationCount: number;        // 寄付回数
  uniqueProducts: number;       // ユニーク商品数
  tokenSymbol: string;          // トークンシンボル
  tokenDecimals: number;        // トークン小数点桁数
}

/**
 * 商品別収益
 */
export interface ProductRevenue {
  sku: string;                  // 商品SKU
  productId?: string;           // 商品ID（SKUから変換）
  totalAmount: bigint;          // 総売上（wei）
  totalAmountFormatted: string; // フォーマット済み売上
  salesCount: number;           // 販売数
  tokenSymbol: string;          // トークンシンボル
}

/**
 * PublicClientを作成
 */
function getPublicClient() {
  return createPublicClient({
    chain: polygonAmoy,
    transport: http(),
  });
}

/**
 * bytes32からASCII文字列への変換（SKU/TraceID用）
 */
function bytes32ToString(bytes32: string): string {
  // 0xを除去して16進数文字列を取得
  const hex = bytes32.replace('0x', '');
  let str = '';

  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    if (byte === 0) break; // null terminator
    str += String.fromCharCode(byte);
  }

  return str;
}

/**
 * PaymentSplitterの寄付イベントログを取得
 *
 * @param paymentSplitterAddress PaymentSplitterコントラクトアドレス
 * @param fromBlock 開始ブロック（デフォルト: 0n）
 * @param toBlock 終了ブロック（デフォルト: 'latest'）
 * @returns 寄付イベントの配列
 */
export async function fetchDonationEvents(
  paymentSplitterAddress: string,
  fromBlock: bigint = 0n,
  toBlock: bigint | 'latest' = 'latest'
): Promise<DonationEvent[]> {
  const client = getPublicClient();

  try {
    // DonationReceivedイベントのログを取得
    const logs = await client.getLogs({
      address: paymentSplitterAddress as `0x${string}`,
      event: parseAbiItem('event DonationReceived(address indexed token, uint256 amount, bytes32 sku, bytes32 traceId)'),
      fromBlock,
      toBlock,
    });

    // イベントデータを整形
    const events: DonationEvent[] = await Promise.all(
      logs.map(async (log) => {
        // ブロック情報を取得してタイムスタンプを取得
        const block = await client.getBlock({ blockNumber: log.blockNumber });

        return {
          token: log.args.token as string,
          amount: log.args.amount as bigint,
          sku: bytes32ToString(log.args.sku as string),
          traceId: bytes32ToString(log.args.traceId as string),
          timestamp: Number(block.timestamp),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
      })
    );

    return events.sort((a, b) => b.timestamp - a.timestamp); // 新しい順
  } catch (error) {
    console.error('Failed to fetch donation events:', error);
    return [];
  }
}

/**
 * トークンアドレスからTokenIdを推測
 *
 * @param tokenAddress トークンアドレス
 * @returns TokenId または null
 */
function getTokenIdFromAddress(tokenAddress: string): TokenId | null {
  const normalizedAddress = tokenAddress.toLowerCase();

  // 各トークンのアドレスと照合
  const tokens: TokenId[] = ['NHT', 'JPYC'];

  for (const tokenId of tokens) {
    const config = getTokenConfig(tokenId);
    if (config.currentAddress.toLowerCase() === normalizedAddress) {
      return tokenId;
    }
  }

  return null;
}

/**
 * 収益サマリーを計算
 *
 * @param events 寄付イベント配列
 * @param tokenAddress フィルタ対象のトークンアドレス（省略時は全トークン）
 * @returns 収益サマリー
 */
export function calculateRevenueSummary(
  events: DonationEvent[],
  tokenAddress?: string
): RevenueSummary {
  // トークンでフィルタ
  const filteredEvents = tokenAddress
    ? events.filter(e => e.token.toLowerCase() === tokenAddress.toLowerCase())
    : events;

  // 集計
  const totalDonations = filteredEvents.reduce((sum, e) => sum + e.amount, 0n);
  const uniqueProducts = new Set(filteredEvents.map(e => e.sku)).size;

  // トークン情報を取得
  let tokenSymbol = 'Unknown';
  let tokenDecimals = 18;

  if (tokenAddress) {
    const tokenId = getTokenIdFromAddress(tokenAddress);
    if (tokenId) {
      const config = getTokenConfig(tokenId);
      tokenSymbol = config.symbol;
      tokenDecimals = config.decimals;
    }
  }

  // フォーマット
  const divisor = BigInt(10) ** BigInt(tokenDecimals);
  const integerPart = totalDonations / divisor;
  const fractionalPart = totalDonations % divisor;
  const fractionalStr = fractionalPart.toString().padStart(tokenDecimals, '0').replace(/0+$/, '');
  const totalDonationsFormatted = fractionalStr
    ? `${integerPart}.${fractionalStr}`
    : integerPart.toString();

  return {
    totalDonations,
    totalDonationsFormatted,
    donationCount: filteredEvents.length,
    uniqueProducts,
    tokenSymbol,
    tokenDecimals,
  };
}

/**
 * 商品別収益を計算
 *
 * @param events 寄付イベント配列
 * @param tokenAddress フィルタ対象のトークンアドレス（省略時は全トークン）
 * @returns 商品別収益配列
 */
export function calculateProductRevenue(
  events: DonationEvent[],
  tokenAddress?: string
): ProductRevenue[] {
  // トークンでフィルタ
  const filteredEvents = tokenAddress
    ? events.filter(e => e.token.toLowerCase() === tokenAddress.toLowerCase())
    : events;

  // トークン情報を取得
  let tokenSymbol = 'Unknown';
  let tokenDecimals = 18;

  if (tokenAddress) {
    const tokenId = getTokenIdFromAddress(tokenAddress);
    if (tokenId) {
      const config = getTokenConfig(tokenId);
      tokenSymbol = config.symbol;
      tokenDecimals = config.decimals;
    }
  }

  // 商品別に集計
  const revenueMap = new Map<string, { amount: bigint; count: number }>();

  for (const event of filteredEvents) {
    const current = revenueMap.get(event.sku) || { amount: 0n, count: 0 };
    revenueMap.set(event.sku, {
      amount: current.amount + event.amount,
      count: current.count + 1,
    });
  }

  // 配列に変換してソート
  const divisor = BigInt(10) ** BigInt(tokenDecimals);

  return Array.from(revenueMap.entries())
    .map(([sku, data]) => {
      const integerPart = data.amount / divisor;
      const fractionalPart = data.amount % divisor;
      const fractionalStr = fractionalPart.toString().padStart(tokenDecimals, '0').replace(/0+$/, '');
      const totalAmountFormatted = fractionalStr
        ? `${integerPart}.${fractionalStr}`
        : integerPart.toString();

      return {
        sku,
        productId: sku, // TODO: SKUからproductIdへのマッピング
        totalAmount: data.amount,
        totalAmountFormatted,
        salesCount: data.count,
        tokenSymbol,
      };
    })
    .sort((a, b) => (b.totalAmount > a.totalAmount ? 1 : -1)); // 売上の多い順
}

/**
 * PaymentSplitterから収益を出金
 *
 * @param paymentSplitterAddress PaymentSplitterアドレス
 * @param tokenAddress 出金するトークンアドレス
 * @param walletClient ウォレットクライアント
 * @returns トランザクションハッシュ
 */
export async function withdrawRevenue(
  paymentSplitterAddress: string,
  tokenAddress: string,
  walletClient: any
): Promise<string> {
  try {
    // releaseAllERC20を呼び出し
    const tx = await walletClient.writeContract({
      address: paymentSplitterAddress as `0x${string}`,
      abi: PAYMENT_SPLITTER_ABI,
      functionName: 'releaseAllERC20',
      args: [tokenAddress as `0x${string}`],
    });

    return tx;
  } catch (error) {
    console.error('Failed to withdraw revenue:', error);
    throw error;
  }
}

/**
 * PaymentSplitterの受取人と配分比率を取得
 *
 * @param paymentSplitterAddress PaymentSplitterアドレス
 * @returns 受取人と配分比率
 */
export async function getPaymentSplitInfo(
  _paymentSplitterAddress: string
): Promise<{ payees: string[]; shares: bigint[] }> {
  try {
    // payeesとsharesを取得（GifterraPaySplitterはシンプルなので直接読み取り）
    // TODO: コントラクトの実装に応じて調整が必要

    // 暫定的に空配列を返す（コントラクトの実装確認後に修正）
    return {
      payees: [],
      shares: [],
    };
  } catch (error) {
    console.error('Failed to get payment split info:', error);
    return {
      payees: [],
      shares: [],
    };
  }
}
