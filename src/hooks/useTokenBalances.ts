// src/hooks/useTokenBalances.ts
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { JPYC_TOKEN, NHT_TOKEN, ERC20_MIN_ABI } from '../contract';

// Polygon Mainnet用の公開RPC（CORS対応）
const POLYGON_MAINNET_RPC = 'https://polygon-rpc.com';

export interface TokenBalance {
  symbol: string;
  balance: string;
  formatted: string;
  loading: boolean;
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
    if (!address || !signer) {
      console.log('⚠️ useTokenBalances: No address or signer', { address, signer: !!signer });
      setBalances({
        matic: { symbol: 'MATIC', balance: '0', formatted: '0.00', loading: false },
        jpyc: { symbol: 'JPYC', balance: '0', formatted: '0.00', loading: false },
        nht: { symbol: 'NHT', balance: '0', formatted: '0.00', loading: false },
      });
      return;
    }

    const fetchBalances = async () => {
      try {
        console.log('💰 useTokenBalances: Fetching balances for address:', address);

        // 公開RPCプロバイダーを使用（ネットワーク互換性を確保）
        const publicProvider = new ethers.providers.JsonRpcProvider(POLYGON_MAINNET_RPC);

        // MATIC残高
        const maticBalance = await publicProvider.getBalance(address);
        const maticFormatted = parseFloat(ethers.utils.formatEther(maticBalance)).toFixed(4);

        console.log('💰 MATIC Balance:', {
          address,
          balance: maticBalance.toString(),
          formatted: maticFormatted,
        });

        // JPYC残高（メインネット対応）
        let jpycBalance = ethers.BigNumber.from(0);
        let jpycFormatted = '0.00';
        try {
          const jpycContract = new ethers.Contract(JPYC_TOKEN.ADDRESS, ERC20_MIN_ABI, publicProvider);
          const code = await publicProvider.getCode(JPYC_TOKEN.ADDRESS);
          if (code !== '0x') {
            jpycBalance = await jpycContract.balanceOf(address);
            jpycFormatted = parseFloat(ethers.utils.formatUnits(jpycBalance, 18)).toFixed(2);
          }
        } catch (e) {
          console.error('Failed to fetch JPYC balance:', e);
        }

        // NHT残高（公開RPCを使用してネットワーク互換性を確保）
        let nhtBalance = ethers.BigNumber.from(0);
        let nhtFormatted = '0.00';
        try {
          const nhtContract = new ethers.Contract(NHT_TOKEN.ADDRESS, ERC20_MIN_ABI, publicProvider);
          nhtBalance = await nhtContract.balanceOf(address);
          nhtFormatted = parseFloat(ethers.utils.formatUnits(nhtBalance, 18)).toFixed(2);
        } catch (e) {
          console.error('Failed to fetch NHT balance:', e);
        }

        setBalances({
          matic: {
            symbol: 'MATIC',
            balance: maticBalance.toString(),
            formatted: maticFormatted,
            loading: false
          },
          jpyc: {
            symbol: 'JPYC',
            balance: jpycBalance.toString(),
            formatted: jpycFormatted,
            loading: false
          },
          nht: {
            symbol: 'NHT',
            balance: nhtBalance.toString(),
            formatted: nhtFormatted,
            loading: false
          },
        });
      } catch (error) {
        console.error('Failed to fetch token balances:', error);
        setBalances({
          matic: { symbol: 'MATIC', balance: '0', formatted: '0.00', loading: false },
          jpyc: { symbol: 'JPYC', balance: '0', formatted: '0.00', loading: false },
          nht: { symbol: 'NHT', balance: '0', formatted: '0.00', loading: false },
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
