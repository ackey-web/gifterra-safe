// src/admin/vending/components/PurchaseHistoryTab.tsx
// GIFT HUB配布履歴タブ

import { useEffect, useState } from 'react';
import {
  fetchPurchaseHistory,
  exportPurchaseHistoryToCSV,
  downloadCSV,
  calculatePurchaseStats,
  type PurchaseHistoryItem,
  type PurchaseFilter,
} from '../../../lib/purchaseHistory';
import type { VendingMachine } from '../../../types/vending';
import { getAvailableTokens } from '../../../config/tokens';

interface PurchaseHistoryTabProps {
  machine: VendingMachine;
}

export function PurchaseHistoryTab({ machine }: PurchaseHistoryTabProps) {
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<PurchaseFilter>({});
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // 利用可能なトークン
  const availableTokens = getAvailableTokens(true);

  // 配布履歴を読み込み
  const loadPurchases = async () => {
    setIsLoading(true);
    try {
      // TODO: machine.slug や machine.id でフィルタ
      const data = await fetchPurchaseHistory(filter, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      setPurchases(data);
    } catch (error) {
      console.error('Failed to load purchase history:', error);
      alert('配布履歴の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初回読み込み
  useEffect(() => {
    loadPurchases();
  }, [filter, page]);

  // 統計
  const stats = calculatePurchaseStats(purchases);

  // CSVエクスポート
  const handleExportCSV = () => {
    const csv = exportPurchaseHistoryToCSV(purchases);
    downloadCSV(csv, `purchase_history_${machine.slug}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // フィルタ更新
  const handleFilterChange = (key: keyof PurchaseFilter, value: any) => {
    setFilter(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(0); // ページをリセット
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
        📊 配布履歴 - {machine.name}
      </h3>

      {/* 統計カード */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 16,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>総配布数</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.totalCount}件</div>
        </div>

        <div
          style={{
            padding: 16,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>完了</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{stats.completedCount}件</div>
        </div>

        <div
          style={{
            padding: 16,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>保留中</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{stats.pendingCount}件</div>
        </div>

        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>失敗</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{stats.failedCount}件</div>
        </div>
      </div>

      {/* フィルタ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
          padding: 16,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
        }}
      >
        {/* ステータスフィルタ */}
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>ステータス</label>
          <select
            value={filter.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 13,
            }}
          >
            <option value="">全て</option>
            <option value="completed">完了</option>
            <option value="pending">保留中</option>
            <option value="failed">失敗</option>
          </select>
        </div>

        {/* トークンフィルタ */}
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>トークン</label>
          <select
            value={filter.tokenId || ''}
            onChange={(e) => handleFilterChange('tokenId', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 13,
            }}
          >
            <option value="">全て</option>
            {availableTokens.map(token => (
              <option key={token.id} value={token.id}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* CSV エクスポート */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={handleExportCSV}
            disabled={purchases.length === 0}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: purchases.length > 0 ? '#10b981' : '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: purchases.length > 0 ? 'pointer' : 'not-allowed',
              opacity: purchases.length > 0 ? 1 : 0.5,
            }}
          >
            📥 CSVエクスポート
          </button>
        </div>
      </div>

      {/* テーブル */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 16 }}>読み込み中...</div>
        </div>
      ) : purchases.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: '1px dashed rgba(255,255,255,0.2)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>配布履歴がありません</h3>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>特典が配布されると、ここに履歴が表示されます。</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>特典</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>受取者</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>価格</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>ステータス</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>NFT配布</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>配布日時</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase, idx) => (
                  <tr
                    key={purchase.id}
                    style={{
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <td style={{ padding: 12, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{purchase.productName || purchase.productId}</div>
                      {purchase.productSku && (
                        <div style={{ fontSize: 11, opacity: 0.7, fontFamily: 'monospace' }}>
                          SKU: {purchase.productSku}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
                      {purchase.buyer.slice(0, 10)}...{purchase.buyer.slice(-8)}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                      {purchase.priceFormatted} {purchase.tokenSymbol}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            purchase.status === 'completed'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : purchase.status === 'pending'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                          color:
                            purchase.status === 'completed'
                              ? '#10b981'
                              : purchase.status === 'pending'
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {purchase.status === 'completed' ? '完了' : purchase.status === 'pending' ? '保留中' : '失敗'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', fontSize: 18 }}>
                      {purchase.nftDistributed ? '✅' : '⏳'}
                    </td>
                    <td style={{ padding: 12, fontSize: 12 }}>
                      {new Date(purchase.createdAt).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={{
                padding: '8px 16px',
                background: page === 0 ? '#374151' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                opacity: page === 0 ? 0.5 : 1,
              }}
            >
              ← 前へ
            </button>
            <div style={{ padding: '8px 16px', fontSize: 13 }}>ページ {page + 1}</div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={purchases.length < ITEMS_PER_PAGE}
              style={{
                padding: '8px 16px',
                background: purchases.length < ITEMS_PER_PAGE ? '#374151' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: purchases.length < ITEMS_PER_PAGE ? 'not-allowed' : 'pointer',
                opacity: purchases.length < ITEMS_PER_PAGE ? 0.5 : 1,
              }}
            >
              次へ →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
