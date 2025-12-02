// src/hooks/useRankThresholds.ts
// テナントのランク閾値設定を取得するHook

import { useState, useEffect } from 'react';

export interface RankThresholds {
  [rankLevel: number]: number; // { 1: 100, 2: 300, 3: 600, ... }
}

/**
 * localStorageからテナントのランク閾値設定を取得
 * @param tenantAddress テナントのウォレットアドレス
 */
export function useRankThresholds(tenantAddress: string | undefined) {
  const [thresholds, setThresholds] = useState<RankThresholds>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantAddress) {
      setThresholds({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // localStorageキー: tip-rank-thresholds-{address}
      const storageKey = `tip-rank-thresholds-${tenantAddress.toLowerCase()}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored);
        setThresholds(parsed);
      } else {
        // デフォルト値（ContributionGaugeと同じ）
        setThresholds({
          1: 100,
          2: 300,
          3: 600,
          4: 1000,
          5: 1500,
        });
      }
    } catch (err) {
      console.error('❌ ランク閾値の取得エラー:', err);
      // エラー時はデフォルト値
      setThresholds({
        1: 100,
        2: 300,
        3: 600,
        4: 1000,
        5: 1500,
      });
    } finally {
      setLoading(false);
    }
  }, [tenantAddress]);

  return { thresholds, loading };
}

/**
 * 現在のkodomi値から次のランクまでの情報を計算
 */
export function calculateNextRank(kodomi: number, thresholds: RankThresholds) {
  // 閾値を昇順にソート
  const sortedThresholds = Object.entries(thresholds)
    .map(([rank, threshold]) => ({ rank: Number(rank), threshold }))
    .sort((a, b) => a.threshold - b.threshold);

  // 現在のランクを特定
  let currentRank = 0;
  let currentThreshold = 0;

  for (const { rank, threshold } of sortedThresholds) {
    if (kodomi >= threshold) {
      currentRank = rank;
      currentThreshold = threshold;
    } else {
      break;
    }
  }

  // 次のランクを特定
  const nextRankInfo = sortedThresholds.find(({ threshold }) => threshold > kodomi);

  if (!nextRankInfo) {
    // 最高ランクに到達済み
    return {
      currentRank,
      currentThreshold,
      nextRank: null,
      nextThreshold: null,
      remaining: 0,
      progress: 100,
    };
  }

  const remaining = nextRankInfo.threshold - kodomi;
  const rangeStart = currentThreshold;
  const rangeEnd = nextRankInfo.threshold;
  const progress = ((kodomi - rangeStart) / (rangeEnd - rangeStart)) * 100;

  return {
    currentRank,
    currentThreshold,
    nextRank: nextRankInfo.rank,
    nextThreshold: nextRankInfo.threshold,
    remaining,
    progress: Math.min(100, Math.max(0, progress)),
  };
}
