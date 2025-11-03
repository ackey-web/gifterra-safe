// src/admin/vending/components/VendingStatsTab.tsx
// GIFT HUB統計ダッシュボード

import { useState, useEffect } from 'react';
import type { VendingMachine } from '../../../types/vending';
import {
  calculateVendingStatsSummary,
  calculateProductStats,
  calculateTimeSeriesData,
  getTopProducts,
  getDateRange,
  type TimePeriod,
  type VendingStatsSummary,
  type ProductStats,
  type TimeSeriesDataPoint,
} from '../../../lib/vendingStats';
import { fetchPurchaseHistory } from '../../../lib/purchaseHistory';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface VendingStatsTabProps {
  machine: VendingMachine;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function VendingStatsTab({ machine }: VendingStatsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [summary, setSummary] = useState<VendingStatsSummary | null>(null);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);

  useEffect(() => {
    loadStatsData();
  }, [machine.id, timePeriod]);

  const loadStatsData = async () => {
    setIsLoading(true);
    try {
      // 購入履歴を取得（フィルタ適用）
      const { startDate, endDate } = getDateRange(timePeriod);
      const purchaseData = await fetchPurchaseHistory(
        { startDate, endDate },
        1000, // 大量のデータを取得
        0
      );

      // 統計計算
      const summaryData = calculateVendingStatsSummary(purchaseData);
      const productStatsData = calculateProductStats(purchaseData, machine.products);
      const timeSeriesDataData = calculateTimeSeriesData(purchaseData, timePeriod);

      setSummary(summaryData);
      setProductStats(productStatsData);
      setTimeSeriesData(timeSeriesDataData);
    } catch (error) {
      console.error('Failed to load stats data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        統計データを読み込んでいます...
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        統計データがありません
      </div>
    );
  }

  const topProducts = getTopProducts(productStats, 5);

  // トークン別売上（円グラフ用）
  const tokenPieData = summary.totalRevenueByToken.map(token => ({
    name: token.tokenSymbol,
    value: token.salesCount,
    percentage: token.percentage,
  }));

  return (
    <div style={{ padding: 24 }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: '#fff' }}>
            📊 統計ダッシュボード
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {machine.name} の販売統計
          </p>
        </div>

        {/* 期間フィルタ */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['day', 'week', 'month', 'all'] as TimePeriod[]).map(period => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              style={{
                padding: '8px 16px',
                background: timePeriod === period ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${timePeriod === period ? '#3B82F6' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 6,
                color: timePeriod === period ? '#fff' : 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {{
                day: '今日',
                week: '過去7日',
                month: '過去30日',
                all: '全期間',
              }[period]}
            </button>
          ))}
        </div>
      </div>

      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>総販売数</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6' }}>
            {summary.totalSales.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
        </div>

        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>完了済み</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>
            {summary.completedPurchases.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
        </div>

        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>処理中</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B' }}>
            {summary.pendingPurchases.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>件</div>
        </div>

        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ユニーク購入者</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}>
            {summary.uniqueBuyers.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>人</div>
        </div>
      </div>

      {/* グラフエリア */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* 時系列グラフ */}
        <div style={{
          padding: 24,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
            📈 売上推移
          </h3>
          {timeSeriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: 11 }}
                />
                <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="販売数"
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              データがありません
            </div>
          )}
        </div>

        {/* トークン別売上円グラフ */}
        <div style={{
          padding: 24,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
            💰 トークン別売上比率
          </h3>
          {tokenPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tokenPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tokenPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0,0,0,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              データがありません
            </div>
          )}
        </div>
      </div>

      {/* 人気商品ランキング */}
      <div style={{
        padding: 24,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        marginBottom: 32,
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
          🏆 人気商品ランキング (トップ5)
        </h3>
        {topProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="rgba(255,255,255,0.5)" style={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="productName"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: 11 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                }}
              />
              <Bar dataKey="salesCount" fill="#10B981" name="販売数" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            データがありません
          </div>
        )}
      </div>

      {/* 商品別詳細テーブル */}
      <div style={{
        padding: 24,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
          📦 商品別売上詳細
        </h3>
        {productStats.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    商品名
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    SKU
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    販売数
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    総売上
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    トークン別内訳
                  </th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((product, index) => (
                  <tr
                    key={product.productId}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', fontWeight: 600 }}>
                      {product.productName}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                      {product.productSku}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', textAlign: 'right', fontWeight: 600 }}>
                      {product.salesCount}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#10B981', textAlign: 'right', fontWeight: 600 }}>
                      {product.totalRevenueFormatted}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      {product.tokenBreakdown.map(token => (
                        <div key={token.tokenId} style={{ marginBottom: 4 }}>
                          {token.tokenSymbol}: {token.count}件 ({token.revenueFormatted})
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            商品別データがありません
          </div>
        )}
      </div>

      {/* トークン別売上詳細 */}
      <div style={{
        marginTop: 24,
        padding: 24,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
          💎 トークン別売上サマリー
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {summary.totalRevenueByToken.map((token, index) => (
            <div
              key={token.tokenId}
              style={{
                padding: 20,
                background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}20 0%, ${COLORS[index % COLORS.length]}10 100%)`,
                border: `1px solid ${COLORS[index % COLORS.length]}40`,
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS[index % COLORS.length], marginBottom: 12 }}>
                {token.tokenSymbol}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>販売数</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {token.salesCount.toLocaleString()} 件
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>総売上</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                  {token.totalRevenueFormatted}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>割合</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS[index % COLORS.length] }}>
                  {token.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
