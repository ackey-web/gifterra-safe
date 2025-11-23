// src/hooks/useTokenBalances.ts
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { JPYC_TOKEN, NHT_TOKEN, ERC20_MIN_ABI } from '../contract';

// Polygon Mainnet用の公開RPC（CORS対応）- フォールバック付き
const POLYGON_RPC_ENDPOINTS = [
  'https://polygon-rpc.com',
  'https://rpc-mainnet.matic.network',
  'https://polygon-mainnet.public.blastapi.io',
  'https://rpc.ankr.com/polygon'
];

export interface TokenBalance {
  symbol: string;
  balance: string;
  formatted: string;
  loading: boolean;
  error?: string;
}

// シンプルなメモリキャッシュ（複数タブ/デバイスでの安定性向上）
interface CachedBalance {
  data: { matic: TokenBalance; jpyc: TokenBalance; nht: TokenBalance };
  timestamp: number;
}

const balanceCache = new Map<string, CachedBalance>();
const CACHE_DURATION = 5000; // 5秒間キャッシュ

// RPCプロバイダーをリトライ付きで取得するヘルパー関数
async function getProviderWithRetry(maxRetries = 3): Promise<ethers.providers.JsonRpcProvider> {
  for (let i = 0; i < POLYGON_RPC_ENDPOINTS.length; i++) {
    const rpcUrl = POLYGON_RPC_ENDPOINTS[i];
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    try {
      // ネットワーク接続を確認
      await provider.getNetwork();
      return provider;
    } catch (error) {
      console.warn(`Failed to connect to RPC ${rpcUrl}:`, error);
      if (i === POLYGON_RPC_ENDPOINTS.length - 1) {
        throw new Error('All RPC endpoints failed');
      }
    }
  }
  throw new Error('No RPC endpoints available');
}

// エクスポネンシャルバックオフ付きでトークン残高を取得
async function fetchTokenBalanceWithRetry(
  contract: ethers.Contract,
  address: string,
  decimals: number,
  maxRetries = 3
): Promise<{ balance: string; formatted: string }> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const balance = await contract.balanceOf(address);
      const formatted = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(2);
      return { balance: balance.toString(), formatted };
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);

      if (attempt < maxRetries - 1) {
        // エクスポネンシャルバックオフ: 500ms, 1s, 2s
        const delay = Math.min(500 * Math.pow(2, attempt), 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export function useTokenBalances(address: string | undefined, signer: ethers.Signer | null) {
  const [balances, setBalances] = useState<{
    matic: TokenBalance;
    jpyc: TokenBalance;
    nht: TokenBalance;
  }>({
    matic: { symbol: 'MATIC', balance: '0', formatted: '0.00', loading: true },
    jpyc: { symbol: 'JPYC', balance: '0', formatted: '0.00', loading: true },
    nht: { symbol: 'NHT', balance: '0', formatted: '0.00', loading: true },
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!address) {
      setBalances({
        matic: { symbol: 'MATIC', balance: '0', formatted: '0.00', loading: false },
        jpyc: { symbol: 'JPYC', balance: '0', formatted: '0.00', loading: false },
        nht: { symbol: 'NHT', balance: '0', formatted: '0.00', loading: false },
      });
      return;
    }

    const fetchBalances = async () => {
      // キャッシュチェック（複数タブ/デバイスでのリクエスト削減）
      const cached = balanceCache.get(address);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setBalances(cached.data);
        return;
      }

      try {
        // フォールバック付きRPCプロバイダーを取得
        const publicProvider = await getProviderWithRetry();

        // MATIC残高
        const maticBalance = await publicProvider.getBalance(address);
        const maticFormatted = parseFloat(ethers.utils.formatEther(maticBalance)).toFixed(4);

        // JPYC残高（リトライ付き）
        let jpycBalance = '0';
        let jpycFormatted = '0.00';
        let jpycError: string | undefined;
        try {
          const jpycContract = new ethers.Contract(JPYC_TOKEN.ADDRESS, ERC20_MIN_ABI, publicProvider);
          const code = await publicProvider.getCode(JPYC_TOKEN.ADDRESS);
          if (code !== '0x') {
            const result = await fetchTokenBalanceWithRetry(jpycContract, address, 18);
            jpycBalance = result.balance;
            jpycFormatted = result.formatted;
          }
        } catch (e) {
          console.error('Failed to fetch JPYC balance after retries:', e);
          jpycError = 'JPYC残高の取得に失敗しました';
        }

        // NHT残高（リトライ付き）
        let nhtBalance = '0';
        let nhtFormatted = '0.00';
        let nhtError: string | undefined;
        try {
          const nhtContract = new ethers.Contract(NHT_TOKEN.ADDRESS, ERC20_MIN_ABI, publicProvider);
          const result = await fetchTokenBalanceWithRetry(nhtContract, address, 18);
          nhtBalance = result.balance;
          nhtFormatted = result.formatted;
        } catch (e) {
          console.error('Failed to fetch NHT balance after retries:', e);
          nhtError = 'NHT残高の取得に失敗しました';
        }

        const newBalances = {
          matic: {
            symbol: 'MATIC',
            balance: maticBalance.toString(),
            formatted: maticFormatted,
            loading: false
          },
          jpyc: {
            symbol: 'JPYC',
            balance: jpycBalance,
            formatted: jpycFormatted,
            loading: false,
            error: jpycError
          },
          nht: {
            symbol: 'NHT',
            balance: nhtBalance,
            formatted: nhtFormatted,
            loading: false,
            error: nhtError
          },
        };

        // キャッシュに保存
        balanceCache.set(address, {
          data: newBalances,
          timestamp: Date.now()
        });

        setBalances(newBalances);
      } catch (error) {
        console.error('Failed to fetch token balances:', error);
        const errorMessage = 'ネットワーク接続エラー';
        setBalances({
          matic: { symbol: 'MATIC', balance: '0', formatted: '0.00', loading: false, error: errorMessage },
          jpyc: { symbol: 'JPYC', balance: '0', formatted: '0.00', loading: false, error: errorMessage },
          nht: { symbol: 'NHT', balance: '0', formatted: '0.00', loading: false, error: errorMessage },
        });
      }
    };

    fetchBalances();

    // 10秒ごとに更新（より頻繁に）
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [address, signer, refreshTrigger]);

  const refetch = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return { balances, refetch };
}
