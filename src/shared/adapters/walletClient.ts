// ========================================
// Wallet Adapter: Privy + ThirdWeb統一IF
// ========================================

import { usePrivy } from '@privy-io/react-auth';
import { useAddress, useSDK } from '@thirdweb-dev/react';
import { FEATURE_FLAGS } from '../utils/featureFlags';

export interface WalletAdapter {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (tx: TransactionRequest) => Promise<string>;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
}

// ─────────────────────────────────────
// Privy実装（MVP用）
// ─────────────────────────────────────
export function usePrivyWalletAdapter(): WalletAdapter {
  const { user, authenticated, login, logout, sendTransaction } = usePrivy();
  const wallet = user?.wallet;

  return {
    address: wallet?.address || null,
    isConnected: authenticated && !!wallet,
    chainId: wallet?.chainId ? parseInt(wallet.chainId) : null,

    connect: async () => {
      if (!authenticated) await login();
    },

    disconnect: async () => {
      await logout();
    },

    switchChain: async (chainId: number) => {
      if (!wallet) throw new Error('Wallet not connected');
      await wallet.switchChain(chainId);
    },

    signMessage: async (message: string) => {
      if (!wallet) throw new Error('Wallet not connected');
      return await wallet.signMessage(message);
    },

    sendTransaction: async (tx: TransactionRequest) => {
      if (!wallet) throw new Error('Wallet not connected');
      const txHash = await sendTransaction(tx);
      return txHash;
    },
  };
}

// ─────────────────────────────────────
// ThirdWeb実装（Legacy用）
// ─────────────────────────────────────
export function useThirdwebWalletAdapter(): WalletAdapter {
  const address = useAddress();
  const sdk = useSDK();

  return {
    address: address || null,
    isConnected: !!address,
    chainId: sdk?.getChainId() || null,

    connect: async () => {
      // ThirdWebは自動接続（autoConnect=true）
      // 手動接続は不要
      console.log('[ThirdWeb] Auto-connect enabled');
    },

    disconnect: async () => {
      if (sdk?.wallet) {
        await sdk.wallet.disconnect();
      }
    },

    switchChain: async (chainId: number) => {
      if (sdk?.wallet) {
        await sdk.wallet.switchChain(chainId);
      }
    },

    signMessage: async (message: string) => {
      if (!sdk) throw new Error('SDK not initialized');
      return await sdk.wallet.sign(message);
    },

    sendTransaction: async (tx: TransactionRequest) => {
      if (!sdk) throw new Error('SDK not initialized');
      const result = await sdk.wallet.sendRawTransaction(tx);
      return result.hash;
    },
  };
}

// ─────────────────────────────────────
// 統一Hook（ENVフラグで自動切替）
// ─────────────────────────────────────
export function useWalletClient(): WalletAdapter {
  const useLegacy = FEATURE_FLAGS.USE_LEGACY_WALLET;

  const privyAdapter = usePrivyWalletAdapter();
  const thirdwebAdapter = useThirdwebWalletAdapter();

  const adapter = useLegacy ? thirdwebAdapter : privyAdapter;

  // デバッグログ
  if (FEATURE_FLAGS.DEBUG_MODE) {
    console.log('[WalletClient] Using:', useLegacy ? 'ThirdWeb' : 'Privy');
    console.log('[WalletClient] Address:', adapter.address);
    console.log('[WalletClient] Connected:', adapter.isConnected);
  }

  return adapter;
}
