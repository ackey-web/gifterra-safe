/**
 * @file ランキングパネルコンポーネント
 * @description 三つ葉タブで💸 Economic / 🔥 Resonance / 📊 Composite ランキングを表示
 */

import React, { useState, useMemo } from 'react';

// ========================================
// 型定義
// ========================================

export type RankingAxis = 'economic' | 'resonance' | 'composite';

export interface RankingEntry {
  rank: number;
  userId: string;
  address: string;
  displayName?: string;
  avatar?: string;
  economicScore: number;
  resonanceScore: number;
  compositeScore: number;
  economicLevel: number;
  resonanceLevel: number;
  badge?: string;
  title?: string;
}

export interface RankingPanelProps {
  economicRankings: RankingEntry[];
  resonanceRankings: RankingEntry[];
  compositeRankings: RankingEntry[];
  currentUserAddress?: string;
  onUserClick?: (userId: string) => void;
  className?: string;
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * スコアをフォーマット
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

/**
 * アドレスを短縮表示
 */
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * ランクに応じたメダル取得
 */
function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

/**
 * レベルから色を取得
 */
function getLevelColor(level: number): string {
  if (level >= 80) return '#FFD700';
  if (level >= 60) return '#FF6B35';
  if (level >= 40) return '#4ECDC4';
  if (level >= 20) return '#95E1D3';
  return '#A8DADC';
}

// ========================================
// タブ設定
// ========================================

const TABS = [
  {
    key: 'composite' as RankingAxis,
    label: 'Total',
    emoji: '📊',
    color: '#9b59b6',
  },
  {
    key: 'economic' as RankingAxis,
    label: 'Economic',
    emoji: '💸',
    color: '#3498db',
  },
  {
    key: 'resonance' as RankingAxis,
    label: 'Resonance',
    emoji: '🔥',
    color: '#e74c3c',
  },
];

// ========================================
// メインコンポーネント
// ========================================

export const RankingPanel: React.FC<RankingPanelProps> = ({
  economicRankings,
  resonanceRankings,
  compositeRankings,
  currentUserAddress,
  onUserClick,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<RankingAxis>('composite');

  // 現在のランキングデータ
  const currentRankings = useMemo(() => {
    switch (activeTab) {
      case 'economic':
        return economicRankings;
      case 'resonance':
        return resonanceRankings;
      default:
        return compositeRankings;
    }
  }, [activeTab, economicRankings, resonanceRankings, compositeRankings]);

  // スコアキー取得
  const getScoreKey = (axis: RankingAxis): keyof RankingEntry => {
    switch (axis) {
      case 'economic':
        return 'economicScore';
      case 'resonance':
        return 'resonanceScore';
      default:
        return 'compositeScore';
    }
  };

  // レベルキー取得
  const getLevelKey = (axis: RankingAxis): keyof RankingEntry => {
    switch (axis) {
      case 'economic':
        return 'economicLevel';
      case 'resonance':
        return 'resonanceLevel';
      default:
        return 'economicLevel'; // Compositeはeconomicを使用
    }
  };

  return (
    <div className={`ranking-panel ${className}`}>
      <style jsx>{`
        .ranking-panel {
          width: 100%;
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        /* タブヘッダー */
        .tabs-header {
          display: flex;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 4px;
          gap: 4px;
        }

        .tab-button {
          flex: 1;
          padding: 16px 12px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .tab-button:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        .tab-button.active {
          background: white;
          color: var(--tab-color);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .tab-emoji {
          font-size: 24px;
        }

        .tab-label {
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        /* ランキングリスト */
        .ranking-list {
          padding: 16px;
          max-height: 600px;
          overflow-y: auto;
        }

        /* スクロールバーカスタマイズ */
        .ranking-list::-webkit-scrollbar {
          width: 6px;
        }

        .ranking-list::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .ranking-list::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }

        .ranking-list::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        /* ランキングアイテム */
        .ranking-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 8px;
          background: #f8f9fa;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
        }

        .ranking-item:hover {
          background: #e9ecef;
          transform: translateX(4px);
        }

        .ranking-item.current-user {
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-color: #667eea;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .ranking-item.top-3 {
          background: linear-gradient(135deg, #ffd70022, #ff8c0022);
        }

        /* ランク表示 */
        .rank-badge {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .rank-badge.top-3 {
          font-size: 28px;
          background: transparent;
          box-shadow: none;
        }

        /* アバター */
        .avatar {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 18px;
          overflow: hidden;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ユーザー情報 */
        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .user-name {
          font-weight: 600;
          font-size: 16px;
          color: #2d3748;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .user-badge {
          font-size: 16px;
        }

        .user-title {
          display: inline-block;
          padding: 2px 8px;
          background: var(--tab-color);
          color: white;
          border-radius: 8px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .user-address {
          font-size: 12px;
          color: #718096;
          font-family: monospace;
        }

        /* スコア表示 */
        .score-display {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .score-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--tab-color);
          letter-spacing: -0.5px;
        }

        .level-badge {
          padding: 2px 8px;
          background: var(--level-color);
          color: white;
          border-radius: 8px;
          font-size: 12px;
          font-weight: bold;
        }

        /* 空状態 */
        .empty-state {
          padding: 48px 24px;
          text-align: center;
          color: #718096;
        }

        .empty-emoji {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 600;
        }

        /* モバイル対応 */
        @media (max-width: 640px) {
          .tab-button {
            padding: 12px 8px;
            font-size: 12px;
          }

          .tab-emoji {
            font-size: 20px;
          }

          .tab-label {
            font-size: 10px;
          }

          .ranking-list {
            padding: 12px;
            max-height: 500px;
          }

          .ranking-item {
            padding: 10px;
            gap: 10px;
          }

          .rank-badge,
          .avatar {
            width: 40px;
            height: 40px;
            font-size: 16px;
          }

          .user-name {
            font-size: 14px;
          }

          .score-value {
            font-size: 18px;
          }
        }
      `}</style>

      {/* タブヘッダー */}
      <div className="tabs-header">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ '--tab-color': tab.color } as React.CSSProperties}
          >
            <span className="tab-emoji">{tab.emoji}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ランキングリスト */}
      <div className="ranking-list">
        {currentRankings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🏆</div>
            <div className="empty-text">まだランキングデータがありません</div>
          </div>
        ) : (
          currentRankings.map((entry) => {
            const scoreKey = getScoreKey(activeTab);
            const levelKey = getLevelKey(activeTab);
            const score = entry[scoreKey] as number;
            const level = entry[levelKey] as number;
            const isCurrentUser =
              currentUserAddress &&
              entry.address.toLowerCase() === currentUserAddress.toLowerCase();
            const isTop3 = entry.rank <= 3;

            return (
              <div
                key={entry.userId}
                className={`ranking-item ${isCurrentUser ? 'current-user' : ''} ${
                  isTop3 ? 'top-3' : ''
                }`}
                onClick={() => onUserClick?.(entry.userId)}
                style={
                  {
                    '--tab-color': TABS.find((t) => t.key === activeTab)?.color,
                    '--level-color': getLevelColor(level),
                  } as React.CSSProperties
                }
              >
                {/* ランク */}
                <div className={`rank-badge ${isTop3 ? 'top-3' : ''}`}>
                  {getRankMedal(entry.rank)}
                </div>

                {/* アバター */}
                <div className="avatar">
                  {entry.avatar ? (
                    <img src={entry.avatar} alt={entry.displayName || 'User'} />
                  ) : (
                    entry.displayName?.charAt(0).toUpperCase() || '?'
                  )}
                </div>

                {/* ユーザー情報 */}
                <div className="user-info">
                  <div className="user-name">
                    {entry.badge && <span className="user-badge">{entry.badge}</span>}
                    <span>{entry.displayName || shortenAddress(entry.address)}</span>
                    {entry.title && <span className="user-title">{entry.title}</span>}
                  </div>
                  <div className="user-address">{shortenAddress(entry.address)}</div>
                </div>

                {/* スコア */}
                <div className="score-display">
                  <div className="score-value">{formatScore(score)}</div>
                  <div className="level-badge">Lv.{level}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RankingPanel;
