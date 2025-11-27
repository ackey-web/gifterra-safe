// scripts/register-metatron-tenant.cjs
// METATRONオーナーをPRO MAXテナントとしてシステムに登録

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// Supabase設定（環境変数から取得）
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.error('VITE_SUPABASE_KEY:', supabaseKey ? '設定済み' : '未設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// METATRONオーナーアドレス
const METATRON_OWNER = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';

// Gifterraコントラクトアドレス (デフォルトの本番用コントラクト)
const CONTRACT_ADDRESS = process.env.VITE_GIFTERRA_CONTRACT_ADDRESS || '0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC';

async function registerMETATRONTenant() {
  console.log('🚀 METATRONテナント登録開始...');
  console.log('📍 アドレス:', METATRON_OWNER);
  console.log('📦 プラン: STUDIO_PRO_MAX');
  console.log('🏭 Gifterra:', CONTRACT_ADDRESS);
  console.log('');

  try {
    // 既存のテナント申請をチェック
    console.log('🔍 既存の申請を確認中...');
    const { data: existingApp, error: checkError } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', METATRON_OWNER.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('❌ 既存申請の確認エラー:', checkError);
      throw checkError;
    }

    if (existingApp) {
      console.log('⚠️  既存の申請が見つかりました');
      console.log('   - ステータス:', existingApp.status);
      console.log('   - テナント名:', existingApp.tenant_name);
      console.log('   - プラン:', existingApp.rank_plan);

      if (existingApp.status === 'approved') {
        console.log('');
        console.log('✅ すでに承認済みです');
        console.log('📋 テナント詳細:');
        console.log('   - テナント名:', existingApp.tenant_name);
        console.log('   - プラン:', existingApp.rank_plan);
        console.log('   - Gifterra:', existingApp.gifterra_address);
        console.log('');
        console.log('🎉 プロフィールページにTIP-UIが表示されます！');
        console.log('🔗 プロフィールURL: http://localhost:5175/profile/' + METATRON_OWNER);
        return;
      }

      // 既存の申請を更新
      console.log('');
      console.log('🔄 既存申請をSTUDIO_PRO_MAXに更新します...');
      const { data: updated, error: updateError } = await supabase
        .from('tenant_applications')
        .update({
          rank_plan: 'STUDIO_PRO_MAX',
          status: 'approved',
          approved_by: METATRON_OWNER,
          approved_at: new Date().toISOString(),
          tenant_id: randomUUID(),
          gifterra_address: CONTRACT_ADDRESS,
          updated_at: new Date().toISOString(),
        })
        .eq('applicant_address', METATRON_OWNER.toLowerCase())
        .select()
        .single();

      if (updateError) {
        console.error('❌ 更新エラー:', updateError);
        throw updateError;
      }

      console.log('✅ 申請を承認に更新しました');
      console.log('📋 更新内容:', JSON.stringify(updated, null, 2));
      console.log('');
      console.log('🎉 これでプロフィールページにTIP-UIが表示されるようになりました！');
      console.log('🔗 プロフィールURL: http://localhost:5175/profile/' + METATRON_OWNER);
      return;
    }

    // 新規テナント申請を作成
    console.log('📝 新規テナント申請を作成します...');
    const { data: newApp, error: insertError } = await supabase
      .from('tenant_applications')
      .insert({
        applicant_address: METATRON_OWNER.toLowerCase(),
        tenant_name: 'METATRON Official',
        description: 'METATRON公式テナント - GIFTERRA運営チーム',
        rank_plan: 'STUDIO_PRO_MAX',
        custom_token_address: null,
        custom_token_reason: null,
        status: 'approved',
        approved_by: METATRON_OWNER,
        approved_at: new Date().toISOString(),
        tenant_id: randomUUID(),
        gifterra_address: CONTRACT_ADDRESS,
        reward_nft_address: null,
        pay_splitter_address: null,
        flag_nft_address: null,
        random_reward_engine_address: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ 挿入エラー:', insertError);
      throw insertError;
    }

    console.log('');
    console.log('✅ METATRONテナント登録完了！');
    console.log('📋 テナント詳細:', JSON.stringify(newApp, null, 2));
    console.log('');
    console.log('🎉 これでプロフィールページにTIP-UIが表示されるようになりました！');
    console.log('🔗 プロフィールURL: http://localhost:5175/profile/' + METATRON_OWNER);

  } catch (error) {
    console.error('');
    console.error('❌ 登録処理エラー:', error);
    throw error;
  }
}

// 実行
registerMETATRONTenant()
  .then(() => {
    console.log('');
    console.log('✅ 完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ 失敗:', error);
    process.exit(1);
  });
