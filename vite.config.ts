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
    'process.env': {},
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
    // チャンクサイズ制限を2MBに緩和（Web3ライブラリが大きいため）
    chunkSizeWarningLimit: 2000,
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
        // 大きなライブラリを別チャンクに分割

        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('@thirdweb-dev')) {
              return 'thirdweb';
            }
            if (id.includes('@privy-io/react-auth')) {
              return 'privy';
            }
          }
        }
      }
    }
  }
})
