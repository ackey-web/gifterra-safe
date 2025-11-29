// src/hooks/useDualAxisKodomi.ts
// 法務対応：JPYC（金銭的貢献）とNHT（応援熱量）を分離した2軸kodomi取得Hook

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 💸 JPYC軸（金銭的貢献）
 */
export interface JPYCAxisData {
  totalAmount: number;        // JPYC総額（JPYC単位）
  tipCount: number;            // JPYCチップ回数
  rank: string;                // ランク（Bronze, Silver, Gold等）
  color: string;               // ランクカラー
  level: number;               // レベル（0-100%）
  displayLevel: number;        // 表示用レベル数値
}

/**
 * ⚡ NHT軸（応援熱量スコア）
 * 重要: NHTの金額・総額は一切表示しない
 */
export interface ResonanceAxisData {
  supportCount: number;        // 応援回数（NHTチップ回数）
  streakDays: number;          // 連続応援日数
  messageQuality: number;      // メッセージ品質スコア（0-100）
  engagementScore: number;     // 総合エンゲージメントスコア（0-1000）
  rank: string;                // ランク
  color: string;               // ランクカラー
  level: number;               // レベル（0-100%）
  displayLevel: number;        // 表示用レベル数値
}

/**
 * 総合スコア情報
 */
export interface OverallScoreData {
  totalScore: number;          // 総合スコア（JPYC + Resonanceの正規化合算）
  rank: string;                // 総合ランク
  color: string;               // ランクカラー
  level: number;               // レベル（0-100%）
  displayLevel: number;        // 表示用レベル数値
}

/**
 * 統合データ
 */
export interface DualAxisKodomiData {
  jpyc: JPYCAxisData;
  resonance: ResonanceAxisData;
  overall: OverallScoreData;   // 総合スコア追加
  loading: boolean;
  error: string | null;
}

/**
 * JPYCランク定義（JPYC総額ベース）
 */
const JPYC_RANKS = {
  BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 200 },      // 200 JPYC
  SILVER: { name: 'Silver', threshold: 200, color: '#c0c0c0', maxThreshold: 700 },    // 700 JPYC
  GOLD: { name: 'Gold', threshold: 700, color: '#ffd700', maxThreshold: 1500 },       // 1,500 JPYC
  PLATINUM: { name: 'Platinum', threshold: 1500, color: '#e5e4e2', maxThreshold: 7000 }, // 7,000 JPYC
  DIAMOND: { name: 'Diamond', threshold: 7000, color: '#b9f2ff', maxThreshold: Infinity }, // 7,000+ JPYC
} as const;

/**
 * Resonanceランク定義（応援熱量）
 */
const RESONANCE_RANKS = {
  SPARK: { name: 'Spark', threshold: 0, color: '#ffa500', maxThreshold: 150 },      // 火花
  FLAME: { name: 'Flame', threshold: 150, color: '#ff6b35', maxThreshold: 400 },    // 炎
  BLAZE: { name: 'Blaze', threshold: 400, color: '#ff4500', maxThreshold: 800 },    // 業火
  INFERNO: { name: 'Inferno', threshold: 800, color: '#dc143c', maxThreshold: 1500 }, // 劫火
  PHOENIX: { name: 'Phoenix', threshold: 1500, color: '#ff00ff', maxThreshold: Infinity }, // 不死鳥
} as const;

/**
 * JPYCランク計算
 */
function calculateJPYCRank(totalAmount: number): {
  rank: string;
  color: string;
  level: number;
  displayLevel: number;
} {
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

/**
 * Resonanceランク計算
 */
function calculateResonanceRank(engagementScore: number): {
  rank: string;
  color: string;
  level: number;
  displayLevel: number;
} {
  const ranks = Object.values(RESONANCE_RANKS);

  for (let i = 0; i < ranks.length; i++) {
    const currentRank = ranks[i];
    if (engagementScore < currentRank.maxThreshold) {
      const progress = engagementScore >= currentRank.threshold
        ? ((engagementScore - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
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
    rank: RESONANCE_RANKS.PHOENIX.name,
    color: RESONANCE_RANKS.PHOENIX.color,
    level: 100,
    displayLevel: Object.keys(RESONANCE_RANKS).length,
  };
}

/**
 * 総合ランク定義
 */
const OVERALL_RANKS = {
  NOVICE: { name: 'Novice', threshold: 0, color: '#8b7355', maxThreshold: 300 },        // 初心者
  SUPPORTER: { name: 'Supporter', threshold: 300, color: '#4a90e2', maxThreshold: 800 },  // サポーター
  CHAMPION: { name: 'Champion', threshold: 800, color: '#9b59b6', maxThreshold: 1500 },  // チャンピオン
  LEGEND: { name: 'Legend', threshold: 1500, color: '#e74c3c', maxThreshold: 3000 },    // レジェンド
  MYTHIC: { name: 'Mythic', threshold: 3000, color: '#f39c12', maxThreshold: Infinity }, // 神話級
} as const;

/**
 * 総合スコア計算
 * JPYC軸とResonance軸を正規化して合算
 */
function calculateOverallScore(
  jpycAmount: number,
  engagementScore: number
): OverallScoreData {
  // JPYC軸を0-1000スケールに正規化（最大7000 JPYCを1000ポイントとする）
  const normalizedJPYC = Math.min(1000, (jpycAmount / 7000) * 1000);

  // Resonance軸はすでに0-1000スケール
  const normalizedResonance = Math.min(1000, engagementScore);

  // 総合スコア = JPYC (50%) + Resonance (50%)
  const totalScore = Math.round((normalizedJPYC * 0.5) + (normalizedResonance * 0.5));

  // ランク計算
  const ranks = Object.values(OVERALL_RANKS);

  for (let i = 0; i < ranks.length; i++) {
    const currentRank = ranks[i];
    if (totalScore < currentRank.maxThreshold) {
      const progress = totalScore >= currentRank.threshold
        ? ((totalScore - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
        : 0;

      return {
        totalScore,
        rank: currentRank.name,
        color: currentRank.color,
        level: Math.min(progress, 100),
        displayLevel: i + 1,
      };
    }
  }

  // 最高ランク
  return {
    totalScore,
    rank: OVERALL_RANKS.MYTHIC.name,
    color: OVERALL_RANKS.MYTHIC.color,
    level: 100,
    displayLevel: Object.keys(OVERALL_RANKS).length,
  };
}

/**
 * 2軸kodomi取得フック
 * @param walletAddress - ウォレットアドレス（親コンポーネントから渡される）
 */
export function useDualAxisKodomi(walletAddress?: string) {
  console.log('🔥🔥🔥🔥🔥 [KODOMI-DEBUG-v2] ============================================');
  console.log('🔥🔥🔥🔥🔥 [KODOMI-DEBUG-v2] useDualAxisKodomi フック実行開始!!!');
  console.log('🔥🔥🔥🔥🔥 [KODOMI-DEBUG-v2] ============================================');
  console.log('🔥 [KODOMI-DEBUG-v2] 渡されたwalletAddress:', walletAddress);

  // 引数で渡されたアドレスを使用
  const address = walletAddress;

  console.log('🚀🚀🚀 [KODOMI-DEBUG-v2] useDualAxisKodomi - フック呼び出し');
  console.log('  address:', address);
  console.log('  address type:', typeof address);
  console.log('  address is null?:', address === null);
  console.log('  address is undefined?:', address === undefined);

  const [data, setData] = useState<DualAxisKodomiData>({
    jpyc: {
      totalAmount: 0,
      tipCount: 0,
      rank: 'Bronze',
      color: '#cd7f32',
      level: 0,
      displayLevel: 1,
    },
    resonance: {
      supportCount: 0,
      streakDays: 0,
      messageQuality: 50,
      engagementScore: 0,
      rank: 'Spark',
      color: '#ffa500',
      level: 0,
      displayLevel: 1,
    },
    overall: {
      totalScore: 0,
      rank: 'Novice',
      color: '#8b7355',
      level: 0,
      displayLevel: 1,
    },
    loading: true,
    error: null,
  });

  // useCallbackでメモ化してクロージャ問題を解決
  const fetchDualAxisData = useCallback(async () => {
    console.log('[KODOMI-DEBUG-v2] fetchDualAxisData呼び出し, address:', address);

    if (!address) {
      console.log('[KODOMI-DEBUG-v2] addressがnullまたはundefinedのため早期リターン');
      return;
    }

    try {
      console.log('🔍 [KODOMI-DEBUG-v2] fetchDualAxisData開始');
      console.log('  対象アドレス:', address);
      console.log('  小文字変換後:', address.toLowerCase());

      setData(prev => ({ ...prev, loading: true, error: null }));

      // Supabaseからトランザクション履歴を取得
      console.log('[KODOMI-DEBUG-v2] Supabaseクエリ実行中...');
      const { data: transactions, error: txError } = await supabase
        .from('transfer_messages')
        .select('*')
        .eq('from_address', address.toLowerCase());

      console.log('📊 [KODOMI-DEBUG-v2] Supabaseクエリ完了');
      console.log('  エラー:', txError);
      console.log('  取得したトランザクション数:', transactions?.length || 0);

      if (transactions && transactions.length > 0) {
        console.log('  最新トランザクション:', {
          token_symbol: transactions[0].token_symbol,
          amount: transactions[0].amount,
          created_at: transactions[0].created_at,
        });
      }

      if (txError) throw txError;

      // JPYC/NHT別に集計
      let jpycTotal = 0;  // JPYC総額
      let jpycCount = 0;  // JPYCチップ回数
      let nhtCount = 0;   // NHTチップ回数
      const tipDates = new Set<string>();

      transactions?.forEach((tx) => {
        const tokenSymbol = tx.token_symbol?.toUpperCase();
        const amount = parseFloat(tx.amount || '0');

        if (tokenSymbol === 'JPYC') {
          jpycTotal += amount;  // JPYC総額を加算
          jpycCount++;
        } else if (tokenSymbol === 'TNHT' || tokenSymbol === 'NHT') {
          nhtCount++;
        }

        // 日付を記録（ストリーク計算用）
        if (tx.created_at) {
          const date = new Date(tx.created_at).toISOString().split('T')[0];
          tipDates.add(date);
        }
      });

      // ストリーク計算（連続日数）
      const streakDays = calculateStreak(Array.from(tipDates).sort());

      // メッセージ品質スコア（簡易版）
      const messageQuality = calculateMessageQuality(transactions || []);

      // エンゲージメントスコア計算
      // = 応援回数 × 2 + ストリーク日数 × 10 + メッセージ品質
      const engagementScore = Math.min(
        1000,
        nhtCount * 2 + streakDays * 10 + messageQuality
      );

      // JPYCランク計算
      const jpycRank = calculateJPYCRank(jpycTotal);

      // Resonanceランク計算
      const resonanceRank = calculateResonanceRank(engagementScore);

      // 総合スコア計算
      const overallScore = calculateOverallScore(jpycTotal, engagementScore);

      const result = {
        jpyc: {
          totalAmount: jpycTotal,
          tipCount: jpycCount,
          ...jpycRank,
        },
        resonance: {
          supportCount: nhtCount,
          streakDays,
          messageQuality,
          engagementScore,
          ...resonanceRank,
        },
        overall: overallScore,
        loading: false,
        error: null,
      };

      console.log('✅✅✅ [KODOMI-DEBUG-v2] データセット完了:');
      console.log('  JPYC総額:', jpycTotal, 'JPYC');
      console.log('  JPYCチップ回数:', jpycCount);
      console.log('  NHTチップ回数:', nhtCount);
      console.log('  ストリーク:', streakDays, '日');
      console.log('  メッセージ品質:', messageQuality);
      console.log('  エンゲージメント:', engagementScore);
      console.log('  JPYCランク:', jpycRank.rank, 'Lv.' + jpycRank.displayLevel, `(${jpycRank.level.toFixed(2)}%)`);
      console.log('  Resonanceランク:', resonanceRank.rank, 'Lv.' + resonanceRank.displayLevel, `(${resonanceRank.level.toFixed(2)}%)`);
      console.log('  総合スコア:', overallScore.totalScore, '/', overallScore.rank, 'Lv.' + overallScore.displayLevel, `(${overallScore.level.toFixed(2)}%)`);

      console.log('[KODOMI-DEBUG-v2] setData実行前のresult:', JSON.stringify(result, null, 2));
      setData(result);
      console.log('[KODOMI-DEBUG-v2] setData実行完了');
    } catch (err) {
      console.error('❌ 2軸kodomi取得エラー:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, [address]); // addressが変わったら再作成

  // 初回データ取得（addressが変わったらロード）
  useEffect(() => {
    console.log('🔄 [KODOMI-DEBUG-v2] useEffect (初回データ取得) 実行');
    console.log('  address:', address);
    console.log('  addressの型:', typeof address);
    console.log('  walletAddress引数:', walletAddress);

    if (!address) {
      console.log('⚠️ [KODOMI-DEBUG-v2] addressがnull/undefinedのため、loading=falseにして早期リターン');
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    console.log('✅ [KODOMI-DEBUG-v2] addressあり、fetchDualAxisData呼び出し');
    fetchDualAxisData();
  }, [address, fetchDualAxisData, walletAddress]); // walletAddressを依存配列に追加

  // リアルタイム更新の購読
  useEffect(() => {
    if (!address) {
      console.log('⚠️ [KODOMI-DEBUG-v2] リアルタイム購読: addressがnullのためスキップ');
      return;
    }

    const normalizedAddress = address.toLowerCase();
    console.log('🔔 [KODOMI-DEBUG-v2] リアルタイム購読開始 for address:', normalizedAddress);
    console.log('🔔 [KODOMI-DEBUG-v2] チャンネル名:', `kodomi-updates-${normalizedAddress}`);

    // Supabaseリアルタイムサブスクリプション設定
    const channel = supabase
      .channel(`kodomi-updates-${normalizedAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE全て
          schema: 'public',
          table: 'transfer_messages',
          filter: `from_address=eq.${normalizedAddress}`,
        },
        (payload) => {
          console.log('🔔🔔🔔 [KODOMI-DEBUG-v2] !!!! リアルタイム更新検知 (from_address) !!!!');
          console.log('  イベント種類:', payload.eventType);
          console.log('  対象アドレス:', normalizedAddress);
          console.log('  新しいレコード:', payload.new);
          console.log('  古いレコード:', payload.old);
          console.log('🔄 [KODOMI-DEBUG-v2] fetchDualAxisDataを呼び出してデータ再取得します...');
          fetchDualAxisData(); // データ再取得
        }
      )
      .subscribe((status) => {
        console.log('📡 [KODOMI-DEBUG-v2] 購読ステータス:', status);
      });

    console.log('✅ [KODOMI-DEBUG-v2] リアルタイム購読チャンネル作成完了');

    // クリーンアップ
    return () => {
      console.log('🔕 [KODOMI-DEBUG-v2] リアルタイム購読解除 for address:', normalizedAddress);
      supabase.removeChannel(channel);
    };
  }, [address, fetchDualAxisData, walletAddress]); // walletAddressも依存配列に追加

  return { ...data, refetch: fetchDualAxisData };
}

/**
 * ストリーク計算（連続日数）
 */
function calculateStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;

  let currentStreak = 1;
  let maxStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * メッセージ品質スコア計算（簡易版）
 */
function calculateMessageQuality(transactions: any[]): number {
  if (!transactions || transactions.length === 0) return 0;

  const messagesWithText = transactions.filter(tx => tx.message && tx.message.trim().length > 0);

  if (messagesWithText.length === 0) return 0;

  // メッセージ付きの割合 × 100
  const messageRatio = messagesWithText.length / transactions.length;

  // 平均文字数ボーナス
  const avgLength = messagesWithText.reduce((sum, tx) => sum + (tx.message?.length || 0), 0) / messagesWithText.length;
  const lengthBonus = Math.min(30, avgLength / 2); // 最大30ポイント

  return Math.min(100, Math.round(messageRatio * 70 + lengthBonus));
}
