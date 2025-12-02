const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function checkRankPlan() {
  console.log('=== ランクプラン確認 ===\n');

  const userAddress = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';

  // テナント申請情報
  console.log('1. テナント申請情報:');
  const { data: app, error: appError } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('applicant_address', userAddress)
    .eq('status', 'approved')
    .single();

  if (appError) {
    console.error('エラー:', appError);
    return;
  }

  console.log(`   テナント名: ${app.tenant_name}`);
  console.log(`   Tenant ID (UUID): ${app.tenant_id}`);
  console.log(`   Rank Plan: ${app.rank_plan}`);
  console.log(`   Status: ${app.status}`);

  // tenant_rank_plansテーブルのすべてのデータ
  console.log('\n2. tenant_rank_plansテーブル:');
  const { data: allPlans, error: plansError } = await supabase
    .from('tenant_rank_plans')
    .select('*');

  if (plansError) {
    console.error('エラー:', plansError);
  } else {
    if (allPlans.length === 0) {
      console.log('   レコードなし');
    } else {
      allPlans.forEach((plan, i) => {
        const idType = typeof plan.tenant_id;
        console.log(`\n   ${i+1}. Tenant ID: ${plan.tenant_id} (型: ${idType})`);
        console.log(`      Rank Plan: ${plan.rank_plan}`);
        console.log(`      Is Active: ${plan.is_active}`);
      });
    }
  }

  // UUIDでランクプランを検索してみる
  console.log(`\n3. UUID (${app.tenant_id}) でランクプラン検索:`);
  const { data: planByUuid, error: uuidError } = await supabase
    .from('tenant_rank_plans')
    .select('*')
    .eq('tenant_id', app.tenant_id)
    .maybeSingle();

  if (uuidError) {
    console.error('   エラー:', uuidError);
  } else if (planByUuid) {
    console.log('   ✅ 見つかりました');
    console.log(`   Rank Plan: ${planByUuid.rank_plan}`);
    console.log(`   Is Active: ${planByUuid.is_active}`);
  } else {
    console.log('   ❌ 見つかりませんでした');
  }
}

checkRankPlan();
