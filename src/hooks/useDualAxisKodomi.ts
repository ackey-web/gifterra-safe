// src/hooks/useDualAxisKodomi.ts
// 法務対応：JPYC（金銭的貢献）とNHT（応援熱量）を分離した2軸kodomi取得Hook

import { useState, useEffect } from 'react';
import { useAddress, useContract } from '@thirdweb-dev/react';
import { CONTRACT_ABI, getGifterraAddress } from '../contract';
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
 * 統合データ
 */
export interface DualAxisKodomiData {
  jpyc: JPYCAxisData;
  resonance: ResonanceAxisData;
  loading: boolean;
  error: string | null;
}

/**
 * JPYCランク定義（JPYC総額ベース）
 */
const JPYC_RANKS = {
  BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 100 },      // 100 JPYC
  SILVER: { name: 'Silver', threshold: 100, color: '#c0c0c0', maxThreshold: 500 },    // 500 JPYC
  GOLD: { name: 'Gold', threshold: 500, color: '#ffd700', maxThreshold: 1000 },       // 1,000 JPYC
  PLATINUM: { name: 'Platinum', threshold: 1000, color: '#e5e4e2', maxThreshold: 5000 }, // 5,000 JPYC
  DIAMOND: { name: 'Diamond', threshold: 5000, color: '#b9f2ff', maxThreshold: Infinity }, // 5,000+ JPYC
} as const;

/**
 * Resonanceランク定義（応援熱量）
 */
const RESONANCE_RANKS = {
  SPARK: { name: 'Spark', threshold: 0, color: '#ffa500', maxThreshold: 100 },      // 火花
  FLAME: { name: 'Flame', threshold: 100, color: '#ff6b35', maxThreshold: 300 },    // 炎
  BLAZE: { name: 'Blaze', threshold: 300, color: '#ff4500', maxThreshold: 600 },    // 業火
  INFERNO: { name: 'Inferno', threshold: 600, color: '#dc143c', maxThreshold: 1000 }, // 劫火
  PHOENIX: { name: 'Phoenix', threshold: 1000, color: '#ff00ff', maxThreshold: Infinity }, // 不死鳥
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
 * 2軸kodomi取得フック
 */
export function useDualAxisKodomi() {
  const address = useAddress();
  const gifterraAddress = getGifterraAddress();
  const { contract } = useContract(gifterraAddress, CONTRACT_ABI);

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
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!address || !contract) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    fetchDualAxisData();

    // Supabaseリアルタイムサブスクリプション設定
    console.log('🔔 useDualAxisKodomi - リアルタイムサブスクリプション開始');
    const channel = supabase
      .channel('kodomi-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE全て
          schema: 'public',
          table: 'transfer_messages',
          filter: `from_address=eq.${address.toLowerCase()}`,
        },
        (payload) => {
          console.log('🔔 リアルタイム更新検知:', payload);
          fetchDualAxisData(); // データ再取得
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      console.log('🔕 useDualAxisKodomi - リアルタイムサブスクリプション解除');
      supabase.removeChannel(channel);
    };
  }, [address, contract]);

  async function fetchDualAxisData() {
    if (!address) return;

    try {
      console.log('🔍 useDualAxisKodomi - fetchDualAxisData開始 address:', address);
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Supabaseからトランザクション履歴を取得
      const { data: transactions, error: txError } = await supabase
        .from('transfer_messages')
        .select('*')
        .eq('from_address', address.toLowerCase());

      console.log('📊 useDualAxisKodomi - 取得したトランザクション数:', transactions?.length || 0);

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
        loading: false,
        error: null,
      };

      console.log('✅ useDualAxisKodomi - データセット完了:', {
        jpycTotal,
        jpycCount,
        nhtCount,
        streakDays,
        messageQuality,
        engagementScore,
        jpycRank: jpycRank.rank,
        resonanceRank: resonanceRank.rank,
      });

      setData(result);
    } catch (err) {
      console.error('❌ 2軸kodomi取得エラー:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }

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
