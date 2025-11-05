import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
    dedupe: ['@privy-io/react-auth'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@privy-io/react-auth'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  server: {
    watch: {
      ignored: ['**/*.log', '**/build-output.log'],
    },
    headers: {
      // Thirdweb embeddedWallet (Google OAuth) に必要な COOP 設定
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      // API ルーティング: Vercel ローカル開発は3001にプロキシ
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    target: 'es2020',
    // チャンクサイズ制限を10MBに緩和（Web3ライブラリが大きく、分割すると循環依存エラーが発生するため）
    chunkSizeWarningLimit: 10000,
    // モジュールプリロードを無効化（循環依存の初期化エラーを防ぐ）
    modulePreload: false,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      // Rollupの警告を抑制（pnpmのシンボリックリンク構造での誤検知を防ぐ）
      onwarn(warning, warn) {
        // @privy-io/react-auth からの誤検知を無視
        if (warning.code === 'UNRESOLVED_IMPORT') {
          return;
        }
        warn(warning);
      },
      output: {
        // チャンク分割を最小限にして循環依存エラーを回避
        manualChunks: undefined
      }
    }
  }
})
