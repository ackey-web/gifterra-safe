// Supabase user_profiles テーブル確認スクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://druscvcjjhzxnerssanv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydXNjdmNqamh6eG5lcnNzYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODUzMjUsImV4cCI6MjA3NjQ2MTMyNX0.o_lUZnajb0HrXJcL6h97jUeYxvqk0h-SAjyoim2WiKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  console.log('🔍 Supabase user_profiles テーブルを確認中...\n');

  try {
    // 1. テーブルの存在確認 & 全件数取得
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ テーブルアクセスエラー:', countError);
      return;
    }

    console.log(`✅ user_profiles テーブル: ${count}件のプロフィール\n`);

    // 2. 最新5件のプロフィールを取得
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wallet_address, display_name, avatar_url, bio, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ プロフィールデータが存在しません');
      return;
    }

    console.log('📋 最新5件のプロフィール:\n');
    data.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.display_name || '(名前未設定)'}`);
      console.log(`   Wallet: ${profile.wallet_address}`);
      console.log(`   Avatar: ${profile.avatar_url ? '✅ あり' : '❌ なし'}`);
      console.log(`   Bio: ${profile.bio || '(未設定)'}`);
      console.log(`   Created: ${profile.created_at}\n`);
    });

    // 3. RLS (Row Level Security) ポリシーの確認
    console.log('🔐 RLSポリシー確認中...');
    const testAddress = '0x0000000000000000000000000000000000000001';
    const { data: rlsTest, error: rlsError } = await supabase
      .from('user_profiles')
      .select('wallet_address')
      .eq('wallet_address', testAddress)
      .maybeSingle();

    if (rlsError) {
      console.log('⚠️ RLSエラー (これは正常な場合もあります):', rlsError.message);
    } else {
      console.log('✅ RLSポリシー: 読み取りアクセス可能');
    }

  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
  }
}

checkProfiles();
