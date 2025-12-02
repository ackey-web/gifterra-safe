const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function deleteByPrimaryKey() {
  console.log('=== 主キー(id)で重複テナント削除 ===\n');

  // まず全レコードのidカラムを取得
  const { data: all, error: fetchError } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, created_at')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('取得エラー:', fetchError);
    return;
  }

  console.log('現在のレコード（idカラムで表示）:');
  all.forEach((record, i) => {
    console.log(`${i+1}. [id=${record.id}] ${record.tenant_name} (tenant_id: ${record.tenant_id}, Created: ${record.created_at})`);
  });

  // 重複をグループ化
  const groups = {};
  all.forEach(record => {
    if (!groups[record.tenant_name]) groups[record.tenant_name] = [];
    groups[record.tenant_name].push(record);
  });

  // 古い方を削除対象とする
  const toDelete = [];
  Object.entries(groups).forEach(([name, records]) => {
    if (records.length > 1) {
      // 新しい方を残す（created_atで降順ソートして、最初以外を削除）
      const sorted = [...records].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      // 最初（最新）以外を削除対象
      toDelete.push(...sorted.slice(1));
    }
  });

  if (toDelete.length === 0) {
    console.log('\n✅ 重複なし');
    return;
  }

  console.log('\n削除対象（古い方）:');
  toDelete.forEach(record => {
    console.log(`  - [id=${record.id}] ${record.tenant_name} (Created: ${record.created_at})`);
  });

  console.log('\n削除を実行中...\n');

  for (const record of toDelete) {
    const { error } = await supabase
      .from('tenant_applications')
      .delete()
      .eq('id', record.id);

    if (error) {
      console.error(`❌ 削除失敗 [id=${record.id}]:`, error);
    } else {
      console.log(`✅ 削除成功: [id=${record.id}] ${record.tenant_name}`);
    }
  }

  // 確認
  console.log('\n=== 削除後の確認 ===');
  const { data: after } = await supabase
    .from('tenant_applications')
    .select('id, tenant_id, tenant_name, created_at')
    .order('created_at', { ascending: true });

  console.log('残りのレコード:', after.length);
  after.forEach((record, i) => {
    console.log(`${i+1}. [id=${record.id}] ${record.tenant_name} (tenant_id: ${record.tenant_id})`);
  });

  // 重複チェック
  const afterGroups = {};
  after.forEach(record => {
    if (!afterGroups[record.tenant_name]) afterGroups[record.tenant_name] = [];
    afterGroups[record.tenant_name].push(record);
  });

  const duplicates = Object.entries(afterGroups).filter(([_, records]) => records.length > 1);
  if (duplicates.length === 0) {
    console.log('\n✅ 重複なし - 完了！');
  } else {
    console.log('\n⚠️ まだ重複が残っています:');
    duplicates.forEach(([name, records]) => {
      console.log(`  ${name}: ${records.length}件`);
      records.forEach(r => console.log(`    - id=${r.id}`));
    });
  }
}

deleteByPrimaryKey();
