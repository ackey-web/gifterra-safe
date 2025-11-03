/**
 * @file テナントスコアカードコンポーネント
 * @description 各テナント（応援先）ごとのスコアを表示するカード
 */

import React from 'react';

// ========================================
// 型定義
// ========================================

export interface TenantScoreData {
  tenantId: string;
  tenantName: string;
  tenantAvatar?: string;
  tenantBanner?: string;
  economicScore: number;
  resonanceScore: number;
  compositeScore: number;
  economicLevel: number;
  resonanceLevel: number;
  rank?: number; // このテナント内での順位
  isFavorite?: boolean;
}

export interface TenantScoreCardProps {
  tenant: TenantScoreData;
  onTenantClick?: (tenantId: string) => void;
  onFavoriteToggle?: (tenantId: string, isFavorite: boolean) => void;
  size?: 'small' | 'medium' | 'large';
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
// メインコンポーネント
// ========================================

export const TenantScoreCard: React.FC<TenantScoreCardProps> = ({
  tenant,
  onTenantClick,
  onFavoriteToggle,
  size = 'medium',
  className = '',
}) => {
  const {
    tenantId,
    tenantName,
    tenantAvatar,
    tenantBanner,
    economicScore,
    resonanceScore,
    compositeScore,
    economicLevel,
    resonanceLevel,
    rank,
    isFavorite = false,
  } = tenant;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.(tenantId, !isFavorite);
  };

  const handleCardClick = () => {
    onTenantClick?.(tenantId);
  };

  // サイズ設定
  const sizeClasses = {
    small: 'card-small',
    medium: 'card-medium',
    large: 'card-large',
  };

  return (
    <div
      className={`tenant-score-card ${sizeClasses[size]} ${className}`}
      onClick={handleCardClick}
    >
      <style jsx>{`
        .tenant-score-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .tenant-score-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          transform: translateY(-4px);
        }

        .tenant-score-card.favorite {
          border: 2px solid #ff6b6b;
        }

        /* バナー */
        .banner {
          width: 100%;
          height: 120px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow: hidden;
        }

        .banner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .banner-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
        }

        /* お気に入りボタン */
        .favorite-button {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 40px;
          height: 40px;
          border: none;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 2;
          backdrop-filter: blur(10px);
        }

        .favorite-button:hover {
          transform: scale(1.1);
          background: white;
        }

        .favorite-button.active {
          background: #ff6b6b;
          animation: heartbeat 0.5s ease;
        }

        @keyframes heartbeat {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        /* ランクバッジ */
        .rank-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border-radius: 12px;
          font-size: 14px;
          font-weight: bold;
          z-index: 2;
          backdrop-filter: blur(10px);
        }

        /* カードコンテンツ */
        .card-content {
          padding: 16px;
        }

        /* テナント情報 */
        .tenant-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          margin-top: -40px;
          position: relative;
          z-index: 1;
        }

        .tenant-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 32px;
          overflow: hidden;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
        }

        .tenant-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .tenant-name {
          flex: 1;
          font-size: 18px;
          font-weight: bold;
          color: #2d3748;
          margin-top: 24px;
        }

        /* スコアグリッド */
        .scores-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .score-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #f8f9fa;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .score-item:hover {
          background: #e9ecef;
          transform: scale(1.05);
        }

        .score-emoji {
          font-size: 24px;
        }

        .score-value {
          font-size: 18px;
          font-weight: bold;
          color: var(--score-color);
        }

        .score-label {
          font-size: 10px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        /* レベルバー */
        .level-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .level-bar-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .level-label {
          width: 80px;
          font-size: 12px;
          font-weight: 600;
          color: #4a5568;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .level-bar {
          flex: 1;
          height: 20px;
          background: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

        .level-fill {
          height: 100%;
          background: var(--level-color);
          border-radius: 10px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .level-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .level-text {
          min-width: 32px;
          text-align: right;
          font-size: 12px;
          font-weight: bold;
          color: #2d3748;
        }

        /* サイズバリエーション */
        .card-small .banner {
          height: 80px;
        }

        .card-small .tenant-avatar {
          width: 60px;
          height: 60px;
          font-size: 24px;
        }

        .card-small .tenant-name {
          font-size: 16px;
        }

        .card-small .score-emoji {
          font-size: 20px;
        }

        .card-small .score-value {
          font-size: 16px;
        }

        .card-large .banner {
          height: 160px;
        }

        .card-large .tenant-avatar {
          width: 100px;
          height: 100px;
          font-size: 40px;
        }

        .card-large .tenant-name {
          font-size: 22px;
        }

        /* モバイル対応 */
        @media (max-width: 640px) {
          .scores-grid {
            gap: 8px;
          }

          .score-item {
            padding: 10px 6px;
          }

          .score-emoji {
            font-size: 20px;
          }

          .score-value {
            font-size: 16px;
          }

          .score-label {
            font-size: 9px;
          }
        }
      `}</style>

      {/* バナー */}
      <div className="banner">
        {tenantBanner && <img src={tenantBanner} alt={tenantName} />}
        <div className="banner-overlay" />

        {/* ランクバッジ */}
        {rank && <div className="rank-badge">#{rank}</div>}

        {/* お気に入りボタン */}
        <button
          className={`favorite-button ${isFavorite ? 'active' : ''}`}
          onClick={handleFavoriteClick}
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
      </div>

      {/* カードコンテンツ */}
      <div className="card-content">
        {/* テナント情報 */}
        <div className="tenant-info">
          <div className="tenant-avatar">
            {tenantAvatar ? (
              <img src={tenantAvatar} alt={tenantName} />
            ) : (
              tenantName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="tenant-name">{tenantName}</div>
        </div>

        {/* スコアグリッド */}
        <div className="scores-grid">
          <div
            className="score-item"
            style={{ '--score-color': '#3498db' } as React.CSSProperties}
          >
            <div className="score-emoji">💸</div>
            <div className="score-value">{formatScore(economicScore)}</div>
            <div className="score-label">Economic</div>
          </div>

          <div
            className="score-item"
            style={{ '--score-color': '#e74c3c' } as React.CSSProperties}
          >
            <div className="score-emoji">🔥</div>
            <div className="score-value">{formatScore(resonanceScore)}</div>
            <div className="score-label">Resonance</div>
          </div>

          <div
            className="score-item"
            style={{ '--score-color': '#9b59b6' } as React.CSSProperties}
          >
            <div className="score-emoji">📊</div>
            <div className="score-value">{formatScore(compositeScore)}</div>
            <div className="score-label">Total</div>
          </div>
        </div>

        {/* レベルバー */}
        <div className="level-bars">
          <div className="level-bar-item">
            <div className="level-label">
              💸 <span>Economic</span>
            </div>
            <div className="level-bar">
              <div
                className="level-fill"
                style={
                  {
                    width: `${economicLevel}%`,
                    '--level-color': getLevelColor(economicLevel),
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="level-text">Lv.{economicLevel}</div>
          </div>

          <div className="level-bar-item">
            <div className="level-label">
              🔥 <span>Resonance</span>
            </div>
            <div className="level-bar">
              <div
                className="level-fill"
                style={
                  {
                    width: `${resonanceLevel}%`,
                    '--level-color': getLevelColor(resonanceLevel),
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="level-text">Lv.{resonanceLevel}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantScoreCard;
