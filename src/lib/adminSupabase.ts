// src/lib/adminSupabase.ts
// 開発環境専用: クライアントサイドでService Roleを使用（本番環境では使用禁止）

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceRole = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ⚠️ 警告: Service Role Key をクライアントサイドで使用するのはセキュリティリスク
// 開発環境でのみ使用し、本番環境では必ずサーバーサイドAPI経由に変更すること

export const adminSupabase = supabaseServiceRole
  ? createClient(supabaseUrl || '', supabaseServiceRole)
  : null;

// 開発環境チェック
export const isDevelopment = import.meta.env.DEV;

if (isDevelopment && !supabaseServiceRole) {
  console.warn('⚠️ VITE_SUPABASE_SERVICE_ROLE_KEY が設定されていません。管理機能が制限されます。');
}

if (!isDevelopment && supabaseServiceRole) {
  console.error('🚨 本番環境でService Role Keyがクライアントに露出しています！セキュリティリスク！');
}
