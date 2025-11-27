// src/components/ContributionGauge.tsx
// ユーザーごとの貢献度（kodomi）を可視化するゲージコンポーネント

import { useMemo } from 'react';
import { useRankThresholds, calculateNextRank } from '../hooks/useRankThresholds';

interface ContributionGaugeProps {
  kodomi: number;
  tenantAddress?: string; // テナントアドレス（閾値取得用）
  isMobile?: boolean;
}

/**
 * Kodomiスコアからレベルと進捗を計算
 * レベル1: 0-99
 * レベル2: 100-299
 * レベル3: 300-599
 * レベル4: 600-999
 * レベル5: 1000+
 */
function calculateLevel(kodomi: number): { level: number; progress: number; nextLevelThreshold: number } {
  const thresholds = [0, 100, 300, 600, 1000];

  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (kodomi >= thresholds[i]) {
      const level = i + 1;
      const currentThreshold = thresholds[i];
      const nextThreshold = i < thresholds.length - 1 ? thresholds[i + 1] : thresholds[i] + 500;
      const progressInLevel = kodomi - currentThreshold;
      const levelRange = nextThreshold - currentThreshold;
      const progress = Math.min(100, (progressInLevel / levelRange) * 100);

      return { level, progress, nextLevelThreshold: nextThreshold };
    }
  }

  return { level: 1, progress: 0, nextLevelThreshold: 100 };
}

export function ContributionGauge({ kodomi, tenantAddress, isMobile = false }: ContributionGaugeProps) {
  // テナントの閾値設定を取得
  const { thresholds } = useRankThresholds(tenantAddress);

  // 次のランクまでの情報を計算
  const nextRankInfo = useMemo(() => {
    if (Object.keys(thresholds).length === 0) {
      // 閾値がまだ読み込まれていない場合はデフォルト値を使用
      return calculateNextRank(kodomi, {
        1: 100,
        2: 300,
        3: 600,
        4: 1000,
        5: 1500,
      });
    }
    return calculateNextRank(kodomi, thresholds);
  }, [kodomi, thresholds]);

  // 後方互換性のため、従来のレベル計算も保持
  const { level, progress } = useMemo(() => calculateLevel(kodomi), [kodomi]);

  // レベルに応じた色を決定
  const getLevelColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#94a3b8'; // Gray
      case 2: return '#3b82f6'; // Blue
      case 3: return '#8b5cf6'; // Purple
      case 4: return '#f59e0b'; // Orange
      case 5: return '#ef4444'; // Red
      default: return '#94a3b8';
    }
  };

  const levelColor = getLevelColor(level);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '10px' : '14px',
        padding: isMobile ? '10px 16px' : '12px 20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 100%)',
        borderRadius: 12,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* 炎アイコン */}
      <span
        style={{
          fontSize: isMobile ? 22 : 26,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
        }}
      >
        🔥
      </span>

      {/* KODOMI ラベル */}
      <div
        style={{
          fontSize: isMobile ? 10 : 11,
          fontWeight: 800,
          color: 'rgba(255, 255, 255, 0.6)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
        }}
      >
        KODOMI
      </div>

      {/* レベル表示とプログレスバー */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: isMobile ? 140 : 180,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            color: levelColor,
            letterSpacing: '0.5px',
            textShadow: `0 0 8px ${levelColor}80, 0 2px 4px rgba(0, 0, 0, 0.5)`,
          }}
        >
          Lv.{level}
        </div>

        {/* プログレスバー（立体的デザイン） */}
        <div
          style={{
            width: '100%',
            height: isMobile ? 10 : 12,
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: 6,
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}
        >
          {/* プログレスバーの内側（グロー効果） */}
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(180deg, ${levelColor} 0%, ${levelColor}cc 50%, ${levelColor}99 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 12px ${levelColor}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
              position: 'relative',
              borderRadius: 4,
            }}
          >
            {/* ハイライト効果 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40%',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 100%)',
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
        </div>
      </div>

      {/* Kodomiスコア表示 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            letterSpacing: '0.3px',
          }}
        >
          {kodomi}pt
        </div>

        {/* 次のランクまでの必要ポイント */}
        {nextRankInfo.nextRank !== null && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.6,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            次のランクまで {nextRankInfo.remaining}pt
          </div>
        )}

        {/* 最高ランク到達時 */}
        {nextRankInfo.nextRank === null && (
          <div
            style={{
              fontSize: isMobile ? 9 : 10,
              opacity: 0.7,
              color: '#fbbf24',
              textShadow: '0 0 6px rgba(251, 191, 36, 0.5), 0 1px 2px rgba(0, 0, 0, 0.5)',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            ✨ MAX
          </div>
        )}
      </div>
    </div>
  );
}
