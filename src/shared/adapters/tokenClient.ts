// ========================================
// Token Adapter: ERC20操作統一IF
// ========================================

import { ethers } from 'ethers';
import { useWalletClient } from './walletClient';
import { FEATURE_FLAGS } from '../utils/featureFlags';

export interface TokenAdapter {
  getBalance: (tokenAddress: string, userAddress: string) => Promise<string>;
  transfer: (tokenAddress: string, to: string, amount: string) => Promise<string>;
  approve: (tokenAddress: string, spender: string, amount: string) => Promise<string>;
  allowance: (tokenAddress: string, owner: string, spender: string) => Promise<string>;
  getDecimals: (tokenAddress: string) => Promise<number>;
  getSymbol: (tokenAddress: string) => Promise<string>;
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// RPC Provider取得
function getRpcProvider(): ethers.providers.JsonRpcProvider {
  const rpcUrl = import.meta.env.VITE_ALCHEMY_RPC_URL || 'https://polygon-rpc.com';
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

export function useTokenClient(): TokenAdapter {
  const wallet = useWalletClient();

  return {
    // ─────────────────────────────────────
    // 残高取得（読み取り専用）
    // ─────────────────────────────────────
    getBalance: async (tokenAddress: string, userAddress: string) => {
      const provider = getRpcProvider();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      try {
        const balance = await contract.balanceOf(userAddress);

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[TokenClient] Balance:', balance.toString());
        }

        return balance.toString();
      } catch (error) {
        console.error('[TokenClient] getBalance error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // トークン送金
    // ─────────────────────────────────────
    transfer: async (tokenAddress: string, to: string, amount: string) => {
      if (!wallet.isConnected) throw new Error('Wallet not connected');

      try {
        const data = new ethers.utils.Interface(ERC20_ABI).encodeFunctionData('transfer', [
          to,
          amount,
        ]);

        const tx = await wallet.sendTransaction({
          to: tokenAddress,
          data,
        });

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[TokenClient] Transfer TX:', tx);
        }

        return tx;
      } catch (error) {
        console.error('[TokenClient] transfer error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // Approve（承認）
    // ─────────────────────────────────────
    approve: async (tokenAddress: string, spender: string, amount: string) => {
      if (!wallet.isConnected) throw new Error('Wallet not connected');

      try {
        const data = new ethers.utils.Interface(ERC20_ABI).encodeFunctionData('approve', [
          spender,
          amount,
        ]);

        const tx = await wallet.sendTransaction({
          to: tokenAddress,
          data,
        });

        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.log('[TokenClient] Approve TX:', tx);
        }

        return tx;
      } catch (error) {
        console.error('[TokenClient] approve error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // Allowance確認
    // ─────────────────────────────────────
    allowance: async (tokenAddress: string, owner: string, spender: string) => {
      const provider = getRpcProvider();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      try {
        const allowance = await contract.allowance(owner, spender);
        return allowance.toString();
      } catch (error) {
        console.error('[TokenClient] allowance error:', error);
        throw error;
      }
    },

    // ─────────────────────────────────────
    // Decimals取得
    // ─────────────────────────────────────
    getDecimals: async (tokenAddress: string) => {
      const provider = getRpcProvider();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      try {
        const decimals = await contract.decimals();
        return decimals;
      } catch (error) {
        console.error('[TokenClient] getDecimals error:', error);
        return 18; // デフォルト値
      }
    },

    // ─────────────────────────────────────
    // Symbol取得
    // ─────────────────────────────────────
    getSymbol: async (tokenAddress: string) => {
      const provider = getRpcProvider();
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      try {
        const symbol = await contract.symbol();
        return symbol;
      } catch (error) {
        console.error('[TokenClient] getSymbol error:', error);
        return 'TOKEN'; // デフォルト値
      }
    },
  };
}
