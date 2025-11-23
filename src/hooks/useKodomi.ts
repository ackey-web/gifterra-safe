// src/hooks/useKodomi.ts
// kodomi(貢献熱量ポイント)取得Hook

import { useState, useEffect } from 'react';
import { useAddress, useContract } from '@thirdweb-dev/react';
import { SBT_CONTRACT, CONTRACT_ABI, getGifterraAddress } from '../contract';

/**
 * kodomiランク定義
 * 累積チップ数に基づくランク分け
 */
export const KODOMI_RANKS = {
  BRONZE: { name: 'Bronze', threshold: 0, color: '#cd7f32', maxThreshold: 1000 },
  SILVER: { name: 'Silver', threshold: 1000, color: '#c0c0c0', maxThreshold: 5000 },
  GOLD: { name: 'Gold', threshold: 5000, color: '#ffd700', maxThreshold: 10000 },
  PLATINUM: { name: 'Platinum', threshold: 10000, color: '#e5e4e2', maxThreshold: 50000 },
  DIAMOND: { name: 'Diamond', threshold: 50000, color: '#b9f2ff', maxThreshold: Infinity },
} as const;

/**
 * 累積チップ数からランクを計算
 */
export function calculateKodomiRank(totalTips: number): {
  rank: string;
  color: string;
  threshold: number;
  nextThreshold: number;
  progress: number;
} {
  const ranks = Object.values(KODOMI_RANKS);

  for (let i = 0; i < ranks.length; i++) {
    const currentRank = ranks[i];
    if (totalTips < currentRank.maxThreshold) {
      const progress = totalTips >= currentRank.threshold
        ? ((totalTips - currentRank.threshold) / (currentRank.maxThreshold - currentRank.threshold)) * 100
        : 0;

      return {
        rank: currentRank.name,
        color: currentRank.color,
        threshold: currentRank.threshold,
        nextThreshold: currentRank.maxThreshold,
        progress: Math.min(progress, 100),
      };
    }
  }

  // 最高ランク到達
  const diamondRank = KODOMI_RANKS.DIAMOND;
  return {
    rank: diamondRank.name,
    color: diamondRank.color,
    threshold: diamondRank.threshold,
    nextThreshold: diamondRank.maxThreshold,
    progress: 100,
  };
}

/**
 * ユーザーのkodomiポイント(累積チップ数)を取得するHook
 */
export function useKodomi() {
  const address = useAddress();
  const gifterraAddress = getGifterraAddress();
  const { contract } = useContract(gifterraAddress, CONTRACT_ABI);
  const [kodomi, setKodomi] = useState<number>(0);
  const [rank, setRank] = useState<string>('Bronze');
  const [color, setColor] = useState<string>('#cd7f32');
  const [percentage, setPercentage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !contract) {
      setKodomi(0);
      setRank('Bronze');
      setColor('#cd7f32');
      setPercentage(0);
      setLoading(false);
      return;
    }

    fetchKodomi();
  }, [address, contract]);

  async function fetchKodomi() {
    if (!address || !contract) return;

    try {
      setLoading(true);
      setError(null);

      // userInfo から totalTips を取得
      const userInfo = await contract.call('userInfo', [address]);
      const totalTips = userInfo ? Number(userInfo.totalTips) : 0;

      setKodomi(totalTips);

      // ランク計算
      const rankInfo = calculateKodomiRank(totalTips);
      setRank(rankInfo.rank);
      setColor(rankInfo.color);
      setPercentage(rankInfo.progress);
    } catch (err) {
      console.error('❌ kodomi取得に失敗:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // エラー時はデフォルト値を設定
      setKodomi(0);
      setRank('Bronze');
      setColor('#cd7f32');
      setPercentage(0);
    } finally {
      setLoading(false);
    }
  }

  return {
    kodomi,
    rank,
    color,
    percentage,
    loading,
    error,
    refetch: fetchKodomi,
  };
}
