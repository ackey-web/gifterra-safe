import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(() => {
  // Vercel環境ではprocess.envから直接取得、ローカルでは.envファイルから読み込む
  const env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
    VITE_POLYGONSCAN_API_KEY: process.env.VITE_POLYGONSCAN_API_KEY || '',
  }

  // ローカル開発用: .envファイルが存在する場合は読み込む
  const envFiles = ['.env.local', '.env']
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim().replace(/^["']|["']$/g, '')
          if (key.startsWith('VITE_') && !env[key as keyof typeof env]) {
            env[key as keyof typeof env] = value
          }
        }
      })
    }
  }

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
    'import.meta.env.VITE_POLYGONSCAN_API_KEY': JSON.stringify(env.VITE_POLYGONSCAN_API_KEY),
  },
  optimizeDeps: {
    include: ['@privy-io/react-auth'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  server: {
    watch: {
      ignored: [
        '**/*.log',
        '**/build-output.log',
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/ios/**',
        '**/android/**',
        '**/tsconfig.app.json',
        '**/tsconfig.node.json',
        '**/tsconfig.json',
      ],
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
    // モバイルアプリ用: minify有効化（バンドルサイズ削減）
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // デバッグ用に一時的に有効化
        drop_debugger: true,
      },
    },
    // CSS圧縮を有効化
    cssMinify: true,
    // アセット最適化
    assetsInlineLimit: 4096, // 4KB以下の画像はBase64インライン化
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
        // Reactのみ分離、Web3は循環依存回避のため一緒にバンドル
        manualChunks(id) {
          // Reactとその依存関係のみ分離
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
          }
          // Web3/Privy/その他のライブラリは全てindex.jsに含める（循環依存回避）
        },
        // ファイル名にハッシュを追加（効率的なキャッシュ）
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      }
    }
  },
  envPrefix: 'VITE_',
}
})
