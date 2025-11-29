// scripts/compare-address-case.cjs
// Check if addresses have case sensitivity issues in database

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function compareAddressCase() {
  const addresses = [
    '0x5b89f2e7bdf7d5114dcf4bf466316c967553a1fa', // 反映されていない
    '0x1c40ac152fa5106db85732692d78b941481ea555', // 反映されている
  ];

  for (const addr of addresses) {
    console.log('');
    console.log('='.repeat(60));
    console.log(`🔍 アドレス: ${addr}`);
    console.log('='.repeat(60));

    // 小文字でクエリ
    const { data: lowerData, error: lowerError } = await supabase
      .from('transfer_messages')
      .select('from_address')
      .eq('from_address', addr.toLowerCase())
      .limit(1);

    console.log('');
    console.log('小文字クエリ (.toLowerCase())');
    console.log(`  クエリ条件: from_address = '${addr.toLowerCase()}'`);
    console.log('  エラー:', lowerError);
    console.log('  結果数:', lowerData?.length || 0);
    if (lowerData && lowerData.length > 0) {
      console.log('  実際のfrom_address:', lowerData[0].from_address);
      console.log('  大文字小文字一致:', lowerData[0].from_address === addr.toLowerCase() ? '✅' : '❌');
    }

    // そのままクエリ
    const { data: asIsData, error: asIsError } = await supabase
      .from('transfer_messages')
      .select('from_address')
      .eq('from_address', addr)
      .limit(1);

    console.log('');
    console.log('そのままクエリ (大文字小文字混在)');
    console.log(`  クエリ条件: from_address = '${addr}'`);
    console.log('  エラー:', asIsError);
    console.log('  結果数:', asIsData?.length || 0);
    if (asIsData && asIsData.length > 0) {
      console.log('  実際のfrom_address:', asIsData[0].from_address);
    }

    // 大文字でクエリ
    const { data: upperData, error: upperError } = await supabase
      .from('transfer_messages')
      .select('from_address')
      .eq('from_address', addr.toUpperCase())
      .limit(1);

    console.log('');
    console.log('大文字クエリ (.toUpperCase())');
    console.log(`  クエリ条件: from_address = '${addr.toUpperCase()}'`);
    console.log('  エラー:', upperError);
    console.log('  結果数:', upperData?.length || 0);

    // サマリー
    console.log('');
    console.log('📊 サマリー:');
    if (lowerData && lowerData.length > 0) {
      console.log('  ✅ 小文字クエリで取得可能');
    } else {
      console.log('  ❌ 小文字クエリで取得不可');
    }

    if (asIsData && asIsData.length > 0 && asIsData.length !== lowerData?.length) {
      console.log('  ⚠️ 大文字小文字混在でのみ取得可能（問題の可能性あり）');
    }
  }
}

compareAddressCase().catch(console.error);
