// scripts/simulate-frontend-kodomi.cjs
// フロントエンドのuseDualAxisKodoミHookと同じロジックでkodomi計算をシミュレート

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// フロントエンドと同じランク定義
const JPYC_RANKS = {
  BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 200 },
  SILVER: { name: 'Silver', threshold: 200, color: '#c0c0c0', maxThreshold: 700 },
  GOLD: { name: 'Gold', threshold: 700, color: '#ffd700', maxThreshold: 1500 },
  PLATINUM: { name: 'Platinum', threshold: 1500, color: '#e5e4e2', maxThreshold: 7000 },
  DIAMOND: { name: 'Diamond', threshold: 7000, color: '#b9f2ff', maxThreshold: Infinity },
};

function calculateJPYCRank(totalAmount) {
  const ranks = Object.values(JPYC_RANKS);

  for (let i = 0; i < ranks.length; i++) {
    const currentRank = ranks[i];
    if (totalAmount < currentRank.maxThreshold) {
      const progress = totalAmount >= currentRank.threshold
        ? ((totalAmount - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
        : 0;

      return {
        rank: currentRank.name,
        color: currentRank.color,
        level: Math.min(progress, 100),
        displayLevel: i + 1,
      };
    }
  }

  // 最高ランク
  return {
    rank: JPYC_RANKS.DIAMOND.name,
    color: JPYC_RANKS.DIAMOND.color,
    level: 100,
    displayLevel: Object.keys(JPYC_RANKS).length,
  };
}

async function simulateFrontendLogic() {
  const targetAddress = process.argv[2] || '0x5b89f2e7bdf7d5114dcf4bf466316c967553a1fa';

  console.log('🎯 フロントエンドロジックをシミュレート');
  console.log('📍 対象アドレス:', targetAddress);
  console.log('📍 小文字変換後:', targetAddress.toLowerCase());
  console.log('');

  // フロントエンドと同じクエリを実行
  console.log('🔍 Supabaseクエリ実行中...');
  const { data: transactions, error: txError } = await supabase
    .from('transfer_messages')
    .select('*')
    .eq('from_address', targetAddress.toLowerCase());

  console.log('');
  console.log('=== クエリ結果 ===');
  console.log('エラー:', txError);
  console.log('取得データ数:', transactions?.length || 0);

  if (txError) {
    console.error('❌ Supabaseクエリエラー:', txError);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log('⚠️ トランザクションが見つかりません');
    console.log('');
    console.log('🔍 デバッグ情報:');
    console.log('- アドレスは正しいですか？');
    console.log('- from_address カラムは小文字で保存されていますか？');
    console.log('- RLSポリシーで制限されていませんか？');
    return;
  }

  console.log('');
  console.log('=== トランザクション詳細 (最新5件) ===');
  transactions.slice(0, 5).forEach((tx, i) => {
    console.log(`${i + 1}. ${tx.created_at}`);
    console.log(`   from_address: ${tx.from_address}`);
    console.log(`   token_symbol: ${tx.token_symbol}`);
    console.log(`   amount: ${tx.amount}`);
    console.log('');
  });

  // フロントエンドと同じ集計ロジック
  let jpycTotal = 0;
  let jpycCount = 0;
  let nhtCount = 0;

  console.log('=== JPYC/NHT集計中 ===');
  transactions.forEach((tx) => {
    const tokenSymbol = tx.token_symbol?.toUpperCase();
    const amount = parseFloat(tx.amount || '0');

    console.log(`- ${tokenSymbol}: ${amount}`);

    if (tokenSymbol === 'JPYC') {
      jpycTotal += amount;
      jpycCount++;
    } else if (tokenSymbol === 'TNHT' || tokenSymbol === 'NHT') {
      nhtCount++;
    }
  });

  console.log('');
  console.log('=== 集計結果 ===');
  console.log('JPYC総額:', jpycTotal, 'JPYC');
  console.log('JPYCチップ回数:', jpycCount, '回');
  console.log('NHTチップ回数:', nhtCount, '回');

  // ランク計算
  const jpycRank = calculateJPYCRank(jpycTotal);

  console.log('');
  console.log('=== 計算されたランク ===');
  console.log('ランク:', jpycRank.rank);
  console.log('カラー:', jpycRank.color);
  console.log('レベル進行度:', jpycRank.level.toFixed(2), '%');
  console.log('表示レベル:', jpycRank.displayLevel);

  console.log('');
  console.log('=== フロントエンドで期待される表示 ===');
  console.log(`Rank: ${jpycRank.rank} Lv.${jpycRank.displayLevel}`);
  console.log(`Progress: ${jpycRank.level.toFixed(2)}%`);
  console.log(`Total: ${jpycTotal} JPYC`);
}

simulateFrontendLogic().catch(console.error);
