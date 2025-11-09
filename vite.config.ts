import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// 環境変数を直接読み込む関数
function loadEnvDirect() {
  const envFiles = ['.env.local', '.env']
  const env: Record<string, string> = {}

  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim().replace(/^["']|["']$/g, '')
          if (key.startsWith('VITE_') && !env[key]) {
            env[key] = value
          }
        }
      })
    }
  }

  return env
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数を直接ファイルから読み込む
  const env = loadEnvDirect()

  return {
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
    dedupe: ['@privy-io/react-auth'],
  },
  define: {
    global: 'globalThis',
    // 環境変数を明示的に定義（ビルド時に値が埋め込まれる）
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
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
      // Privy Google OAuth iframeに必要な COOP 設定
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
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
  },
  envPrefix: 'VITE_',
}
})
