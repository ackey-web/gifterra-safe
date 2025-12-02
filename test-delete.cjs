const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function testDelete() {
  console.log('=== 削除テスト ===\n');

  // 古いGIFTERRA Official (id: 40e1d25a-e892-4925-b5ed-706f2c9e2aa1)を削除してみる
  const testId = '40e1d25a-e892-4925-b5ed-706f2c9e2aa1';

  console.log(`削除対象: id=${testId}\n`);

  const { data, error } = await supabase
    .from('tenant_applications')
    .delete()
    .eq('id', testId)
    .select(); // 削除されたレコードを返す

  if (error) {
    console.error('❌ 削除エラー:', error);
    console.error('詳細:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ 削除成功');
    console.log('削除されたレコード:', data);
  }

  // 確認
  console.log('\n=== 削除後の確認 ===\n');
  const { data: remaining } = await supabase
    .from('tenant_applications')
    .select('id, tenant_name, status')
    .order('created_at', { ascending: false });

  console.log('残りのレコード:', remaining?.length);
  remaining?.forEach((r, i) => {
    console.log(`${i+1}. ${r.tenant_name} (id: ${r.id})`);
  });
}

testDelete();
