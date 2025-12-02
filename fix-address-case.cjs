const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function fixAddressCase() {
  console.log('=== アドレスの大文字小文字を修正 ===\n');

  const targetAddress = '0x66F1274aD5d042b7571C2EfA943370dbcd3459aB';
  const targetId = '951f5ee7-feea-438d-b629-07dcc024fe0d';
  const lowerAddress = targetAddress.toLowerCase();

  console.log(`対象テナントID: ${targetId}`);
  console.log(`現在のアドレス: ${targetAddress}`);
  console.log(`修正後のアドレス: ${lowerAddress}\n`);

  // アドレスを小文字に変更
  const { data, error } = await supabase
    .from('tenant_applications')
    .update({
      applicant_address: lowerAddress
    })
    .eq('id', targetId)
    .select();

  if (error) {
    console.error('❌ 更新エラー:', error);
  } else {
    console.log('✅ 更新成功');
    console.log('更新後:', data);
  }

  // 確認
  console.log('\n=== 確認 ===');
  const { data: check } = await supabase
    .from('tenant_applications')
    .select('id, tenant_name, applicant_address, status')
    .eq('id', targetId)
    .single();

  if (check) {
    console.log(`テナント名: ${check.tenant_name}`);
    console.log(`アドレス: ${check.applicant_address}`);
    console.log(`ステータス: ${check.status}`);
  }
}

fixAddressCase();
