/**
 * @file バッジ・実績システムコンポーネント
 * @description ユーザーのバッジ、実績、ストリーク、称号を表示
 */

import React, { useMemo } from 'react';

// ========================================
// 型定義
// ========================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // 0-100
  requirement?: string;
}

export interface BadgeSystemProps {
  economicLevel: number;
  resonanceLevel: number;
  economicScore: number;
  resonanceScore: number;
  streak: number;
  longestStreak: number;
  totalTips: number;
  achievements?: Achievement[];
  className?: string;
}

// ========================================
// バッジ定義
// ========================================

interface Badge {
  level: number;
  emoji: string;
  name: string;
  color: string;
}

const ECONOMIC_BADGES: Badge[] = [
  { level: 0, emoji: '🥚', name: 'ビギナー', color: '#A8DADC' },
  { level: 10, emoji: '🌱', name: 'サポーター', color: '#95E1D3' },
  { level: 20, emoji: '✨', name: 'コントリビューター', color: '#4ECDC4' },
  { level: 30, emoji: '🌟', name: 'パトロン', color: '#45B7D1' },
  { level: 40, emoji: '💪', name: 'ベネファクター', color: '#3498db' },
  { level: 50, emoji: '🔥', name: 'メセナ', color: '#9b59b6' },
  { level: 60, emoji: '⭐', name: 'フィランソロピスト', color: '#FF6B35' },
  { level: 70, emoji: '👑', name: 'マエストロ', color: '#f39c12' },
  { level: 80, emoji: '💎', name: 'レジェンド', color: '#FFD700' },
  { level: 90, emoji: '🏆', name: 'インモータル', color: '#e74c3c' },
];

const RESONANCE_BADGES: Badge[] = [
  { level: 0, emoji: '❄️', name: 'クール', color: '#A8DADC' },
  { level: 10, emoji: '🌸', name: 'ウォーム', color: '#95E1D3' },
  { level: 20, emoji: '💧', name: 'エンゲージド', color: '#4ECDC4' },
  { level: 30, emoji: '🌊', name: 'コミッテッド', color: '#45B7D1' },
  { level: 40, emoji: '⚡', name: 'パッショネート', color: '#3498db' },
  { level: 50, emoji: '🔥', name: 'ファナティック', color: '#9b59b6' },
  { level: 60, emoji: '💥', name: 'フィーバー', color: '#FF6B35' },
  { level: 70, emoji: '🌟', name: 'インフレイムド', color: '#f39c12' },
  { level: 80, emoji: '💫', name: 'インフェルノ', color: '#FFD700' },
  { level: 90, emoji: '🌠', name: 'スーパーノヴァ', color: '#e74c3c' },
];

// ========================================
// ヘルパー関数
// ========================================

/**
 * レベルに応じたバッジを取得
 */
function getBadgeForLevel(level: number, badges: Badge[]): Badge {
  const sortedBadges = [...badges].sort((a, b) => b.level - a.level);
  return sortedBadges.find((badge) => level >= badge.level) || badges[0];
}

/**
 * 次のバッジまでの進捗を計算
 */
function getProgressToNextBadge(level: number, badges: Badge[]): {
  current: Badge;
  next: Badge | null;
  progress: number;
} {
  const current = getBadgeForLevel(level, badges);
  const sortedBadges = [...badges].sort((a, b) => a.level - b.level);
  const currentIndex = sortedBadges.findIndex((b) => b.level === current.level);
  const next = sortedBadges[currentIndex + 1] || null;

  if (!next) {
    return { current, next: null, progress: 100 };
  }

  const progress = ((level - current.level) / (next.level - current.level)) * 100;
  return { current, next, progress };
}

/**
 * ストリークボーナスを計算
 */
function getStreakBonus(streak: number): number {
  return Math.floor(streak / 7) * 10;
}

// ========================================
// メインコンポーネント
// ========================================

export const BadgeSystem: React.FC<BadgeSystemProps> = ({
  economicLevel,
  resonanceLevel,
  economicScore,
  resonanceScore,
  streak,
  longestStreak,
  totalTips,
  achievements = [],
  className = '',
}) => {
  // バッジ情報計算
  const economicBadgeInfo = useMemo(
    () => getProgressToNextBadge(economicLevel, ECONOMIC_BADGES),
    [economicLevel]
  );

  const resonanceBadgeInfo = useMemo(
    () => getProgressToNextBadge(resonanceLevel, RESONANCE_BADGES),
    [resonanceLevel]
  );

  // ストリークボーナス
  const streakBonus = getStreakBonus(streak);

  // アンロック済み実績数
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;

  return (
    <div className={`badge-system ${className}`}>
      <style jsx>{`
        .badge-system {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* セクションヘッダー */
        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 12px;
        }

        .section-emoji {
          font-size: 24px;
        }

        /* バッジカード */
        .badge-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* バッジディスプレイ */
        .badge-display {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .badge-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--badge-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          position: relative;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%,
          100% {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          }
          50% {
            box-shadow: 0 4px 24px var(--badge-color);
          }
        }

        .badge-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .badge-name {
          font-size: 24px;
          font-weight: bold;
          color: var(--badge-color);
        }

        .badge-level {
          font-size: 16px;
          color: #718096;
          font-weight: 600;
        }

        /* プログレスバー */
        .progress-section {
          margin-top: 12px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
          color: #4a5568;
        }

        .progress-bar {
          height: 24px;
          background: #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--badge-color), var(--badge-color-light));
          border-radius: 12px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .next-badge-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f7fafc;
          border-radius: 8px;
          margin-top: 8px;
          font-size: 14px;
          color: #4a5568;
        }

        .next-badge-emoji {
          font-size: 24px;
        }

        /* ストリーク表示 */
        .streak-display {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .streak-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          background: linear-gradient(135deg, #ff6b6b22, #ff8e5322);
          border-radius: 12px;
          border: 2px solid transparent;
        }

        .streak-item.active {
          border-color: #ff6b6b;
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

        .streak-emoji {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .streak-value {
          font-size: 28px;
          font-weight: bold;
          color: #ff6b6b;
        }

        .streak-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .streak-bonus {
          margin-top: 4px;
          padding: 4px 8px;
          background: #ff6b6b;
          color: white;
          border-radius: 8px;
          font-size: 11px;
          font-weight: bold;
        }

        /* 実績グリッド */
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
        }

        .achievement-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .achievement-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .achievement-item.locked {
          opacity: 0.4;
          cursor: default;
        }

        .achievement-item.unlocked {
          border-color: #48bb78;
          background: linear-gradient(135deg, #48bb7822, #38a16922);
        }

        .achievement-emoji {
          font-size: 32px;
          margin-bottom: 8px;
          filter: grayscale(1);
        }

        .achievement-item.unlocked .achievement-emoji {
          filter: none;
        }

        .achievement-name {
          font-size: 11px;
          text-align: center;
          color: #4a5568;
          font-weight: 600;
        }

        .achievement-progress {
          position: absolute;
          bottom: 4px;
          left: 4px;
          right: 4px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .achievement-progress-fill {
          height: 100%;
          background: #48bb78;
          border-radius: 2px;
          transition: width 0.5s ease;
        }

        /* 統計サマリー */
        .stats-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-radius: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
        }

        .stat-label {
          font-size: 11px;
          color: #718096;
          text-transform: uppercase;
          text-align: center;
        }

        /* モバイル対応 */
        @media (max-width: 640px) {
          .badge-icon {
            width: 64px;
            height: 64px;
            font-size: 36px;
          }

          .badge-name {
            font-size: 20px;
          }

          .achievements-grid {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          }

          .stats-summary {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>

      {/* 統計サマリー */}
      <div className="stats-summary">
        <div className="stat-item">
          <div className="stat-value">{totalTips}</div>
          <div className="stat-label">Total Tips</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Current Streak</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{unlockedAchievements}</div>
          <div className="stat-label">Achievements</div>
        </div>
      </div>

      {/* 💸 Economicバッジ */}
      <div className="badge-card">
        <div className="section-header">
          <span className="section-emoji">💸</span>
          <span>Economic Badge</span>
        </div>

        <div className="badge-display">
          <div
            className="badge-icon"
            style={
              {
                '--badge-color': economicBadgeInfo.current.color,
              } as React.CSSProperties
            }
          >
            {economicBadgeInfo.current.emoji}
          </div>

          <div className="badge-info">
            <div
              className="badge-name"
              style={{ '--badge-color': economicBadgeInfo.current.color } as React.CSSProperties}
            >
              {economicBadgeInfo.current.name}
            </div>
            <div className="badge-level">Level {economicLevel}</div>
          </div>
        </div>

        {economicBadgeInfo.next && (
          <div className="progress-section">
            <div className="progress-label">
              <span>次のバッジまで</span>
              <span>{Math.round(economicBadgeInfo.progress)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={
                  {
                    width: `${economicBadgeInfo.progress}%`,
                    '--badge-color': economicBadgeInfo.current.color,
                    '--badge-color-light': `${economicBadgeInfo.current.color}cc`,
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="next-badge-preview">
              <span className="next-badge-emoji">{economicBadgeInfo.next.emoji}</span>
              <span>
                {economicBadgeInfo.next.name} (Lv.{economicBadgeInfo.next.level})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 Resonanceバッジ */}
      <div className="badge-card">
        <div className="section-header">
          <span className="section-emoji">🔥</span>
          <span>Resonance Badge</span>
        </div>

        <div className="badge-display">
          <div
            className="badge-icon"
            style={
              {
                '--badge-color': resonanceBadgeInfo.current.color,
              } as React.CSSProperties
            }
          >
            {resonanceBadgeInfo.current.emoji}
          </div>

          <div className="badge-info">
            <div
              className="badge-name"
              style={{ '--badge-color': resonanceBadgeInfo.current.color } as React.CSSProperties}
            >
              {resonanceBadgeInfo.current.name}
            </div>
            <div className="badge-level">Level {resonanceLevel}</div>
          </div>
        </div>

        {resonanceBadgeInfo.next && (
          <div className="progress-section">
            <div className="progress-label">
              <span>次のバッジまで</span>
              <span>{Math.round(resonanceBadgeInfo.progress)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={
                  {
                    width: `${resonanceBadgeInfo.progress}%`,
                    '--badge-color': resonanceBadgeInfo.current.color,
                    '--badge-color-light': `${resonanceBadgeInfo.current.color}cc`,
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="next-badge-preview">
              <span className="next-badge-emoji">{resonanceBadgeInfo.next.emoji}</span>
              <span>
                {resonanceBadgeInfo.next.name} (Lv.{resonanceBadgeInfo.next.level})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ⚡ ストリーク */}
      <div className="badge-card">
        <div className="section-header">
          <span className="section-emoji">⚡</span>
          <span>Streak</span>
        </div>

        <div className="streak-display">
          <div className={`streak-item ${streak > 0 ? 'active' : ''}`}>
            <div className="streak-emoji">🔥</div>
            <div className="streak-value">{streak}</div>
            <div className="streak-label">Current</div>
            {streakBonus > 0 && <div className="streak-bonus">+{streakBonus}% Bonus</div>}
          </div>

          <div className="streak-item">
            <div className="streak-emoji">🏆</div>
            <div className="streak-value">{longestStreak}</div>
            <div className="streak-label">Best</div>
          </div>
        </div>
      </div>

      {/* 🏅 実績 */}
      {achievements.length > 0 && (
        <div className="badge-card">
          <div className="section-header">
            <span className="section-emoji">🏅</span>
            <span>
              Achievements ({unlockedAchievements}/{achievements.length})
            </span>
          </div>

          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                title={achievement.description}
              >
                <div className="achievement-emoji">{achievement.emoji}</div>
                <div className="achievement-name">{achievement.name}</div>

                {!achievement.unlocked && achievement.progress !== undefined && (
                  <div className="achievement-progress">
                    <div
                      className="achievement-progress-fill"
                      style={{ width: `${achievement.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeSystem;
