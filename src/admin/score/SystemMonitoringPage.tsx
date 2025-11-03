/**
 * @file システムモニタリングページ
 * @description Admin用：スコアシステムの稼働状況をリアルタイム監視
 */

import React, { useState, useEffect } from 'react';

// ========================================
// 型定義
// ========================================

interface SystemStats {
  totalUsers: number;
  totalTransactions: number;
  lastProcessedBlock: number;
  indexerStatus: 'running' | 'stopped' | 'error';
  apiStatus: 'healthy' | 'unhealthy';
  lastUpdated: string;
}

interface ScoreDistribution {
  economicAverage: number;
  economicMedian: number;
  resonanceAverage: number;
  resonanceMedian: number;
  compositeAverage: number;
  compositeMedian: number;
}

interface RecentActivity {
  id: string;
  type: 'score_update' | 'params_change' | 'token_added';
  description: string;
  timestamp: string;
}

// ========================================
// メインコンポーネント
// ========================================

export const SystemMonitoringPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalTransactions: 0,
    lastProcessedBlock: 0,
    indexerStatus: 'running',
    apiStatus: 'healthy',
    lastUpdated: new Date().toISOString(),
  });

  const [distribution, setDistribution] = useState<ScoreDistribution>({
    economicAverage: 0,
    economicMedian: 0,
    resonanceAverage: 0,
    resonanceMedian: 0,
    compositeAverage: 0,
    compositeMedian: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // データ取得
  useEffect(() => {
    fetchStats();
    fetchDistribution();
    fetchRecentActivity();

    // 自動更新
    const interval = autoRefresh
      ? setInterval(() => {
          fetchStats();
          fetchRecentActivity();
        }, 10000) // 10秒ごと
      : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchStats = async () => {
    try {
      // TODO: 実際のAPIから取得
      // モックデータ
      setStats({
        totalUsers: 1250,
        totalTransactions: 5430,
        lastProcessedBlock: 12345678,
        indexerStatus: 'running',
        apiStatus: 'healthy',
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchDistribution = async () => {
    try {
      // TODO: 実際のAPIから取得
      setDistribution({
        economicAverage: 45000,
        economicMedian: 30000,
        resonanceAverage: 150,
        resonanceMedian: 100,
        compositeAverage: 60000,
        compositeMedian: 40000,
      });
    } catch (error) {
      console.error('Failed to fetch distribution:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // TODO: 実際のAPIから取得
      setRecentActivity([
        {
          id: '1',
          type: 'score_update',
          description: 'User 0x742d...bEb スコア更新',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'params_change',
          description: 'パラメータ変更: Economic 100 → 120',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'healthy':
        return '#48bb78';
      case 'stopped':
        return '#f6ad55';
      case 'error':
      case 'unhealthy':
        return '#fc8181';
      default:
        return '#a0aec0';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'running':
      case 'healthy':
        return '✅';
      case 'stopped':
        return '⏸️';
      case 'error':
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="system-monitoring-page">
      <style jsx>{`
        .system-monitoring-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        /* ヘッダー */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .header-left {
          flex: 1;
        }

        .page-title {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 14px;
          color: #718096;
        }

        .refresh-control {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .refresh-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-toggle:hover {
          border-color: #667eea;
        }

        .refresh-toggle input {
          cursor: pointer;
        }

        /* グリッドレイアウト */
        .monitoring-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        /* カード */
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .card.full-width {
          grid-column: 1 / -1;
        }

        .card-title {
          font-size: 16px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ステータスカード */
        .status-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-radius: 12px;
        }

        .status-emoji {
          font-size: 48px;
        }

        .status-label {
          font-size: 14px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-value {
          font-size: 18px;
          font-weight: bold;
          padding: 6px 16px;
          border-radius: 16px;
          background: white;
        }

        /* 統計カード */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .stat-item {
          text-align: center;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
        }

        .stat-label {
          font-size: 12px;
          color: #718096;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #2d3748;
        }

        .stat-unit {
          font-size: 12px;
          color: #a0aec0;
          margin-left: 4px;
        }

        /* アクティビティ */
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
        }

        .activity-item {
          padding: 12px;
          background: #f7fafc;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }

        .activity-type {
          font-size: 12px;
          color: #667eea;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .activity-description {
          font-size: 14px;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .activity-timestamp {
          font-size: 12px;
          color: #a0aec0;
        }

        /* 分布チャート（簡易版） */
        .distribution-item {
          margin-bottom: 20px;
        }

        .distribution-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
          color: #4a5568;
        }

        .distribution-bar {
          height: 32px;
          background: #e2e8f0;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
        }

        .distribution-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--fill-color), var(--fill-color-light));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
          transition: width 1s ease;
        }

        /* ボタン */
        .button {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        /* モバイル対応 */
        @media (max-width: 1024px) {
          .monitoring-grid {
            grid-template-columns: 1fr;
          }

          .stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ヘッダー */}
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">📊 システムモニタリング</h1>
          <p className="page-description">
            スコアシステムの稼働状況をリアルタイムで監視
          </p>
        </div>

        <div className="refresh-control">
          <label className="refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自動更新
          </label>
          <button className="button" onClick={fetchStats}>
            🔄 更新
          </button>
        </div>
      </div>

      {/* ステータス */}
      <div className="monitoring-grid">
        <div className="card">
          <div className="status-card">
            <div className="status-emoji">{getStatusEmoji(stats.indexerStatus)}</div>
            <div className="status-label">Indexer Status</div>
            <div
              className="status-value"
              style={{ color: getStatusColor(stats.indexerStatus) }}
            >
              {stats.indexerStatus}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="status-card">
            <div className="status-emoji">{getStatusEmoji(stats.apiStatus)}</div>
            <div className="status-label">API Status</div>
            <div className="status-value" style={{ color: getStatusColor(stats.apiStatus) }}>
              {stats.apiStatus}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="status-card">
            <div className="status-emoji">⏱️</div>
            <div className="status-label">Last Updated</div>
            <div className="status-value" style={{ fontSize: '14px' }}>
              {new Date(stats.lastUpdated).toLocaleTimeString('ja-JP')}
            </div>
          </div>
        </div>
      </div>

      {/* 統計 */}
      <div className="monitoring-grid">
        <div className="card">
          <h2 className="card-title">👥 ユーザー統計</h2>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">
                {stats.totalUsers.toLocaleString()}
                <span className="stat-unit">人</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">
                {stats.totalTransactions.toLocaleString()}
                <span className="stat-unit">件</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">🔗 ブロックチェーン</h2>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-label">Last Block</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>
                {stats.lastProcessedBlock.toLocaleString()}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Status</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>
                ✅ Synced
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">📈 スコア平均</h2>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-label">💸 Economic</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>
                {distribution.economicAverage.toLocaleString()}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">🔥 Resonance</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>
                {distribution.resonanceAverage.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* スコア分布 */}
      <div className="card full-width">
        <h2 className="card-title">📊 スコア分布</h2>

        <div className="distribution-item">
          <div className="distribution-label">
            <span>💸 Economic</span>
            <span>
              平均: {distribution.economicAverage.toLocaleString()} / 中央値:{' '}
              {distribution.economicMedian.toLocaleString()}
            </span>
          </div>
          <div className="distribution-bar">
            <div
              className="distribution-fill"
              style={
                {
                  width: '65%',
                  '--fill-color': '#3498db',
                  '--fill-color-light': '#5dade2',
                } as React.CSSProperties
              }
            >
              65% of max
            </div>
          </div>
        </div>

        <div className="distribution-item">
          <div className="distribution-label">
            <span>🔥 Resonance</span>
            <span>
              平均: {distribution.resonanceAverage.toLocaleString()} / 中央値:{' '}
              {distribution.resonanceMedian.toLocaleString()}
            </span>
          </div>
          <div className="distribution-bar">
            <div
              className="distribution-fill"
              style={
                {
                  width: '45%',
                  '--fill-color': '#e74c3c',
                  '--fill-color-light': '#ec7063',
                } as React.CSSProperties
              }
            >
              45% of max
            </div>
          </div>
        </div>

        <div className="distribution-item">
          <div className="distribution-label">
            <span>📊 Composite</span>
            <span>
              平均: {distribution.compositeAverage.toLocaleString()} / 中央値:{' '}
              {distribution.compositeMedian.toLocaleString()}
            </span>
          </div>
          <div className="distribution-bar">
            <div
              className="distribution-fill"
              style={
                {
                  width: '55%',
                  '--fill-color': '#9b59b6',
                  '--fill-color-light': '#af7ac5',
                } as React.CSSProperties
              }
            >
              55% of max
            </div>
          </div>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      <div className="card full-width">
        <h2 className="card-title">📋 最近のアクティビティ</h2>

        <div className="activity-list">
          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#718096' }}>
              まだアクティビティがありません
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-type">{activity.type.replace('_', ' ')}</div>
                <div className="activity-description">{activity.description}</div>
                <div className="activity-timestamp">
                  {new Date(activity.timestamp).toLocaleString('ja-JP')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitoringPage;
