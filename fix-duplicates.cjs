const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function fixDuplicates() {
  console.log('=== テナント重複修正 ===\n');

  // 削除対象:
  // 1. ELEVEN BASS LAB. - 古い方 (2025-11-27作成)
  // 2. GIFTERRA Official - ID=NULLの方 (2025-11-28作成)

  const toDelete = [
    { id: 'fdca4b58-4c35-4710-b392-dd3888fafd91', name: 'ELEVEN BASS LAB.', reason: '古い方を削除（新しい方を保持）' },
    // NOTE: ID=NULL のレコードはUUIDカラムがnullなので、他の条件で特定する必要がある
  ];

  // 1. ELEVEN BASS LAB. の古い方を削除
  console.log('1. ELEVEN BASS LAB. の古いエントリを削除...');
  const { error: error1 } = await supabase
    .from('tenant_applications')
    .delete()
    .eq('id', 'fdca4b58-4c35-4710-b392-dd3888fafd91');

  if (error1) {
    console.error('  ❌ 削除失敗:', error1);
  } else {
    console.log('  ✅ 削除成功: fdca4b58-4c35-4710-b392-dd3888fafd91');
  }

  // 2. GIFTERRA Official の ID=NULL の方を削除（created_atで特定）
  console.log('\n2. GIFTERRA Official の古いエントリを削除...');
  const { error: error2 } = await supabase
    .from('tenant_applications')
    .delete()
    .eq('tenant_name', 'GIFTERRA Official')
    .eq('created_at', '2025-11-28T18:49:22.590542');

  if (error2) {
    console.error('  ❌ 削除失敗:', error2);
  } else {
    console.log('  ✅ 削除成功: GIFTERRA Official (2025-11-28作成)');
  }

  // 確認
  console.log('\n=== 削除後の確認 ===');
  const { data, error } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('確認エラー:', error);
    return;
  }

  console.log('残りのテナント:', data.length);
  data.forEach(t => {
    console.log(`  - ${t.tenant_name} (ID: ${t.id || 'NULL'}, Created: ${t.created_at})`);
  });

  // 重複チェック
  const names = {};
  data.forEach(t => {
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
    });
  }
}

fixDuplicates();
