// src/hooks/useUserKodomi.ts
// 特定ユーザーへの自分のkodomi値を取得するフック

import { useState, useEffect } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';

/**
 * 特定ユーザーへの自分のkodomi値
 */
export interface UserKodomiData {
  jpyc: {
    totalAmount: number;        // 送信したJPYC総額
    tipCount: number;            // JPYCチップ回数
    rank: string;                // ランク
    color: string;               // ランクカラー
    level: number;               // レベル（0-100%）
    displayLevel: number;        // 表示用レベル数値
  };
  resonance: {
    supportCount: number;        // NHT応援回数
    streakDays: number;          // 連続応援日数
    messageQuality: number;      // メッセージ品質スコア
    engagementScore: number;     // エンゲージメントスコア
    rank: string;                // ランク
    color: string;               // ランクカラー
    level: number;               // レベル（0-100%）
    displayLevel: number;        // 表示用レベル数値
  };
  loading: boolean;
  error: string | null;
}

/**
 * JPYCランク定義（特定ユーザーへの送信総額ベース）
 */
const JPYC_RANKS = {
  BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 100 },      // 100 JPYC
  SILVER: { name: 'Silver', threshold: 100, color: '#c0c0c0', maxThreshold: 300 },    // 300 JPYC
  GOLD: { name: 'Gold', threshold: 300, color: '#ffd700', maxThreshold: 700 },       // 700 JPYC
  PLATINUM: { name: 'Platinum', threshold: 700, color: '#e5e4e2', maxThreshold: 1500 }, // 1,500 JPYC
  DIAMOND: { name: 'Diamond', threshold: 1500, color: '#b9f2ff', maxThreshold: Infinity }, // 1,500+ JPYC
} as const;

/**
 * Resonanceランク定義（特定ユーザーへの応援熱量）
 */
const RESONANCE_RANKS = {
  SPARK: { name: 'Spark', threshold: 0, color: '#ffa500', maxThreshold: 100 },      // 火花
  FLAME: { name: 'Flame', threshold: 100, color: '#ff6b35', maxThreshold: 250 },    // 炎
  BLAZE: { name: 'Blaze', threshold: 250, color: '#ff4500', maxThreshold: 500 },    // 業火
  INFERNO: { name: 'Inferno', threshold: 500, color: '#dc143c', maxThreshold: 800 }, // 劫火
  PHOENIX: { name: 'Phoenix', threshold: 800, color: '#ff00ff', maxThreshold: Infinity }, // 不死鳥
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

  return {
    rank: RESONANCE_RANKS.PHOENIX.name,
    color: RESONANCE_RANKS.PHOENIX.color,
    level: 100,
    displayLevel: Object.keys(RESONANCE_RANKS).length,
  };
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
 * メッセージ品質スコア計算
 */
function calculateMessageQuality(transactions: any[]): number {
  if (!transactions || transactions.length === 0) return 0;

  const messagesWithText = transactions.filter(tx => tx.message && tx.message.trim().length > 0);

  if (messagesWithText.length === 0) return 0;

  const messageRatio = messagesWithText.length / transactions.length;
  const avgLength = messagesWithText.reduce((sum, tx) => sum + (tx.message?.length || 0), 0) / messagesWithText.length;
  const lengthBonus = Math.min(30, avgLength / 2);

  return Math.min(100, Math.round(messageRatio * 70 + lengthBonus));
}

/**
 * 特定ユーザーへの自分のkodomi値を取得するフック
 * @param targetAddress 対象ユーザーのアドレス
 */
export function useUserKodomi(targetAddress: string | undefined) {
  const myAddress = useAddress(); // ログイン中のユーザー

  const [data, setData] = useState<UserKodomiData>({
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
    console.log('🔍 useUserKodomi - myAddress:', myAddress, 'targetAddress:', targetAddress);

    if (!myAddress || !targetAddress) {
      console.log('⚠️ useUserKodomi - アドレスが不足しています');
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    fetchUserKodomiData();

    // Supabaseリアルタイムサブスクリプション設定
    console.log('🔔 useUserKodomi - リアルタイムサブスクリプション開始');
    const channel = supabase
      .channel(`user-kodomi-${myAddress}-${targetAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE全て
          schema: 'public',
          table: 'transfer_messages',
          filter: `from_address=eq.${myAddress.toLowerCase()},to_address=eq.${targetAddress.toLowerCase()}`,
        },
        (payload) => {
          console.log('🔔 useUserKodomi - リアルタイム更新検知:', payload);
          fetchUserKodomiData(); // データ再取得
        }
      )
      .subscribe();

    // クリーンアップ
    return () => {
      console.log('🔕 useUserKodomi - リアルタイムサブスクリプション解除');
      supabase.removeChannel(channel);
    };
  }, [myAddress, targetAddress]);

  async function fetchUserKodomiData() {
    if (!myAddress || !targetAddress) return;

    try {
      console.log('📊 fetchUserKodomiData - 開始');
      setData(prev => ({ ...prev, loading: true, error: null }));

      // スコアパラメーターを取得
      const { data: scoreParams } = await supabase
        .from('score_params')
        .select('nht_weight, streak_weight, ai_quality_weight, message_quality_weight')
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();

      // デフォルト値（パラメーターが未設定の場合）
      const nhtWeight = scoreParams?.nht_weight ?? 2.0;
      const streakWeight = scoreParams?.streak_weight ?? 10.0;
      const aiQualityWeight = scoreParams?.ai_quality_weight ?? 1.0;
      const messageQualityWeight = scoreParams?.message_quality_weight ?? 1.0;

      console.log('⚙️ 使用するスコアパラメーター:', {
        nhtWeight,
        streakWeight,
        aiQualityWeight,
        messageQualityWeight
      });

      // Supabaseから自分→対象ユーザーへの送信履歴を取得
      const { data: transactions, error: txError } = await supabase
        .from('transfer_messages')
        .select('*')
        .eq('from_address', myAddress.toLowerCase())
        .eq('to_address', targetAddress.toLowerCase());

      console.log('📊 取得したトランザクション数:', transactions?.length || 0);

      if (txError) throw txError;

      // JPYC/NHT別に集計
      let jpycTotal = 0;
      let jpycCount = 0;
      let nhtCount = 0;
      const tipDates = new Set<string>();

      transactions?.forEach((tx) => {
        const tokenSymbol = tx.token_symbol?.toUpperCase();
        const amount = parseFloat(tx.amount || '0');

        if (tokenSymbol === 'JPYC') {
          jpycTotal += amount;
          jpycCount++;
        } else if (tokenSymbol === 'TNHT' || tokenSymbol === 'NHT') {
          nhtCount++;
        }

        if (tx.created_at) {
          const date = new Date(tx.created_at).toISOString().split('T')[0];
          tipDates.add(date);
        }
      });

      // ストリーク計算
      const streakDays = calculateStreak(Array.from(tipDates).sort());

      // メッセージ品質スコア
      const messageQuality = calculateMessageQuality(transactions || []);

      // AI質的スコア: このユーザーへ送ったメッセージの平均スコア
      let aiQualityScore = 0;
      const messagesWithAI = transactions?.filter(tx => tx.ai_quality_score != null) || [];
      if (messagesWithAI.length > 0) {
        const totalAIScore = messagesWithAI.reduce((sum, tx) => sum + (tx.ai_quality_score || 0), 0);
        aiQualityScore = Math.round(totalAIScore / messagesWithAI.length);
      }

      // エンゲージメントスコア (動的パラメーターを使用)
      const engagementScore = Math.min(
        500,
        nhtCount * nhtWeight +
        streakDays * streakWeight +
        messageQuality * messageQualityWeight +
        aiQualityScore * aiQualityWeight
      );

      // ランク計算
      const jpycRank = calculateJPYCRank(jpycTotal);
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

      console.log('✅ useUserKodomi - データセット完了:', result);
      setData(result);
    } catch (err) {
      console.error('❌ ユーザーkodomi取得エラー:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }

  return { ...data, refetch: fetchUserKodomiData };
}
