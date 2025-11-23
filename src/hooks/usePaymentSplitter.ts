// src/hooks/usePaymentSplitter.ts
// PaymentSplitterコントラクトとの連携フック

import { useContract, useContractRead, useContractWrite, useSDK } from '@thirdweb-dev/react';
import { useState } from 'react';
import { ethers } from 'ethers';

// PaymentSplitter ABI（必要な関数のみ）
const PAYMENT_SPLITTER_ABI = [
  // View関数
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'payeeCount', type: 'uint256' },
      { name: 'totalShares_', type: 'uint256' },
      { name: 'nativeBalance', type: 'uint256' },
      { name: 'totalNativeReleased', type: 'uint256' },
      { name: 'isPaused', type: 'bool' },
    ],
  },
  {
    name: 'getERC20Stats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'tokenBalance', type: 'uint256' },
      { name: 'totalTokenReleased', type: 'uint256' },
    ],
  },
  {
    name: 'getReleasableNative',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'releasableAmount', type: 'uint256' }],
  },
  {
    name: 'getReleasableERC20',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: 'releasableAmount', type: 'uint256' }],
  },
  {
    name: 'payee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'shares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'released',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalReleased',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'version',
    type: 'function',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Write関数
  {
    name: 'release',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    name: 'releaseAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'releaseAllERC20',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: 'DonationReceived',
    type: 'event',
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: true, name: 'sku', type: 'bytes32' },
      { indexed: false, name: 'traceId', type: 'bytes32' },
    ],
  },
] as const;

export interface PaymentSplitterStats {
  payeeCount: number;
  totalShares: number;
  nativeBalance: string; // formatted
  totalNativeReleased: string; // formatted
  isPaused: boolean;
}

export interface PayeeInfo {
  address: string;
  shares: number;
  sharePercentage: number;
  releasedNative: string; // formatted
  releasableNative: string; // formatted
}

/**
 * PaymentSplitterの統計情報を取得
 */
export function usePaymentSplitterStats(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { data, isLoading, error } = useContractRead(contract, 'getStats');

  const stats: PaymentSplitterStats | null = data
    ? {
        payeeCount: data.payeeCount.toNumber(),
        totalShares: data.totalShares_.toNumber(),
        nativeBalance: ethers.utils.formatEther(data.nativeBalance),
        totalNativeReleased: ethers.utils.formatEther(data.totalNativeReleased),
        isPaused: data.isPaused,
      }
    : null;

  return { stats, isLoading, error };
}

/**
 * PaymentSplitterのバージョン情報を取得
 */
export function usePaymentSplitterVersion(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { data, isLoading } = useContractRead(contract, 'version');

  return { version: data as string | undefined, isLoading };
}

/**
 * PaymentSplitterの受益者情報を取得
 */
export function usePaymentSplitterPayees(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const [payees, setPayees] = useState<PayeeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadPayees = async () => {
    if (!contract) return;

    setIsLoading(true);
    setError(null);

    try {
      // 総シェア数を取得
      const totalShares = await contract.call('totalShares');

      // 受益者を順番に取得（最大100人まで試行）
      const payeeList: PayeeInfo[] = [];
      for (let i = 0; i < 100; i++) {
        try {
          const payeeAddress = await contract.call('payee', [i]);
          const shares = await contract.call('shares', [payeeAddress]);
          const released = await contract.call('released', [payeeAddress]);
          const releasable = await contract.call('getReleasableNative', [payeeAddress]);

          payeeList.push({
            address: payeeAddress,
            shares: shares.toNumber(),
            sharePercentage: (shares.toNumber() / totalShares.toNumber()) * 100,
            releasedNative: ethers.utils.formatEther(released),
            releasableNative: ethers.utils.formatEther(releasable),
          });
        } catch (err) {
          // インデックスが存在しない場合はループ終了
          break;
        }
      }

      setPayees(payeeList);
    } catch (err) {
      console.error('Failed to load payees:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { payees, isLoading, error, loadPayees };
}

/**
 * PaymentSplitterのネイティブ通貨を全員に分配
 */
export function useReleaseAll(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { mutateAsync: releaseAll, isLoading } = useContractWrite(contract, 'releaseAll');

  const execute = async () => {
    try {
      const result = await releaseAll({ args: [] });
      return result;
    } catch (error) {
      console.error('Failed to release all:', error);
      throw error;
    }
  };

  return { releaseAll: execute, isLoading };
}

/**
 * PaymentSplitterの個別分配（ネイティブ通貨）
 */
export function useRelease(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { mutateAsync: release, isLoading } = useContractWrite(contract, 'release');

  const execute = async (payeeAddress: string) => {
    try {
      const result = await release({ args: [payeeAddress] });
      return result;
    } catch (error) {
      console.error('Failed to release:', error);
      throw error;
    }
  };

  return { release: execute, isLoading };
}

/**
 * PaymentSplitterのERC20トークンを全員に分配
 */
export function useReleaseAllERC20(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { mutateAsync: releaseAllERC20, isLoading } = useContractWrite(contract, 'releaseAllERC20');

  const execute = async (tokenAddress: string) => {
    try {
      const result = await releaseAllERC20({ args: [tokenAddress] });
      return result;
    } catch (error) {
      console.error('Failed to release all ERC20:', error);
      throw error;
    }
  };

  return { releaseAllERC20: execute, isLoading };
}

/**
 * PaymentSplitterを一時停止
 */
export function usePausePaymentSplitter(contractAddress?: string) {
  const { contract } = useContract(contractAddress, PAYMENT_SPLITTER_ABI);
  const { mutateAsync: pause, isLoading: isPausing } = useContractWrite(contract, 'pause');
  const { mutateAsync: unpause, isLoading: isUnpausing } = useContractWrite(contract, 'unpause');

  const executePause = async () => {
    try {
      const result = await pause({ args: [] });
      return result;
    } catch (error) {
      console.error('Failed to pause:', error);
      throw error;
    }
  };

  const executeUnpause = async () => {
    try {
      const result = await unpause({ args: [] });
      return result;
    } catch (error) {
      console.error('Failed to unpause:', error);
      throw error;
    }
  };

  return {
    pause: executePause,
    unpause: executeUnpause,
    isPausing,
    isUnpausing,
  };
}

/**
 * PaymentSplitterをデプロイ
 */
export function useDeployPaymentSplitter() {
  const sdk = useSDK();
  const [isDeploying, setIsDeploying] = useState(false);

  const deploy = async (payees: string[], shares: number[]) => {
    if (!sdk) {
      throw new Error('SDK not initialized');
    }

    if (payees.length === 0 || shares.length === 0) {
      throw new Error('Payees and shares cannot be empty');
    }

    if (payees.length !== shares.length) {
      throw new Error('Payees and shares length mismatch');
    }

    setIsDeploying(true);

    try {
      console.log('🚀 Deploying PaymentSplitter...', { payees, shares });

      // GifterraPaySplitter のバイトコードとABI
      // 注: 実際のデプロイには compiled contract が必要
      const contractAddress = await sdk.deployer.deployContractFromUri(
        'ipfs://QmPaymentSplitterBytecode', // TODO: 実際のIPFSハッシュに置き換え
        [payees, shares],
        {
          contractName: 'GifterraPaySplitter',
        }
      );

      console.log('✅ PaymentSplitter deployed:', contractAddress);
      return contractAddress;
    } catch (error) {
      console.error('❌ Failed to deploy PaymentSplitter:', error);
      throw error;
    } finally {
      setIsDeploying(false);
    }
  };

  return { deploy, isDeploying };
}
