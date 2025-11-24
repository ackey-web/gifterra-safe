// src/config/wagmi.ts
// WalletConnect + Wagmi設定

import { createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

// WalletConnect Project ID (環境変数から取得)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID が設定されていません');
}

// Wagmi設定
export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  connectors: [
    // WalletConnect v2
    walletConnect({
      projectId,
      metadata: {
        name: 'GIFTERRA',
        description: 'Web3ギフトカードプラットフォーム',
        url: 'https://gifterra-safe.vercel.app',
        icons: ['https://gifterra-safe.vercel.app/pwa-512x512.png'],
      },
      showQrModal: true, // モバイルでQRコード表示
    }),
    // Injected provider (デスクトップ用フォールバック)
    injected(),
  ],
  transports: {
    [polygon.id]: http('https://rpc.ankr.com/polygon'),
    [polygonAmoy.id]: http('https://rpc.ankr.com/polygon_amoy'),
  },
});
