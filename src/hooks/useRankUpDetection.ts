// src/hooks/useRankUpDetection.ts
// kodomi値の変化を監視してランクアップを検知するHook

import { useState, useEffect, useRef } from 'react';
import { calculateNextRank, type RankThresholds } from './useRankThresholds';

interface RankUpInfo {
  newRank: number;
  icon: string;
  label: string;
}

/**
 * kodomi値の変化を監視し、ランクアップを検知
 */
export function useRankUpDetection(
  kodomi: number,
  thresholds: RankThresholds,
  rankLabels: Record<number, { icon: string; label: string }>
) {
  const [rankUpInfo, setRankUpInfo] = useState<RankUpInfo | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const prevRankRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (Object.keys(thresholds).length === 0 || kodomi === 0) {
      return;
    }

    // 現在のランク情報を計算
    const { currentRank } = calculateNextRank(kodomi, thresholds);

    // 初回実行時は現在のランクを記録するだけ
    if (!isInitializedRef.current) {
      prevRankRef.current = currentRank;
      isInitializedRef.current = true;
      return;
    }

    // ランクアップ検知
    if (currentRank > prevRankRef.current && prevRankRef.current > 0) {
      const rankInfo = rankLabels[currentRank] || {
        icon: '⭐',
        label: `Rank ${currentRank}`
      };

      setRankUpInfo({
        newRank: currentRank,
        icon: rankInfo.icon,
        label: rankInfo.label
      });
      setShowAnimation(true);

    }

    // 現在のランクを記録
    prevRankRef.current = currentRank;
  }, [kodomi, thresholds, rankLabels]);

  const hideAnimation = () => {
    setShowAnimation(false);
    setRankUpInfo(null);
  };

  return {
    rankUpInfo,
    showAnimation,
    hideAnimation
  };
}
