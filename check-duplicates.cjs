const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('tenant_applications')
    .select('tenant_id, tenant_name, applicant_address, status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total tenants:', data.length);
  console.log('\nAll Tenants:');
  data.forEach(t => {
    console.log(`ID: ${t.tenant_id || 'NULL'} | Name: ${t.tenant_name} | Status: ${t.status} | Created: ${t.created_at}`);
  });

  // 重複チェック
  const names = {};
  data.forEach(t => {
    if (!names[t.tenant_name]) names[t.tenant_name] = [];
    names[t.tenant_name].push(t);
  });

  console.log('\n=== 重複テナント ===');
  let foundDuplicates = false;
  Object.entries(names).forEach(([name, tenants]) => {
    if (tenants.length > 1) {
      foundDuplicates = true;
      console.log(`\n${name}: ${tenants.length}件`);
      tenants.forEach(t => {
        console.log(`  - ID: ${t.tenant_id || 'NULL'}, Status: ${t.status}, Created: ${t.created_at}`);
      });
    }
  });

  if (!foundDuplicates) {
    console.log('重複なし');
  }
}

checkDuplicates();
