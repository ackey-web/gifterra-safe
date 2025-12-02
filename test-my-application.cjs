const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function testMyApplication() {
  console.log('=== useMyTenantApplication動作テスト ===\n');

  const address = '0x66F1274aD5d042b7571C2EfA943370dbcd3459aB';
  console.log(`テストアドレス: ${address}\n`);

  // 修正後のロジックをシミュレート
  console.log('ステップ1: 承認済み申請を探す...');
  const { data: approvedData, error: approvedError } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('applicant_address', address.toLowerCase())
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (approvedError) {
    console.error('エラー:', approvedError);
    return;
  }

  if (approvedData && approvedData.length > 0) {
    console.log('✅ 承認済み申請が見つかりました:');
    console.log(`   テナント名: ${approvedData[0].tenant_name}`);
    console.log(`   ID: ${approvedData[0].id}`);
    console.log(`   Status: ${approvedData[0].status}`);
    console.log(`   Tenant ID: ${approvedData[0].tenant_id}`);
    console.log('\nこの申請がuseMyTenantApplicationで返されます');
    return;
  }

  console.log('承認済み申請が見つかりません');
  console.log('\nステップ2: pending申請を探す...');

  const { data: pendingData, error: pendingError } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('applicant_address', address.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (pendingError) {
    console.error('エラー:', pendingError);
    return;
  }

  if (pendingData && pendingData.length > 0) {
    console.log('✅ pending申請が見つかりました:');
    console.log(`   テナント名: ${pendingData[0].tenant_name}`);
    console.log(`   ID: ${pendingData[0].id}`);
    console.log(`   Status: ${pendingData[0].status}`);
  } else {
    console.log('⚠️ pending申請も見つかりません');
    console.log('nullが返されます');
  }
}

testMyApplication();
