const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function fixDuplicatesFinal() {
  console.log('=== テナント重複修正（最終） ===\n');

  // 現在の状態を確認
  const { data: current } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, status, created_at, applicant_address')
    .order('created_at', { ascending: true });

  console.log('現在のテナント一覧:');
  current.forEach((t, i) => {
    console.log(`${i+1}. ${t.tenant_name}`);
    console.log(`   ID: ${t.id}`);
    console.log(`   tenant_id: ${t.tenant_id || 'NULL'}`);
    console.log(`   Created: ${t.created_at}`);
    console.log(`   Applicant: ${t.applicant_address}`);
    console.log('');
  });

  // 削除対象を決定（古い方を削除）
  const toDelete = [
    '231eaf9f-e4d7-4ffb-ab1c-75e3b52934a9', // ELEVEN BASS LAB. (2025-11-27作成) - 古い方
    '40e1d25a-e892-4925-b5ed-706f2c9e2aa1', // GIFTERRA Official (2025-11-28T18:49作成) - 古い方
  ];

  console.log('削除対象:');
  toDelete.forEach(id => {
    const tenant = current.find(t => t.id === id);
    if (tenant) {
      console.log(`  - ${tenant.tenant_name} (ID: ${id}, Created: ${tenant.created_at})`);
    }
  });

  console.log('\n削除を実行中...\n');

  for (const id of toDelete) {
    const { error } = await supabase
      .from('tenant_applications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`❌ 削除失敗 (${id}):`, error);
    } else {
      console.log(`✅ 削除成功: ${id}`);
    }
  }

  // 確認
  console.log('\n=== 削除後の確認 ===');
  const { data: after } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, status, created_at')
    .order('created_at', { ascending: true });

  console.log('残りのテナント:', after.length);
  after.forEach(t => {
    console.log(`  - ${t.tenant_name} (tenant_id: ${t.tenant_id || 'NULL'}, Created: ${t.created_at})`);
  });

  // 重複チェック
  const names = {};
  after.forEach(t => {
    if (!names[t.tenant_name]) names[t.tenant_name] = [];
    names[t.tenant_name].push(t);
  });

  const duplicates = Object.entries(names).filter(([_, tenants]) => tenants.length > 1);
  if (duplicates.length === 0) {
    console.log('\n✅ 重複なし - 修正完了！');
  } else {
    console.log('\n⚠️ まだ重複が残っています:');
    duplicates.forEach(([name, tenants]) => {
      console.log(`  ${name}: ${tenants.length}件`);
      tenants.forEach(t => console.log(`    - ID: ${t.id}, tenant_id: ${t.tenant_id}, Created: ${t.created_at}`));
    });
  }
}

fixDuplicatesFinal();
