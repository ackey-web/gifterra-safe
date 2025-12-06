// src/hooks/useEnsurePolygonNetwork.ts
// MetaMaskなど外部ウォレットを自動的にPolygon Mainnetに切り替えるカスタムフック

import { useEffect, useRef, useState } from 'react';

const POLYGON_CHAIN_ID = '0x89'; // 137 in hex
const POLYGON_CHAIN_ID_DECIMAL = 137;

interface PolygonChainParams {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

const POLYGON_MAINNET_PARAMS: PolygonChainParams = {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: [
    'https://polygon-mainnet.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78',
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.network',
  ],
  blockExplorerUrls: ['https://polygonscan.com'],
};

/**
 * MetaMaskなど外部ウォレットをPolygon Mainnetに自動切り替えするフック
 *
 * @param enabled - ネットワーク切り替えを有効にするかどうか
 * @param currentChainId - 現在のチェーンID
 * @returns isSwitching - ネットワーク切り替え中かどうか
 */
export function useEnsurePolygonNetwork(
  enabled: boolean = true,
  currentChainId?: number
): { isSwitching: boolean } {
  const [isSwitching, setIsSwitching] = useState(false);
  const switchAttemptedRef = useRef(false);
  const lastChainIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // 無効化されている場合は何もしない
    if (!enabled) return;

    // window.ethereumが存在しない場合は何もしない（PrivyウォレットやモバイルWalletConnect）
    if (typeof window.ethereum === 'undefined') return;

    // 現在のチェーンIDが未定義の場合は待機
    if (currentChainId === undefined) return;

    // 既にPolygon Mainnetに接続している場合は何もしない
    if (currentChainId === POLYGON_CHAIN_ID_DECIMAL) {
      switchAttemptedRef.current = false;
      lastChainIdRef.current = currentChainId;
      return;
    }

    // チェーンIDが変わった場合、切り替えフラグをリセット
    if (lastChainIdRef.current !== currentChainId) {
      switchAttemptedRef.current = false;
      lastChainIdRef.current = currentChainId;
    }

    // 既に切り替えを試みた場合はスキップ（無限ループ防止）
    if (switchAttemptedRef.current) return;

    // Polygon以外のネットワークに接続している場合、自動切り替えを試みる
    const switchToPolygon = async () => {
      setIsSwitching(true);
      switchAttemptedRef.current = true;

      try {
        console.log(`🔄 Switching from Chain ID ${currentChainId} to Polygon Mainnet...`);

        // まず既存のPolygonネットワークへの切り替えを試みる
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: POLYGON_CHAIN_ID }],
        });

        console.log('✅ Successfully switched to Polygon Mainnet');
      } catch (switchError: any) {
        // エラーコード 4902: チェーンがMetaMaskに追加されていない
        if (switchError.code === 4902) {
          try {
            console.log('⚠️ Polygon not found in wallet, attempting to add...');

            // Polygonネットワークを追加
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [POLYGON_MAINNET_PARAMS],
            });

            console.log('✅ Polygon Mainnet added and switched successfully');
          } catch (addError) {
            console.error('❌ Failed to add Polygon network:', addError);
            // ユーザーがリクエストを拒否した場合などはエラーを表示しない
            if ((addError as any).code === 4001) {
              console.log('ℹ️ User rejected network switch request');
            }
          }
        } else if (switchError.code === 4001) {
          // ユーザーがリクエストを拒否
          console.log('ℹ️ User rejected network switch request');
        } else {
          console.error('❌ Failed to switch network:', switchError);
        }
      } finally {
        setIsSwitching(false);
      }
    };

    // ネットワーク切り替えを実行
    switchToPolygon();
  }, [enabled, currentChainId]);

  return { isSwitching };
}
