/**
 * @file 二軸スコア表示コンポーネント
 * @description 💸 Economic / 🔥 Resonance 二軸スコアを視覚的に表示
 */

import React, { useMemo } from 'react';

// ========================================
// 型定義
// ========================================

export interface DualAxisTankProps {
  // Economic軸
  economicScore: number;
  economicLevel: number;
  economicDisplayLevel: number;

  // Resonance軸
  resonanceScore: number;
  resonanceLevel: number;
  resonanceDisplayLevel: number;
  resonanceStreak?: number;

  // オプション
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * レベルから色を取得（グラデーション）
 */
function getLevelColor(level: number): string {
  if (level >= 80) return '#FFD700'; // Gold
  if (level >= 60) return '#FF6B35'; // Orange
  if (level >= 40) return '#4ECDC4'; // Cyan
  if (level >= 20) return '#95E1D3'; // Light cyan
  return '#A8DADC'; // Very light cyan
}

/**
 * レベルからバッジを取得
 */
function getLevelBadge(level: number): string {
  if (level >= 90) return '🏆'; // Legend
  if (level >= 80) return '💎'; // Diamond
  if (level >= 70) return '👑'; // Crown
  if (level >= 60) return '⭐'; // Star
  if (level >= 50) return '🔥'; // Fire
  if (level >= 40) return '💪'; // Strong
  if (level >= 30) return '🌟'; // Shining
  if (level >= 20) return '✨'; // Sparkle
  if (level >= 10) return '🌱'; // Growing
  return '🥚'; // Beginner
}

/**
 * スコアをフォーマット（k, M単位）
 */
function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

// ========================================
// メインコンポーネント
// ========================================

export const DualAxisTank: React.FC<DualAxisTankProps> = ({
  economicScore,
  economicLevel,
  economicDisplayLevel,
  resonanceScore,
  resonanceLevel,
  resonanceDisplayLevel,
  resonanceStreak = 0,
  showDetails = true,
  size = 'medium',
  className = '',
}) => {
  // サイズ設定
  const sizeConfig = useMemo(() => {
    switch (size) {
      case 'small':
        return { height: 120, width: 60, fontSize: 12 };
      case 'large':
        return { height: 240, width: 120, fontSize: 18 };
      default:
        return { height: 180, width: 90, fontSize: 14 };
    }
  }, [size]);

  // 色計算
  const economicColor = getLevelColor(economicLevel);
  const resonanceColor = getLevelColor(resonanceLevel);

  // バッジ計算
  const economicBadge = getLevelBadge(economicDisplayLevel);
  const resonanceBadge = getLevelBadge(resonanceDisplayLevel);

  return (
    <div className={`dual-axis-tank ${className}`}>
      <style jsx>{`
        .dual-axis-tank {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        /* 軸コンテナ */
        .axis-container {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(255, 255, 255, 0.1);
          padding: 16px;
          border-radius: 16px;
          backdrop-filter: blur(10px);
        }

        /* タンク本体 */
        .tank-wrapper {
          position: relative;
          width: ${sizeConfig.width}px;
          height: ${sizeConfig.height}px;
          flex-shrink: 0;
        }

        .tank-container {
          position: relative;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        /* 液体アニメーション */
        .liquid-fill {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          background: linear-gradient(
            180deg,
            var(--liquid-color-light),
            var(--liquid-color)
          );
          transition: height 1s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 0 0 10px 10px;
        }

        .liquid-fill::before {
          content: '';
          position: absolute;
          top: -10px;
          left: 0;
          width: 100%;
          height: 20px;
          background: radial-gradient(
            ellipse at center,
            var(--liquid-color-light) 0%,
            transparent 70%
          );
          animation: wave 2s ease-in-out infinite;
        }

        @keyframes wave {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        /* 炎アニメーション（Resonance用） */
        .flame-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .flame {
          font-size: ${sizeConfig.height * 0.6}px;
          filter: drop-shadow(0 0 10px var(--flame-color));
          animation: flicker 1.5s ease-in-out infinite;
        }

        @keyframes flicker {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }

        /* レベル表示 */
        .level-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: ${sizeConfig.fontSize - 2}px;
          font-weight: bold;
          backdrop-filter: blur(5px);
          z-index: 2;
        }

        .level-emoji {
          position: absolute;
          top: 8px;
          left: 8px;
          font-size: ${sizeConfig.fontSize + 4}px;
          z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        /* 詳細情報 */
        .axis-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: white;
        }

        .axis-title {
          font-size: ${sizeConfig.fontSize + 4}px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .axis-score {
          font-size: ${sizeConfig.fontSize + 8}px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .axis-label {
          font-size: ${sizeConfig.fontSize - 2}px;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .streak-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: ${sizeConfig.fontSize - 2}px;
          font-weight: bold;
          margin-top: 4px;
        }

        .streak-badge.active {
          background: linear-gradient(90deg, #ff6b6b, #ff8e53);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        /* モバイル対応 */
        @media (max-width: 640px) {
          .dual-axis-tank {
            padding: 16px;
            gap: 16px;
          }

          .axis-container {
            padding: 12px;
            gap: 12px;
          }
        }
      `}</style>

      {/* 💸 Economic軸 */}
      <div className="axis-container">
        <div className="tank-wrapper">
          <div className="tank-container">
            {/* レベルバッジ */}
            <div className="level-badge">Lv.{economicDisplayLevel}</div>
            <div className="level-emoji">{economicBadge}</div>

            {/* 液体 */}
            <div
              className="liquid-fill"
              style={
                {
                  height: `${economicLevel}%`,
                  '--liquid-color': economicColor,
                  '--liquid-color-light': `${economicColor}dd`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>

        {showDetails && (
          <div className="axis-details">
            <div className="axis-title">
              💸 <span>Economic</span>
            </div>
            <div className="axis-score">{formatScore(economicScore)}</div>
            <div className="axis-label">金銭的貢献</div>
          </div>
        )}
      </div>

      {/* 🔥 Resonance軸 */}
      <div className="axis-container">
        <div className="tank-wrapper">
          <div className="tank-container">
            {/* レベルバッジ */}
            <div className="level-badge">Lv.{resonanceDisplayLevel}</div>
            <div className="level-emoji">{resonanceBadge}</div>

            {/* 炎 */}
            <div className="flame-container">
              <div
                className="flame"
                style={
                  {
                    '--flame-color': resonanceColor,
                    opacity: Math.max(0.3, resonanceLevel / 100),
                  } as React.CSSProperties
                }
              >
                🔥
              </div>
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="axis-details">
            <div className="axis-title">
              🔥 <span>Resonance</span>
            </div>
            <div className="axis-score">{formatScore(resonanceScore)}</div>
            <div className="axis-label">継続的熱量</div>

            {/* ストリークバッジ */}
            {resonanceStreak > 0 && (
              <div className={`streak-badge ${resonanceStreak >= 7 ? 'active' : ''}`}>
                ⚡ {resonanceStreak}日連続
                {resonanceStreak >= 7 && ` (+${Math.floor(resonanceStreak / 7) * 10}%)`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DualAxisTank;
