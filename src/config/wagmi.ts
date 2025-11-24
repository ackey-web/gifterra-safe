// src/config/wagmi.ts
// WalletConnect + Wagmi設定

import { createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

// WalletConnect Project ID (環境変数から取得)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID が設定されていません - WalletConnectは無効化されます');
}

// コネクターリストを構築（Project IDが有効な場合のみWalletConnectを追加）
const connectors = [];

// WalletConnect v2 (Project IDが有効な場合のみ)
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
        showQrModal: true, // モバイルでQRコード表示
      })
    );
    console.log('✅ WalletConnect設定完了 - Project ID:', projectId);
  } catch (error) {
    console.error('❌ WalletConnect初期化エラー:', error);
  }
}

// Injected provider (デスクトップ用フォールバック)
connectors.push(injected());

// Wagmi設定
export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  connectors,
  transports: {
    [polygon.id]: http('https://rpc.ankr.com/polygon'),
    [polygonAmoy.id]: http('https://rpc.ankr.com/polygon_amoy'),
  },
});
