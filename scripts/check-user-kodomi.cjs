// scripts/check-user-kodomi.cjs
// 特定ユーザーのkodomiデータをSupabaseから確認

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserTransactions() {
  // コマンドライン引数からアドレスを取得（指定がなければデフォルト値）
  const targetAddress = process.argv[2] || '0x5b89f2e7bdf7d5114dcf4bf466316c967553a1fa';

  console.log('🔍 ユーザーアドレス:', targetAddress);
  console.log('');

  // from_addressでの送信履歴
  const { data: sentTxs, error: sentError } = await supabase
    .from('transfer_messages')
    .select('*')
    .eq('from_address', targetAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (sentError) {
    console.log('❌ エラー:', sentError);
    return;
  }

  console.log('📤 送信トランザクション数:', sentTxs?.length || 0);

  if (sentTxs && sentTxs.length > 0) {
    console.log('');
    console.log('=== 送信履歴（最新10件） ===');

    let jpycTotal = 0;
    let jpycCount = 0;

    sentTxs.slice(0, 10).forEach((tx, i) => {
      const symbol = tx.token_symbol?.toUpperCase();
      const amount = parseFloat(tx.amount || '0');

      if (symbol === 'JPYC') {
        jpycTotal += amount;
        jpycCount++;
      }

      console.log(`${i + 1}. ${tx.created_at}`);
      console.log(`   Token: ${symbol} | Amount: ${amount}`);
      console.log(`   To: ${tx.to_address}`);
      console.log(`   Hash: ${tx.transaction_hash}`);
      console.log('');
    });

    console.log('');
    console.log('=== JPYC集計（全トランザクション） ===');

    // 全トランザクションのJPYC集計
    const allJpycTxs = sentTxs.filter(tx => tx.token_symbol?.toUpperCase() === 'JPYC');
    const allJpycTotal = allJpycTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);

    console.log('JPYC総額:', allJpycTotal, 'JPYC');
    console.log('JPYCチップ回数:', allJpycTxs.length, '回');

    // 1000 JPYC以上のトランザクションをチェック
    const largeTxs = allJpycTxs.filter(tx => parseFloat(tx.amount || '0') >= 1000);
    if (largeTxs.length > 0) {
      console.log('');
      console.log('=== 1000 JPYC以上のトランザクション ===');
      largeTxs.forEach(tx => {
        console.log(`${tx.created_at} - ${tx.amount} JPYC`);
        console.log(`  Hash: ${tx.transaction_hash}`);
      });
    }

    // ランク計算
    const JPYC_RANKS = {
      BRONZE: { name: 'Bronze', threshold: 0, maxThreshold: 200 },
      SILVER: { name: 'Silver', threshold: 200, maxThreshold: 700 },
      GOLD: { name: 'Gold', threshold: 700, maxThreshold: 1500 },
      PLATINUM: { name: 'Platinum', threshold: 1500, maxThreshold: 7000 },
      DIAMOND: { name: 'Diamond', threshold: 7000, maxThreshold: Infinity },
    };

    let currentRank = 'BRONZE';
    let level = 0;

    const ranks = Object.entries(JPYC_RANKS);
    for (let i = 0; i < ranks.length; i++) {
      const [rankName, rankData] = ranks[i];
      if (allJpycTotal < rankData.maxThreshold) {
        currentRank = rankName;
        const progress = allJpycTotal >= rankData.threshold
          ? ((allJpycTotal - rankData.threshold) / (rankData.maxThreshold - rankData.threshold)) * 100
          : 0;
        level = Math.min(progress, 100);
        break;
      }
    }

    console.log('');
    console.log('=== 計算されるべきkodomi ===');
    console.log('ランク:', currentRank);
    console.log('レベル進行度:', level.toFixed(2), '%');
    console.log('表示レベル:', Object.keys(JPYC_RANKS).indexOf(currentRank) + 1);

  } else {
    console.log('⚠️ 送信トランザクションが見つかりません');
  }
}

checkUserTransactions().catch(console.error);
