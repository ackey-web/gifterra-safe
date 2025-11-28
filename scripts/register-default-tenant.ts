// scripts/register-default-tenant.ts
// デフォルトテナント（0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC）を登録するスクリプト

import { createClient } from '@supabase/supabase-js';

// 環境変数から取得
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_TENANT_ADDRESS = '0xfcea8435dcbba7f3b1da01e8ea3f4af234a20bcb';
const TENANT_NAME = 'GIFTERRA Official';
const RANK_PLAN = 'STUDIO_PRO_MAX';

async function registerDefaultTenant() {
  try {
    const { data: existingApplication, error: checkError } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase())
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingApplication) {
      if (existingApplication.status !== 'approved') {
        const { error: updateError } = await supabase
          .from('tenant_applications')
          .update({
            status: 'approved',
            rank_plan: RANK_PLAN,
            approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
            approved_at: new Date().toISOString(),
          })
          .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase());

        if (updateError) throw updateError;
        console.log('✅ テナント申請を承認しました');
      } else {
        console.log('✅ テナントは既に承認済みです');
      }
    } else {
      const { error: insertError } = await supabase
        .from('tenant_applications')
        .insert({
          applicant_address: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          tenant_name: TENANT_NAME,
          description: 'GIFTERRA公式デフォルトテナント',
          rank_plan: RANK_PLAN,
          status: 'pending',
        });

      if (insertError) throw insertError;

      const { error: approveError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'approved',
          approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          approved_at: new Date().toISOString(),
        })
        .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase());

      if (approveError) throw approveError;
      console.log('✅ テナント申請を作成・承認しました');
    }

    const { data: finalApplication } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase())
      .single();

    console.log('\n📊 テナント情報:');
    console.log(`  アドレス: ${finalApplication?.applicant_address}`);
    console.log(`  名前: ${finalApplication?.tenant_name}`);
    console.log(`  ステータス: ${finalApplication?.status}`);
    console.log(`  tenant_id: ${finalApplication?.tenant_id || 'NULL'}`);
    console.log(`  プラン: ${finalApplication?.rank_plan}\n`);

  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

registerDefaultTenant();
