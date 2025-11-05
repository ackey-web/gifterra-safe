#!/bin/bash

# Vercel環境変数設定スクリプト
# 使用方法: ./setup-vercel-env.sh

echo "📦 Vercelに環境変数を設定します..."

# 必須の環境変数
vercel env add VITE_PRIVY_APP_ID production <<< "cmhe8cmke00ebl50csabagqtf"
vercel env add VITE_THIRDWEB_CLIENT_ID production <<< "3e4c63f9a07ad8ed962ba1691be8fe2b"

# オプションの環境変数
vercel env add VITE_ENABLE_LEGACY_UI production <<< "true"
vercel env add VITE_ENABLE_NEW_HISTORY production <<< "false"
vercel env add VITE_ENABLE_NEW_FLOW production <<< "false"
vercel env add VITE_ENABLE_NEW_VERIFIED production <<< "false"
vercel env add VITE_ENABLE_NEW_R2P production <<< "false"
vercel env add VITE_ENABLE_NEW_REWARDS production <<< "false"
vercel env add VITE_GAS_SPONSORSHIP_PHASE production <<< "1"

# Supabaseは設定済みの場合のみ（プレースホルダーは設定しない）
# vercel env add VITE_SUPABASE_URL production
# vercel env add VITE_SUPABASE_ANON_KEY production

echo "✅ 環境変数の設定が完了しました"
echo "🚀 Vercelで再デプロイを実行してください: vercel --prod"
