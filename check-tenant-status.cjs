const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function checkTenantStatus() {
  console.log('=== テナント状態確認 ===\n');

  const userAddress = '0x66F1274aD5d042b7571C2EfA943370dbcd3459aB'; // あなたのアドレス

  console.log(`対象アドレス: ${userAddress}\n`);

  // すべてのテナント申請を確認
  console.log('--- すべてのELEVEN BASS LAB申請 ---');
  const { data: allApps, error: allError } = await supabase
    .from('tenant_applications')
    .select('*')
    .ilike('tenant_name', '%ELEVEN BASS LAB%')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('エラー:', allError);
  } else {
    allApps.forEach((app, i) => {
      console.log(`\n${i+1}. ${app.tenant_name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Applicant: ${app.applicant_address}`);
      console.log(`   Created: ${app.created_at}`);
      console.log(`   Tenant ID: ${app.tenant_id}`);
      if (app.rejection_reason) {
        console.log(`   Rejection: ${app.rejection_reason}`);
      }
    });
  }

  // あなたのアドレスに紐づく申請を確認
  console.log('\n\n--- あなたのアドレスに紐づく申請 ---');
  const { data: myApps, error: myError } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('applicant_address', userAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (myError) {
    console.error('エラー:', myError);
  } else {
    if (myApps.length === 0) {
      console.log('申請が見つかりません');
    } else {
      myApps.forEach((app, i) => {
        console.log(`\n${i+1}. ${app.tenant_name}`);
        console.log(`   ID: ${app.id}`);
        console.log(`   Status: ${app.status}`);
        console.log(`   Created: ${app.created_at}`);
        if (app.rejection_reason) {
          console.log(`   Rejection: ${app.rejection_reason}`);
        }
      });
    }
  }

  // 承認済みテナントのみ確認
  console.log('\n\n--- 承認済みテナント ---');
  const { data: approvedApps, error: approvedError } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (approvedError) {
    console.error('エラー:', approvedError);
  } else {
    approvedApps.forEach((app, i) => {
      const isYours = app.applicant_address.toLowerCase() === userAddress.toLowerCase();
      console.log(`\n${i+1}. ${app.tenant_name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Applicant: ${app.applicant_address}`);
      console.log(`   あなたのアドレスと一致: ${isYours ? 'はい' : 'いいえ'}`);
    });
  }
}

checkTenantStatus();
