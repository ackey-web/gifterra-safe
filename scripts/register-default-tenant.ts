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
  console.log('🚀 デフォルトテナント登録を開始します...\n');

  try {
    // 1. 既存の申請をチェック
    console.log('1️⃣ 既存の申請をチェック中...');
    const { data: existingApplication, error: checkError } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('❌ チェックエラー:', checkError);
      throw checkError;
    }

    if (existingApplication) {
      console.log('📌 既存の申請が見つかりました:');
      console.log('   - ステータス:', existingApplication.status);
      console.log('   - テナントID:', existingApplication.tenant_id);
      console.log('   - プラン:', existingApplication.rank_plan);

      // 承認済みでない場合は更新（tenant_idは除外）
      if (existingApplication.status !== 'approved') {
        console.log('\n2️⃣ 申請を承認済みに更新中...');
        const { error: updateError } = await supabase
          .from('tenant_applications')
          .update({
            status: 'approved',
            rank_plan: RANK_PLAN,
            approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
            approved_at: new Date().toISOString(),
            // tenant_idは手動で設定（Supabaseダッシュボードから）
          })
          .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase());

        if (updateError) {
          console.error('❌ 更新エラー:', updateError);
          throw updateError;
        }
        console.log('✅ 申請を承認済みに更新しました');
        console.log('⚠️  注意: tenant_idはSupabaseダッシュボードから手動で設定してください（値: 1）');
      } else {
        console.log('✅ すでに承認済みです');
      }
    } else {
      // 新規申請を作成（まずpendingで作成）
      console.log('\n2️⃣ 新規申請を作成中...');
      const { data: newApplication, error: insertError } = await supabase
        .from('tenant_applications')
        .insert({
          applicant_address: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          tenant_name: TENANT_NAME,
          description: 'GIFTERRA公式デフォルトテナント',
          rank_plan: RANK_PLAN,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ 挿入エラー:', insertError);
        throw insertError;
      }
      console.log('✅ 新規申請を作成しました');

      // 申請を承認
      console.log('\n3️⃣ 申請を承認中...');
      console.log('   - 申請ID:', newApplication.id);
      console.log('   - 申請アドレス:', newApplication.applicant_address);

      const { error: approveError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'approved',
          approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          approved_at: new Date().toISOString(),
          // tenant_idは手動で設定（Supabaseダッシュボードから）
        })
        .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase());

      if (approveError) {
        console.error('❌ 承認エラー:', approveError);
        throw approveError;
      }
      console.log('✅ 申請を承認しました');
      console.log('⚠️  注意: tenant_idはSupabaseダッシュボードから手動で設定してください（値: 1）');
    }

    // 4. ランクプラン情報を表示（tenant_idがnullの場合はスキップ）
    console.log('\n4️⃣ ランクプラン確認...');
    console.log('⚠️  tenant_rank_plansテーブルの設定は、Supabaseダッシュボードから手動で行ってください');
    console.log('   手順:');
    console.log('   1. tenant_applicationsテーブルで該当レコードのtenant_idを1に設定');
    console.log('   2. tenant_rank_plansテーブルに以下のレコードを追加:');
    console.log('      - tenant_id: 1');
    console.log('      - rank_plan: STUDIO_PRO_MAX');
    console.log('      - is_active: true');
    console.log('      - subscription_start_date: (現在日時)');
    console.log('');

    // 5. 最終確認
    console.log('\n5️⃣ 最終確認...');
    const { data: finalApplication } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase())
      .single();

    console.log('\n✅ テナント申請の承認が完了しました！');
    console.log('\n📊 最終状態:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('テナント申請:');
    console.log('  アドレス:', finalApplication?.applicant_address);
    console.log('  名前:', finalApplication?.tenant_name);
    console.log('  ステータス:', finalApplication?.status);
    console.log('  テナントID:', finalApplication?.tenant_id || '(未設定 - 手動で1に設定してください)');
    console.log('  プラン:', finalApplication?.rank_plan);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 次のステップ:');
    console.log('   Supabaseダッシュボードで以下を設定してください:');
    console.log('   1. tenant_applicationsテーブル: tenant_id を 1 に設定');
    console.log('   2. tenant_rank_plansテーブル: 上記の手順に従ってレコード追加');
    console.log('\n🎉 設定完了後、Reward UIで STUDIO_PRO_MAX プランが適用されます！');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

registerDefaultTenant();
