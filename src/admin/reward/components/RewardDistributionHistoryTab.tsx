// src/admin/reward/components/RewardDistributionHistoryTab.tsx
// Reward配布履歴タブ

import { useState, useEffect } from 'react';
import {
  fetchDistributionHistory,
  calculateDistributionStats,
  exportDistributionHistoryToCSV,
  getTriggerDisplayName,
  getRarityDisplayName,
  getStatusDisplayName,
  type RewardDistributionItem,
  type DistributionFilter,
  type DistributionStats,
  type DistributionTrigger,
  type RewardRarity,
  type DistributionStatus,
  type RewardType,
} from '../../../lib/rewardDistribution';

export function RewardDistributionHistoryTab() {
  const [distributions, setDistributions] = useState<RewardDistributionItem[]>([]);
  const [stats, setStats] = useState<DistributionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<DistributionFilter>({});
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadDistributions();
  }, [filter, page]);

  const loadDistributions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDistributionHistory(filter, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      setDistributions(data);

      // 全データで統計計算（フィルタ適用済み）
      const allData = await fetchDistributionHistory(filter, 10000, 0);
      const statsData = calculateDistributionStats(allData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load distribution history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csv = exportDistributionHistoryToCSV(distributions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reward_distribution_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: DistributionStatus) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getRarityColor = (rarity: RewardRarity) => {
    switch (rarity) {
      case 'SSR':
        return '#F59E0B';
      case 'SR':
        return '#8B5CF6';
      case 'RARE':
        return '#3B82F6';
      case 'COMMON':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  if (isLoading && !stats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        配布履歴を読み込んでいます...
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: '#fff' }}>
          🎁 Reward配布履歴
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          デイリーリワード、ランダム抽選、手動配布の履歴を管理
        </p>
      </div>

      {/* 統計サマリー */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>総配布数</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6' }}>
              {stats.totalDistributions.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
          </div>

          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>配布完了</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>
              {stats.completedDistributions.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
          </div>

          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>配布待ち</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B' }}>
              {stats.pendingDistributions.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
          </div>

          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ユニーク受信者</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}>
              {stats.uniqueRecipients.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>人</div>
          </div>
        </div>
      )}

      {/* トークン配布総額 */}
      {stats && stats.totalTokenDistributed.length > 0 && (
        <div style={{
          marginBottom: 24,
          padding: 20,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            💰 トークン配布総額
          </h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {stats.totalTokenDistributed.map(token => (
              <div key={token.tokenId}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                  {token.tokenId}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>
                  {token.amountFormatted}
                </div>
              </div>
            ))}
            {stats.totalNFTDistributed > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                  NFT配布
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#8B5CF6' }}>
                  {stats.totalNFTDistributed.toLocaleString()} 個
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* フィルタ */}
      <div style={{
        marginBottom: 24,
        padding: 20,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#fff' }}>
          🔍 フィルタ
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* トリガーフィルタ */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              配布トリガー
            </label>
            <select
              value={filter.trigger || ''}
              onChange={(e) => {
                setFilter({ ...filter, trigger: e.target.value as DistributionTrigger || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <option value="">全て</option>
              <option value="DAILY_REWARD">デイリーリワード</option>
              <option value="TIP_MILESTONE">TIPマイルストーン</option>
              <option value="MANUAL_GACHA">手動ガチャ</option>
              <option value="MANUAL_AIRDROP">手動配布</option>
            </select>
          </div>

          {/* レアリティフィルタ */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              レアリティ
            </label>
            <select
              value={filter.rarity || ''}
              onChange={(e) => {
                setFilter({ ...filter, rarity: e.target.value as RewardRarity || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <option value="">全て</option>
              <option value="SSR">SSR</option>
              <option value="SR">SR</option>
              <option value="RARE">レア</option>
              <option value="COMMON">コモン</option>
              <option value="NONE">-</option>
            </select>
          </div>

          {/* ステータスフィルタ */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              ステータス
            </label>
            <select
              value={filter.status || ''}
              onChange={(e) => {
                setFilter({ ...filter, status: e.target.value as DistributionStatus || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <option value="">全て</option>
              <option value="completed">配布完了</option>
              <option value="pending">配布待ち</option>
              <option value="failed">失敗</option>
            </select>
          </div>

          {/* 報酬タイプフィルタ */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              報酬タイプ
            </label>
            <select
              value={filter.rewardType || ''}
              onChange={(e) => {
                setFilter({ ...filter, rewardType: e.target.value as RewardType || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <option value="">全て</option>
              <option value="TOKEN">トークン</option>
              <option value="NFT">NFT</option>
            </select>
          </div>
        </div>

        {/* 日付フィルタ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              開始日
            </label>
            <input
              type="date"
              value={filter.startDate || ''}
              onChange={(e) => {
                setFilter({ ...filter, startDate: e.target.value || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              終了日
            </label>
            <input
              type="date"
              value={filter.endDate || ''}
              onChange={(e) => {
                setFilter({ ...filter, endDate: e.target.value || undefined });
                setPage(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* フィルタリセット */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setFilter({});
              setPage(0);
            }}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            フィルタをリセット
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '8px 16px',
              background: '#10B981',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📥 CSV出力
          </button>
        </div>
      </div>

      {/* 配布履歴テーブル */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  受信者
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  トリガー
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  レアリティ
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  報酬
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  ステータス
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  配布日時
                </th>
              </tr>
            </thead>
            <tbody>
              {distributions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    配布履歴がありません
                  </td>
                </tr>
              ) : (
                distributions.map((dist, index) => (
                  <tr
                    key={dist.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>
                      {dist.recipient.substring(0, 6)}...{dist.recipient.substring(38)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                      {getTriggerDisplayName(dist.trigger)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {dist.rarity !== 'NONE' && (
                        <span style={{
                          padding: '4px 8px',
                          background: `${getRarityColor(dist.rarity)}20`,
                          border: `1px solid ${getRarityColor(dist.rarity)}40`,
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: getRarityColor(dist.rarity),
                        }}>
                          {getRarityDisplayName(dist.rarity)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      {dist.rewardType === 'TOKEN' ? (
                        <span style={{ color: '#10B981', fontWeight: 600 }}>
                          {dist.tokenAmountFormatted}
                        </span>
                      ) : (
                        <span style={{ color: '#8B5CF6', fontWeight: 600 }}>
                          {dist.nftName}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: `${getStatusColor(dist.status)}20`,
                        border: `1px solid ${getStatusColor(dist.status)}40`,
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: getStatusColor(dist.status),
                      }}>
                        {getStatusDisplayName(dist.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(dist.timestamp).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {distributions.length > 0 && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {page * ITEMS_PER_PAGE + 1} - {Math.min((page + 1) * ITEMS_PER_PAGE, distributions.length)} 件表示
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{
                  padding: '6px 12px',
                  background: page === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: page === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                  fontSize: 13,
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                前へ
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={distributions.length < ITEMS_PER_PAGE}
                style={{
                  padding: '6px 12px',
                  background: distributions.length < ITEMS_PER_PAGE ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: distributions.length < ITEMS_PER_PAGE ? 'rgba(255,255,255,0.3)' : '#fff',
                  fontSize: 13,
                  cursor: distributions.length < ITEMS_PER_PAGE ? 'not-allowed' : 'pointer',
                }}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
