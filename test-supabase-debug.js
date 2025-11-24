// Supabase 詳細デバッグスクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://druscvcjjhzxnerssanv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydXNjdmNqamh6eG5lcnNzYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODUzMjUsImV4cCI6MjA3NjQ2MTMyNX0.o_lUZnajb0HrXJcL6h97jUeYxvqk0h-SAjyoim2WiKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSupabase() {
  console.log('🔍 Supabase 詳細デバッグ\n');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseAnonKey.substring(0, 20) + '...\n');

  // 1. 基本的なクエリテスト
  console.log('1️⃣ user_profiles へのアクセステスト...');
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  console.log('データ:', profiles);
  console.log('エラー:', JSON.stringify(profilesError, null, 2));
  console.log('');

  // 2. カウントクエリテスト
  console.log('2️⃣ user_profiles カウントテスト...');
  const { count, error: countError } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  console.log('カウント:', count);
  console.log('エラー:', JSON.stringify(countError, null, 2));
  console.log('');

  // 3. 他のテーブルも確認
  console.log('3️⃣ payment_requests テーブルテスト...');
  const { data: payments, error: paymentsError } = await supabase
    .from('payment_requests')
    .select('*')
    .limit(1);

  console.log('データ:', payments);
  console.log('エラー:', JSON.stringify(paymentsError, null, 2));
  console.log('');

  // 4. user_login_history テーブル確認
  console.log('4️⃣ user_login_history テーブルテスト...');
  const { data: logins, error: loginsError } = await supabase
    .from('user_login_history')
    .select('*')
    .limit(1);

  console.log('データ:', logins);
  console.log('エラー:', JSON.stringify(loginsError, null, 2));
  console.log('');

  // 5. Supabase接続テスト（REST API直接）
  console.log('5️⃣ REST API 直接アクセステスト...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?select=*&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });

    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
  } catch (error) {
    console.error('Fetch エラー:', error);
  }
}

debugSupabase();
