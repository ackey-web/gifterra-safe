const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function testLogicalDelete() {
  console.log('=== 論理削除テスト ===\n');

  // まず承認済みテナント一覧を取得
  const { data: applications, error: fetchError } = await supabase
    .from('tenant_applications')
    .select('id, tenant_name, status, applicant_address')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ テナント取得エラー:', fetchError);
    return;
  }

  console.log('承認済みテナント:');
  applications.forEach((app, i) => {
    console.log(`${i+1}. ${app.tenant_name} (id: ${app.id})`);
  });

  if (applications.length === 0) {
    console.log('\n承認済みテナントがありません');
    return;
  }

  // 最初のテナントで論理削除をテスト（実際には削除しない、シミュレーションのみ）
  const testApp = applications[0];
  console.log(`\nテスト対象: ${testApp.tenant_name} (id: ${testApp.id})`);

  // 論理削除を試みる（status='deleted'に更新）
  console.log('\n論理削除を実行...');
  const { data: updateResult, error: updateError } = await supabase
    .from('tenant_applications')
    .update({ status: 'deleted' })
    .eq('id', testApp.id)
    .select();

  if (updateError) {
    console.error('❌ 更新エラー:', updateError);
    console.error('エラー詳細:', JSON.stringify(updateError, null, 2));
  } else {
    console.log('✅ 更新成功:', updateResult);
  }

  // 確認
  console.log('\n=== 削除後の確認 ===');
  const { data: afterUpdate } = await supabase
    .from('tenant_applications')
    .select('id, tenant_name, status')
    .eq('id', testApp.id)
    .single();

  if (afterUpdate) {
    console.log(`ステータス: ${afterUpdate.status}`);
  }

  // 元に戻す
  console.log('\n元に戻しています...');
  await supabase
    .from('tenant_applications')
    .update({ status: 'approved' })
    .eq('id', testApp.id);

  console.log('✅ 元に戻しました');
}

testLogicalDelete();
