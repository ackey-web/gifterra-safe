// src/config/wagmi.ts
// WalletConnect + Wagmi設定

import { createConfig, http } from 'wagmi';
import type { Config } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

// WalletConnect Project ID (環境変数から取得)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

console.log('🔧 [Wagmi] 初期化開始', {
  hasProjectId: !!projectId,
  projectIdLength: projectId?.length,
  projectIdPreview: projectId ? `${projectId.slice(0, 8)}...` : 'なし',
});

if (!projectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID が設定されていません - WalletConnectは無効化されます');
}

// コネクターリストを構築（Project IDが有効な場合のみWalletConnectを追加）
const connectors: any[] = [];

// WalletConnect v2 は一時的に無効化（core/relayerエラーが多発するため）
// TODO: Project ID設定を確認後に有効化
/*
if (projectId && projectId.length > 0 && !projectId.includes('/')) {
  try {
    connectors.push(
      walletConnect({
        projectId,
        metadata: {
          name: 'GIFTERRA',
          description: 'Web3ギフトカードプラットフォーム',
          url: 'https://gifterra-safe.vercel.app',
          icons: ['https://gifterra-safe.vercel.app/pwa-512x512.png'],
        },
        showQrModal: true,
      })
    );
    console.log('✅ WalletConnect設定完了 - Project ID:', projectId);
  } catch (error) {
    console.error('❌ WalletConnect初期化エラー:', error);
  }
}
*/
console.log('⚠️ [Wagmi] WalletConnectは一時的に無効化されています');

// Injected provider (デスクトップ用フォールバック)
connectors.push(injected());

console.log('🔧 [Wagmi] コネクター構築完了', {
  connectorsCount: connectors.length,
  hasWalletConnect: connectors.length > 1,
});

// Wagmi設定
export const wagmiConfig: Config = createConfig({
  chains: [polygon, polygonAmoy],
  connectors,
  transports: {
    [polygon.id]: http('https://rpc.ankr.com/polygon'),
    [polygonAmoy.id]: http('https://rpc.ankr.com/polygon_amoy'),
  },
});

console.log('✅ [Wagmi] 設定完了');
