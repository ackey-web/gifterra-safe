const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function checkTableStructure() {
  console.log('=== tenant_applications テーブル構造確認 ===\n');

  const { data, error } = await supabase
    .from('tenant_applications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('テーブルのカラム:');
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof data[0][key]} (${data[0][key] !== null ? data[0][key] : 'NULL'})`);
    });
  }

  // 全レコードを取得して主キー確認
  console.log('\n=== 全レコードの id と tenant_id ===\n');
  const { data: allRecords } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, status')
    .order('created_at', { ascending: false });

  if (allRecords) {
    allRecords.forEach((record, i) => {
      console.log(`${i+1}. id: ${record.id}`);
      console.log(`   tenant_id: ${record.tenant_id || 'NULL'}`);
      console.log(`   tenant_name: ${record.tenant_name}`);
      console.log(`   status: ${record.status}`);
      console.log('');
    });
  }
}

checkTableStructure();
