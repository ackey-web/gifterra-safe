// scripts/check-tenant-isolation.cjs
// Check if tenant_id filtering could be affecting kodomi calculation

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenantIsolation() {
  const targetAddress = process.argv[2] || '0x5b89f2e7bdf7d5114dcf4bf466316c967553a1fa';

  console.log('🔍 tenant_id分離チェック');
  console.log('📍 対象アドレス:', targetAddress);
  console.log('');

  // tenant_idごとにトランザクションを取得
  const { data: allTxs, error } = await supabase
    .from('transfer_messages')
    .select('tenant_id, token_symbol, amount, created_at')
    .eq('from_address', targetAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('=== 全トランザクション (tenant_id別) ===');
  console.log('総数:', allTxs?.length || 0);
  console.log('');

  if (!allTxs || allTxs.length === 0) {
    console.log('⚠️ トランザクションが見つかりません');
    return;
  }

  // tenant_idごとに集計
  const tenantStats = {};

  allTxs.forEach((tx) => {
    const tenantId = tx.tenant_id || 'null';
    if (!tenantStats[tenantId]) {
      tenantStats[tenantId] = {
        count: 0,
        jpycTotal: 0,
        jpycCount: 0,
        nhtCount: 0,
        transactions: [],
      };
    }

    tenantStats[tenantId].count++;
    tenantStats[tenantId].transactions.push(tx);

    const symbol = tx.token_symbol?.toUpperCase();
    const amount = parseFloat(tx.amount || '0');

    if (symbol === 'JPYC') {
      tenantStats[tenantId].jpycTotal += amount;
      tenantStats[tenantId].jpycCount++;
    } else if (symbol === 'TNHT' || symbol === 'NHT') {
      tenantStats[tenantId].nhtCount++;
    }
  });

  console.log('=== tenant_id別統計 ===');
  Object.entries(tenantStats).forEach(([tenantId, stats]) => {
    console.log('');
    console.log(`🏢 tenant_id: ${tenantId}`);
    console.log(`  トランザクション数: ${stats.count}`);
    console.log(`  JPYC総額: ${stats.jpycTotal} JPYC`);
    console.log(`  JPYCチップ回数: ${stats.jpycCount}`);
    console.log(`  NHTチップ回数: ${stats.nhtCount}`);
    console.log('  最新3件:');
    stats.transactions.slice(0, 3).forEach((tx, i) => {
      console.log(`    ${i + 1}. ${tx.created_at} - ${tx.token_symbol}: ${tx.amount}`);
    });
  });

  console.log('');
  console.log('=== 問題の可能性 ===');
  if (Object.keys(tenantStats).length > 1) {
    console.log('⚠️ 複数のtenant_idが存在します！');
    console.log('   フロントエンドがtenant_idでフィルタリングしている場合、');
    console.log('   一部のトランザクションが表示されない可能性があります。');
  } else {
    console.log('✅ tenant_idは単一です（tenant_id分離は問題ではありません）');
  }
}

checkTenantIsolation().catch(console.error);
