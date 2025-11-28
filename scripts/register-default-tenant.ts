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

const DEFAULT_TENANT_ADDRESS = '0x0174477A1FCEb9dE25289Cd1CA48b6998C9cD7FC';
const TENANT_NAME = 'GIFTERRA Official';
const RANK_PLAN = 'STUDIO_PRO_MAX';
const TENANT_ID = 1; // デフォルトテナントのID (INTEGER)

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

      // 承認済みでない場合は更新
      if (existingApplication.status !== 'approved') {
        console.log('\n2️⃣ 申請を承認済みに更新中...');
        const { error: updateError } = await supabase
          .from('tenant_applications')
          .update({
            status: 'approved',
            tenant_id: TENANT_ID,
            rank_plan: RANK_PLAN,
            approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
            approved_at: new Date().toISOString(),
          })
          .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase());

        if (updateError) {
          console.error('❌ 更新エラー:', updateError);
          throw updateError;
        }
        console.log('✅ 申請を承認済みに更新しました');
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
      const { error: approveError } = await supabase
        .from('tenant_applications')
        .update({
          status: 'approved',
          tenant_id: TENANT_ID,
          approved_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          approved_at: new Date().toISOString(),
        })
        .eq('id', newApplication.id);

      if (approveError) {
        console.error('❌ 承認エラー:', approveError);
        throw approveError;
      }
      console.log('✅ 申請を承認しました');
    }

    // 4. ランクプランをチェック
    console.log('\n4️⃣ ランクプランをチェック中...');
    const { data: existingPlan, error: planCheckError } = await supabase
      .from('tenant_rank_plans')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (planCheckError) {
      console.error('❌ プランチェックエラー:', planCheckError);
      throw planCheckError;
    }

    if (existingPlan) {
      console.log('📌 既存のプランが見つかりました:');
      console.log('   - プラン:', existingPlan.rank_plan);
      console.log('   - アクティブ:', existingPlan.is_active);

      // プランが異なる、または無効な場合は更新
      if (existingPlan.rank_plan !== RANK_PLAN || !existingPlan.is_active) {
        console.log('\n5️⃣ ランクプランを更新中...');
        const { error: updatePlanError } = await supabase
          .from('tenant_rank_plans')
          .update({
            rank_plan: RANK_PLAN,
            is_active: true,
            updated_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
          })
          .eq('tenant_id', TENANT_ID);

        if (updatePlanError) {
          console.error('❌ プラン更新エラー:', updatePlanError);
          throw updatePlanError;
        }
        console.log('✅ ランクプランを更新しました');
      } else {
        console.log('✅ プランはすでに正しく設定されています');
      }
    } else {
      // 新規プランを作成
      console.log('\n5️⃣ 新規ランクプランを作成中...');
      const { error: insertPlanError } = await supabase
        .from('tenant_rank_plans')
        .insert({
          tenant_id: TENANT_ID,
          rank_plan: RANK_PLAN,
          is_active: true,
          subscription_start_date: new Date().toISOString(),
          updated_by: DEFAULT_TENANT_ADDRESS.toLowerCase(),
        });

      if (insertPlanError) {
        console.error('❌ プラン挿入エラー:', insertPlanError);
        throw insertPlanError;
      }
      console.log('✅ 新規ランクプランを作成しました');
    }

    // 6. 最終確認
    console.log('\n6️⃣ 最終確認...');
    const { data: finalApplication } = await supabase
      .from('tenant_applications')
      .select('*')
      .eq('applicant_address', DEFAULT_TENANT_ADDRESS.toLowerCase())
      .single();

    const { data: finalPlan } = await supabase
      .from('tenant_rank_plans')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .single();

    console.log('\n✅ 登録完了！');
    console.log('\n📊 最終状態:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('テナント申請:');
    console.log('  アドレス:', finalApplication?.applicant_address);
    console.log('  名前:', finalApplication?.tenant_name);
    console.log('  ステータス:', finalApplication?.status);
    console.log('  テナントID:', finalApplication?.tenant_id);
    console.log('\nランクプラン:');
    console.log('  プラン:', finalPlan?.rank_plan);
    console.log('  アクティブ:', finalPlan?.is_active);
    console.log('  開始日:', finalPlan?.subscription_start_date);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Reward UIで STUDIO_PRO_MAX プランが適用されます！');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

registerDefaultTenant();
