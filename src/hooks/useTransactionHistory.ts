// src/hooks/useTransactionHistory.ts
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_TOKENS } from '../config/supportedTokens';

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  timestamp: number;
  type: 'send' | 'receive';
}

/**
 * PolygonScan APIを使ってERC20トランザクション履歴を取得
 *
 * Note: PolygonScan APIは無料で使用可能ですが、レート制限があります
 * - 無料: 5 calls/sec, 100,000 calls/day
 * - APIキー不要でも動作しますが、制限が厳しいです
 *
 * 【拡張性】
 * supportedTokens.ts に新しいトークンを追加するだけで、
 * 自動的にそのトークンの履歴も表示されるようになります。
 */
export function useTransactionHistory(address: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const normalizedAddress = address.toLowerCase();

        // SUPPORTED_TOKENS に登録されている全トークンのトランザクションを取得
        const txPromises = SUPPORTED_TOKENS.map(token =>
          fetchTokenTransactions(normalizedAddress, token.ADDRESS, token.SYMBOL)
        );

        const allTokenTxs = await Promise.all(txPromises);

        // 全トランザクションをマージして時刻順にソート
        const allTxs = allTokenTxs
          .flat()
          .sort((a, b) => b.timestamp - a.timestamp);

        // 最新20件のみ表示
        setTransactions(allTxs.slice(0, 20));
        setLoading(false);
      } catch (error) {
        console.error('❌ useTransactionHistory: Failed to fetch transaction history:', error);
        setTransactions([]);
        setLoading(false);
      }
    };

    fetchTransactions();

    // 30秒ごとに更新
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [address]);

  return { transactions, loading };
}

/**
 * PolygonScan APIから特定トークンのトランザクション履歴を取得
 */
async function fetchTokenTransactions(
  address: string,
  tokenAddress: string,
  tokenSymbol: string
): Promise<Transaction[]> {
  try {
    // PolygonScan API キー（必須: V2 APIはAPIキーが必要）
    const apiKey = import.meta.env.VITE_POLYGONSCAN_API_KEY || '';

    if (!apiKey) {
      console.warn(`⚠️ ${tokenSymbol}: PolygonScan API key is required for V2 API. Please set VITE_POLYGONSCAN_API_KEY in .env file.`);
      return [];
    }

    // PolygonScan API エンドポイント（正しいPolygon Mainnet用）
    const apiUrl = `https://api.polygonscan.com/api?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${address}&page=1&offset=20&sort=desc&apikey=${apiKey}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== '1') {
      console.warn(`⚠️ ${tokenSymbol}: PolygonScan API error - ${data.message}. Result:`, data.result);
      return [];
    }

    if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
      return [];
    }

    // トランザクションを変換
    const transactions = data.result.map((tx: any) => {
      const isSend = tx.from.toLowerCase() === address.toLowerCase();

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatUnits(tx.value, 18),
        tokenSymbol, // パラメータで渡されたシンボルを使用
        timestamp: parseInt(tx.timeStamp),
        type: isSend ? 'send' : 'receive',
      } as Transaction;
    });

    return transactions;
  } catch (error) {
    console.error(`❌ Failed to fetch ${tokenSymbol} (${tokenAddress}) transactions:`, error);
    return [];
  }
}
