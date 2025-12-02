const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vuwqkwsmyunrlwgftxqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d3Frd3NteXVucmx3Z2Z0eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA3MTgzODksImV4cCI6MjA0NjI5NDM4OX0.lm3z9hzB0JHQDWkRWkZEZIJjgPCUWbNJEJYdB1nMx28'
);

async function checkContracts() {
  console.log('=== 現在のコントラクト状況確認 ===\n');

  const userAddress = '0x66f1274ad5d042b7571c2efa943370dbcd3459ab';

  const { data: app, error } = await supabase
    .from('tenant_applications')
    .select('*')
    .eq('applicant_address', userAddress)
    .eq('status', 'approved')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log('承認済みテナント情報:');
  console.log(`  テナント名: ${app.tenant_name}`);
  console.log(`  Tenant ID: ${app.tenant_id}`);
  console.log('\nコントラクトアドレス:');
  console.log(`  Gifterra Address: ${app.gifterra_address || 'なし'}`);
  console.log(`  RewardNFT Address: ${app.reward_nft_address || 'なし'}`);
  console.log(`  PaySplitter Address: ${app.pay_splitter_address || 'なし'}`);
  console.log(`  FlagNFT Address: ${app.flag_nft_address || 'なし'}`);
  console.log(`  RandomRewardEngine Address: ${app.random_reward_engine_address || 'なし'}`);

  console.log('\n分析:');

  const gifterraAddr = app.gifterra_address;
  const applicantAddr = app.applicant_address;

  if (gifterraAddr === applicantAddr) {
    console.log('  ⚠️ gifterra_address が applicant_address と同じです');
    console.log('  これは正しくありません。ファクトリーでデプロイされたコントラクトアドレスである必要があります。');
  }

  if (!gifterraAddr || gifterraAddr === '0x0000000000000000000000000000000000000000') {
    console.log('  ❌ Gifterraコントラクトがデプロイされていません');
  } else if (gifterraAddr.length === 42 && gifterraAddr.startsWith('0x')) {
    console.log('  ✅ Gifterraコントラクトアドレスが設定されています');

    if (gifterraAddr === applicantAddr) {
      console.log('  ⚠️ ただし、これはウォレットアドレスと同じなので、実際のコントラクトではない可能性があります');
    }
  }

  const hasOtherContracts = app.reward_nft_address || app.flag_nft_address || app.random_reward_engine_address;

  if (!hasOtherContracts) {
    console.log('  ❌ RewardNFT, FlagNFT, RandomRewardEngineがデプロイされていません');
    console.log('  → ファクトリーの createTenant() が実行されていない可能性が高いです');
  }
}

checkContracts();
