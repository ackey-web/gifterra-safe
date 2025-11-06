// src/pages/SuperAdmin.tsx
// スーパーアドミン専用ダッシュボード

import { useState, useMemo, useEffect } from 'react';
import { useAddress, useContract, ConnectWallet } from '@thirdweb-dev/react';
import { isSuperAdminWithDebug, SUPER_ADMIN_ADDRESSES } from '../config/superAdmin';
import { useSystemStats, useRealtimeStats } from '../hooks/useSystemStats';
import { useTenantList } from '../hooks/useTenantList';
import { useRecentActivity, getActivityCategoryInfo } from '../hooks/useRecentActivity';
import { useSystemHealth, getHealthStatusInfo } from '../hooks/useSystemHealth';
import { formatTokenAmount } from '../utils/userProfile';
import { TOKEN, TNHT_TOKEN, GIFTERRA_FACTORY_ABI } from '../contract';
import { useTenantApplications, useApproveTenantApplication, useRejectTenantApplication } from '../hooks/useTenantApplications';
import { RANK_PLANS } from '../types/tenantApplication';
import type { TenantApplication, ApplicationStatus } from '../types/tenantApplication';
import { useAllTenantRankPlans, useSetTenantRankPlan, type TenantRankPlanForm } from '../hooks/useTenantRankPlan';
import { useRankPlanPricing, useUpdateRankPlanPrice, getPlanPrice, type RankPlanPricing } from '../hooks/useRankPlanPricing';

// ユーザープロフィールプレビュー用のインポート
import { UserProfilePage } from './UserProfile';
import { generateMockUserProfile } from '../utils/mockUserProfile';

// スコア管理ページのインポート
import { ScoreParametersPage, TokenAxisPage, SystemMonitoringPage } from '../admin/score';
import CreateTenantForm from './CreateTenantForm';

type TabType = 'dashboard' | 'user-preview' | 'tenants' | 'applications' | 'revenue' | 'rank-plans' | 'score-parameters' | 'token-axis' | 'system-monitoring';

export function SuperAdminPage() {
  const connectedAddress = useAddress();
  const isAdmin = isSuperAdminWithDebug(connectedAddress);

  // タブ状態
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // デバッグ情報
  useEffect(() => {
    console.log('🔐 SuperAdmin Auth Debug:', {
      connectedAddress,
      isAdmin,
      superAdminAddresses: SUPER_ADMIN_ADDRESSES,
    });
  }, [connectedAddress, isAdmin]);

  // アクセス制御
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 600, width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: 28, fontWeight: 800 }}>アクセス拒否</h1>
          <p style={{ margin: '0 0 24px 0', fontSize: 16, opacity: 0.9 }}>
            このページはスーパーアドミン専用です。
          </p>

          {/* ウォレット接続状態 */}
          {!connectedAddress ? (
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, opacity: 0.8 }}>
                スーパーアドミンウォレットで接続してください
              </p>
              <ConnectWallet
                theme="dark"
                btnTitle="ウォレットを接続"
                modalTitle="Super Admin 接続"
                style={{
                  fontSize: 16,
                  padding: "14px 32px",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              />
            </div>
          ) : (
            <div style={{
              marginBottom: 24,
              padding: 16,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8,
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>
                接続中のウォレット
              </p>
              <code style={{
                fontSize: 13,
                fontFamily: 'monospace',
                opacity: 0.9,
                wordBreak: 'break-all',
                display: 'block',
                marginBottom: 12,
              }}>
                {connectedAddress}
              </code>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, opacity: 0.8 }}>
                このウォレットはスーパーアドミン権限を持っていません
              </p>
              <ConnectWallet
                theme="dark"
                btnTitle="ウォレットを切り替え"
                modalTitle="Super Admin 接続"
                style={{
                  fontSize: 14,
                  padding: "10px 24px",
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              />
            </div>
          )}

          {/* 許可されたアドレス一覧 */}
          <div style={{
            marginBottom: 24,
            padding: 16,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            textAlign: 'left',
          }}>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
              許可されたスーパーアドミンアドレス:
            </p>
            {SUPER_ADMIN_ADDRESSES.map((addr, index) => (
              <code key={index} style={{
                fontSize: 12,
                fontFamily: 'monospace',
                opacity: 0.7,
                display: 'block',
                marginBottom: 4,
                wordBreak: 'break-all',
              }}>
                {addr}
              </code>
            ))}
          </div>

          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 32px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
      }}>
        {/* ヘッダー */}
        <div style={{
          marginBottom: 32,
          color: '#fff',
        }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: 32,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            👑 Super Admin Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
            システム管理・監視・プレビューツール
          </p>
        </div>

        {/* タブナビゲーション */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 0,
          flexWrap: 'wrap',
        }}>
          <TabButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon="📊"
            label="ダッシュボード"
          />
          <TabButton
            active={activeTab === 'user-preview'}
            onClick={() => setActiveTab('user-preview')}
            icon="👤"
            label="ユーザーマイページ"
          />
          <TabButton
            active={activeTab === 'tenants'}
            onClick={() => setActiveTab('tenants')}
            icon="🏢"
            label="テナント管理"
          />
          <TabButton
            active={activeTab === 'applications'}
            onClick={() => setActiveTab('applications')}
            icon="📝"
            label="テナント申請"
          />
          <TabButton
            active={activeTab === 'revenue'}
            onClick={() => setActiveTab('revenue')}
            icon="💰"
            label="収益管理"
          />
          <TabButton
            active={activeTab === 'score-parameters'}
            onClick={() => setActiveTab('score-parameters')}
            icon="⚖️"
            label="スコアパラメータ"
          />
          <TabButton
            active={activeTab === 'token-axis'}
            onClick={() => setActiveTab('token-axis')}
            icon="🪙"
            label="トークン軸設定"
          />
          <TabButton
            active={activeTab === 'rank-plans'}
            onClick={() => setActiveTab('rank-plans')}
            icon="🎖️"
            label="ランクプラン管理"
          />
          <TabButton
            active={activeTab === 'system-monitoring'}
            onClick={() => setActiveTab('system-monitoring')}
            icon="🖥️"
            label="システム監視"
          />
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'user-preview' && <UserPreviewTabSimple />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'applications' && <ApplicationsTab />}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'rank-plans' && <RankPlansTab />}
        {activeTab === 'score-parameters' && <ScoreParametersPage />}
        {activeTab === 'token-axis' && <TokenAxisPage />}
        {activeTab === 'system-monitoring' && <SystemMonitoringPage />}
      </div>
    </div>
  );
}

/**
 * タブボタンコンポーネント
 */
function TabButton({ active, onClick, icon, label, disabled }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px',
        background: active ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid rgba(102, 126, 234, 1)' : '3px solid transparent',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
        fontSize: 14,
        fontWeight: active ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
      }}
    >
      {icon} {label}
    </button>
  );
}

/**
 * ダッシュボードタブ
 */
function DashboardTab() {
  const { stats, isLoading } = useSystemStats();
  const realtimeData = useRealtimeStats();
  const { tenants } = useTenantList();
  const { activities } = useRecentActivity(20);
  const { health } = useSystemHealth();

  if (isLoading) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* システムヘルス */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          ⚡ システムヘルス
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(health.services).map(([key, service]) => {
            const statusInfo = getHealthStatusInfo(service.status);
            return (
              <div
                key={key}
                style={{
                  padding: 12,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  border: `1px solid ${service.status === 'down' ? '#ef4444' : service.status === 'degraded' ? '#f59e0b' : '#10b981'}`,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{service.name}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: statusInfo.color }}>
                  {statusInfo.icon} {statusInfo.label}
                </div>
                {service.responseTime && (
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{service.responseTime}ms</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 主要統計 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 16,
      }}>
        <StatCard
          icon="🏪"
          label="GIFT HUB"
          value={stats.totalHubs.toString()}
          subtitle={`${stats.activeHubs}個が稼働中`}
          color="#3b82f6"
        />
        <StatCard
          icon="🎁"
          label="総配布数"
          value={stats.totalDistributions.toLocaleString()}
          subtitle="累計配布回数"
          color="#10b981"
        />
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
        }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>💰 TOTAL TIPS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>JPYC</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
                {formatTokenAmount(BigInt(stats.totalRevenue), 18, 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>NHT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                {formatTokenAmount(BigInt(stats.totalRevenueNHT || 0), 18, 0)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>累計収益</div>
        </div>
        <StatCard
          icon="📦"
          label="商品数"
          value={stats.totalProducts.toString()}
          subtitle="アクティブな商品"
          color="#8b5cf6"
        />
        <StatCard
          icon="📊"
          label="トランザクション"
          value={stats.totalTransactions.toLocaleString()}
          subtitle={`今日: ${stats.transactionsToday}件`}
          color="#ec4899"
        />
        <StatCard
          icon="🏢"
          label="テナント"
          value={stats.totalTenants.toString()}
          subtitle={`${stats.activeTenants}個が稼働中`}
          color="#06b6d4"
        />
      </div>

      {/* リアルタイム統計 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          📡 リアルタイム統計
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>オンラインユーザー</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{realtimeData.currentOnlineUsers}</div>
          </div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>処理中トランザクション</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{realtimeData.activeTransactions}</div>
          </div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>システム負荷</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{realtimeData.systemLoad}%</div>
          </div>
        </div>
      </div>

      {/* テナント一覧と最近のアクティビティ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* テナント一覧 */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
            🏢 テナント一覧
          </h2>
          {tenants.map(tenant => {
            const statusInfo = getHealthStatusInfo(tenant.health.status);
            return (
              <div
                key={tenant.id}
                style={{
                  padding: 16,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{tenant.name}</div>
                  <div style={{ fontSize: 12, color: statusInfo.color }}>
                    {statusInfo.icon} {statusInfo.label}
                  </div>
                </div>
                {tenant.stats && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>GIFT HUB: {tenant.stats.totalHubs}個</div>
                      <div>配布: {tenant.stats.totalDistributions}回</div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, opacity: 0.9 }}>💰 TOTAL TIPS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>JPYC</div>
                          <div>{formatTokenAmount(BigInt(tenant.stats.totalRevenue || 0), 18, 0)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>NHT</div>
                          <div>{formatTokenAmount(BigInt(tenant.stats.totalRevenueNHT || 0), 18, 0)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>Custom</div>
                          <div>{formatTokenAmount(BigInt(tenant.stats.totalRevenueCustom || 0), 18, 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 最近のアクティビティ */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
          maxHeight: 500,
          overflowY: 'auto',
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
            📝 最近のアクティビティ
          </h2>
          {activities.slice(0, 10).map(activity => {
            const categoryInfo = getActivityCategoryInfo(activity.category);
            return (
              <div
                key={activity.id}
                style={{
                  padding: 12,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  marginBottom: 8,
                  borderLeft: `3px solid ${categoryInfo.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{categoryInfo.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{activity.title}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{activity.description}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{formatRelativeTime(activity.timestamp)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * ユーザープレビュータブ - デザインプレビュー（モックデータ使用）
 */
function UserPreviewTabSimple() {
  const connectedAddress = useAddress();
  const [previewAddress, setPreviewAddress] = useState('');

  // モックプロフィールを生成（デザイン確認用）
  const mockProfile = useMemo(() => {
    if (!previewAddress) return null;
    return generateMockUserProfile({
      address: previewAddress,
      rank: 'Gold',
      contributionPoints: BigInt(5000),
      totalTipsSent: BigInt('10000000000000000000'), // 10 JPYC
      totalTipsReceived: BigInt('5000000000000000000'), // 5 JPYC
      purchaseCount: 12,
      rewardClaimedCount: 8,
      activityCount: 25,
      sbtCount: 3,
    });
  }, [previewAddress]);

  // モックアクティビティを生成
  const mockActivities = useMemo(() => {
    if (!previewAddress) return [];
    const now = Date.now();
    return [
      { id: '1', type: 'tip_sent' as const, timestamp: new Date(now - 86400000), txHash: '0x123...' },
      { id: '2', type: 'tip_received' as const, timestamp: new Date(now - 172800000), txHash: '0x456...' },
      { id: '3', type: 'purchase' as const, timestamp: new Date(now - 259200000), txHash: '0x789...' },
      { id: '4', type: 'reward_claimed' as const, timestamp: new Date(now - 345600000), txHash: '0xabc...' },
    ];
  }, [previewAddress]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '350px 1fr',
      gap: 24,
    }}>
      {/* 左側: コントロールパネル */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
        height: 'fit-content',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700 }}>
          🔍 プレビュー対象
        </h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 8, opacity: 0.8 }}>
            ウォレットアドレス
          </label>
          <input
            type="text"
            value={previewAddress}
            onChange={(e) => setPreviewAddress(e.target.value)}
            placeholder="0x..."
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          />
        </div>

        <button
          onClick={() => setPreviewAddress(connectedAddress || '')}
          disabled={!connectedAddress}
          style={{
            width: '100%',
            padding: 10,
            background: connectedAddress ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${connectedAddress ? 'rgba(102, 126, 234, 0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            color: connectedAddress ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 13,
            fontWeight: 600,
            cursor: connectedAddress ? 'pointer' : 'not-allowed',
          }}
        >
          接続中のウォレットを使用
        </button>

        <div style={{
          marginTop: 20,
          padding: 12,
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 8,
          fontSize: 12,
        }}>
          💡 <strong>デザインプレビュー:</strong> モックデータで表示されます。実データではありません。
        </div>
      </div>

      {/* 右側: プレビュー */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {previewAddress ? (
          <UserProfilePage
            address={previewAddress}
            mockProfile={mockProfile}
            mockActivities={mockActivities}
          />
        ) : (
          <div style={{
            minHeight: 500,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            padding: 40,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
            <h2 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 700 }}>
              アドレスを入力してください
            </h2>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.7, maxWidth: 400 }}>
              プレビューしたいユーザーのウォレットアドレスを入力するか、接続中のウォレットを使用してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 統計カード
 */
function StatCard({ icon, label, value, subtitle, color }: {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: 20,
      color: '#fff',
    }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{subtitle}</div>}
    </div>
  );
}

/**
 * テナント管理タブ
 */
function TenantsTab() {
  const { tenants, isLoading } = useTenantList();
  const { plans } = useAllTenantRankPlans();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 環境変数からFactoryアドレスを取得
  const factoryAddress = import.meta.env.VITE_FACTORY_ADDRESS;

  // テナントIDからプランバッジ情報を取得
  function getPlanBadge(tenantId: number) {
    const planData = plans?.find(p => p.tenant_id === tenantId);
    if (!planData || !planData.is_active) {
      return { name: 'STUDIO', color: '#6B7280' }; // デフォルト/無料プラン
    }
    switch (planData.rank_plan) {
      case 'STUDIO':
        return { name: 'STUDIO', color: '#6B7280' };
      case 'STUDIO_PRO':
        return { name: 'PRO', color: '#3B82F6' };
      case 'STUDIO_PRO_MAX':
        return { name: 'PRO MAX', color: '#8B5CF6' };
      default:
        return { name: 'STUDIO', color: '#6B7280' };
    }
  }

  if (isLoading) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>テナント情報を読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          🏢 テナント一覧
        </h2>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
          プラットフォーム上で動作している全テナントの管理と監視
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tenants.map(tenant => {
            const statusInfo = getHealthStatusInfo(tenant.health.status);
            return (
              <div
                key={tenant.id}
                style={{
                  padding: 20,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700 }}>{tenant.name}</h3>
                    <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace' }}>{tenant.id}</div>
                    {(() => {
                      const badge = getPlanBadge(tenant.id);
                      return (
                        <div style={{
                          display: 'inline-block',
                          marginTop: 8,
                          padding: '4px 10px',
                          background: badge.color + '20',
                          border: `1px solid ${badge.color}`,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: badge.color,
                        }}>
                          {badge.name}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{
                    padding: '8px 16px',
                    background: statusInfo.color + '20',
                    border: `1px solid ${statusInfo.color}`,
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: statusInfo.color,
                  }}>
                    {statusInfo.icon} {statusInfo.label}
                  </div>
                </div>

                {tenant.stats && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                    marginTop: 16,
                  }}>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>GIFT HUB</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant.stats.totalHubs}個</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>稼働中: {tenant.stats.activeHubs}個</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>総配布数</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant.stats.totalDistributions.toLocaleString()}回</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>💰 TOTAL TIPS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 14 }}>
                        <div>
                          <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 2 }}>JPYC</div>
                          <div style={{ fontWeight: 700 }}>{formatTokenAmount(BigInt(tenant.stats.totalRevenue || 0), 18, 0)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 2 }}>NHT</div>
                          <div style={{ fontWeight: 700 }}>{formatTokenAmount(BigInt(tenant.stats.totalRevenueNHT || 0), 18, 0)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 2 }}>Custom</div>
                          <div style={{ fontWeight: 700 }}>{formatTokenAmount(BigInt(tenant.stats.totalRevenueCustom || 0), 18, 0)}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>ユーザー数</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant.stats.userCount.toLocaleString()}人</div>
                    </div>
                  </div>
                )}

                {tenant.health.issues.length > 0 && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ 問題が検出されました</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, opacity: 0.9 }}>
                      {tenant.health.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 新規テナント作成 */}
      {showCreateForm ? (
        <CreateTenantForm
          factoryAddress={factoryAddress}
          onSuccess={(tenantId, contracts) => {
            setShowCreateForm(false);
            // テナント一覧を再読み込み（将来的にrefetch機能を実装）
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
          textAlign: 'center',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>
            ➕ 新規テナント作成
          </h3>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
            新しいテナントのコントラクトセットを一括デプロイします
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>🏭</span>
            <span>テナント作成フォームを開く</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 収益管理タブ
 */
function RevenueTab() {
  const { stats, isLoading } = useSystemStats();
  const [platformFee, setPlatformFee] = useState<number>(5);
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [feeMessage, setFeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ローカルストレージから手数料設定を読み込み
  useEffect(() => {
    try {
      const savedFee = localStorage.getItem('gifterra_platform_fee');
      if (savedFee) {
        setPlatformFee(parseFloat(savedFee));
      }
    } catch (error) {
      console.error('Failed to load platform fee:', error);
    }
  }, []);

  // 手数料を保存
  const handleSaveFee = () => {
    setIsSavingFee(true);
    setFeeMessage(null);

    try {
      if (platformFee < 0 || platformFee > 20) {
        throw new Error('手数料は0-20%の範囲で設定してください');
      }

      localStorage.setItem('gifterra_platform_fee', platformFee.toString());
      setFeeMessage({ type: 'success', text: '手数料設定を保存しました' });
      setTimeout(() => setFeeMessage(null), 3000);
    } catch (error) {
      setFeeMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存に失敗しました'
      });
    } finally {
      setIsSavingFee(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>収益データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* プラットフォーム手数料設定 */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>
          ⚙️ プラットフォーム手数料設定
        </h2>
        <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 16px 0' }}>
          テナントから徴収するプラットフォーム利用手数料を設定します（現在は参考値として保存のみ）
        </p>

        {feeMessage && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 16,
            background: feeMessage.type === 'success'
              ? 'rgba(34, 197, 94, 0.2)'
              : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${feeMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: feeMessage.type === 'success' ? '#86efac' : '#fca5a5',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span>{feeMessage.type === 'success' ? '✅' : '❌'}</span>
            <span>{feeMessage.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
            }}>
              手数料率
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={platformFee}
                onChange={(e) => setPlatformFee(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#8b5cf6'
                }}
              />
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={platformFee}
                onChange={(e) => setPlatformFee(parseFloat(e.target.value) || 0)}
                style={{
                  width: 80,
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: 14, minWidth: 20 }}>%</span>
            </div>
          </div>
          <button
            onClick={handleSaveFee}
            disabled={isSavingFee}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSavingFee ? 'not-allowed' : 'pointer',
              opacity: isSavingFee ? 0.6 : 1,
              transition: 'all 0.2s ease',
              marginTop: 22
            }}
          >
            {isSavingFee ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>

      {/* 収益概要 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          💰 収益概要
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}>
          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>💰 TOTAL TIPS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>JPYC</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
                  {formatTokenAmount(BigInt(stats.totalRevenue), 18, 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>NHT</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                  {formatTokenAmount(BigInt(stats.totalRevenueNHT || 0), 18, 0)}
                </div>
              </div>
            </div>
          </div>
          <div style={{
            padding: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>📊 総トランザクション</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>
              {stats.totalTransactions.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>件</div>
          </div>
          <div style={{
            padding: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>🎁 総配布数</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>
              {stats.totalDistributions.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>回</div>
          </div>
        </div>
      </div>

      {/* 収益の内訳 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700 }}>
          📈 収益の内訳（準備中）
        </h3>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
          今後、以下の情報を表示予定です：
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, opacity: 0.8 }}>
          <li>テナント別の収益</li>
          <li>GIFT HUB別の収益</li>
          <li>時系列の収益推移グラフ</li>
          <li>ロイヤリティ分配の詳細</li>
          <li>プラットフォーム手数料の詳細</li>
        </ul>
      </div>

      {/* 将来の機能 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>
          🚀 今後の機能
        </h3>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, opacity: 0.8 }}>
          <li>収益の引き出し機能</li>
          <li>収益レポートのエクスポート（CSV, PDF）</li>
          <li>リアルタイム収益ダッシュボード</li>
          <li>収益の自動分配設定</li>
          <li>税務レポートの生成</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * ユーザープロフィールプレビュー（APIサーバー不要版）
 */
function UserProfilePreview({ address, mode, presetName }: {
  address: string;
  mode: PreviewMode;
  presetName: PresetName;
}) {
  // モックモードまたはプリセット選択時
  const profile = mode === 'mock' || presetName !== 'custom'
    ? generateMockUserProfile(presetName)
    : useUserProfile(address).data;

  // ローディング状態
  if (!profile && mode === 'real') {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>プロフィールを読み込み中...</div>
      </div>
    );
  }

  // データがない場合
  if (!profile) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18 }}>プロフィールが見つかりません</div>
        <div style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
          アドレス: {shortenAddress(address)}
        </div>
      </div>
    );
  }

  const rankInfo = getRankBadge(profile.rank);
  const rankColor = getRankColor(profile.rank);

  return (
    <div style={{
      padding: 20,
      color: '#fff',
    }}>
      {/* ヘッダー */}
      <div style={{
        background: `linear-gradient(135deg, ${rankColor} 0%, ${rankColor}99 100%)`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 48 }}>{rankInfo.emoji}</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {profile.displayName || shortenAddress(profile.address)}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}>
              {rankInfo.label}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 12,
          opacity: 0.9,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          {profile.address}
        </div>
      </div>

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Total Tips</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatTokenAmount(profile.totalTips)} tNHT
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Rank</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            #{profile.globalRank || '—'}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Purchases</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {profile.purchaseCount}
          </div>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>
          🕒 Recent Activity
        </h3>
        {profile.recentActivity && profile.recentActivity.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.recentActivity.slice(0, 5).map((activity, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 8,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ marginRight: 8 }}>{activity.type === 'tip' ? '💰' : '🎁'}</span>
                  <span>{activity.type === 'tip' ? 'Tipped' : 'Purchased'}</span>
                  {activity.amount && (
                    <span style={{ fontWeight: 700, marginLeft: 8 }}>
                      {formatTokenAmount(activity.amount)} tNHT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {formatRelativeTime(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.6, padding: 20 }}>
            アクティビティがありません
          </div>
        )}
      </div>

      {/* バッジ */}
      {profile.badges && profile.badges.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>
            🏅 Badges
          </h3>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {profile.badges.map((badge, index) => (
              <div
                key={index}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * テナント申請管理タブ
 */
function ApplicationsTab() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus>('pending');
  const { applications, loading, error, refetch } = useTenantApplications(statusFilter);
  const { approve, approving } = useApproveTenantApplication();
  const { reject, rejecting } = useRejectTenantApplication();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState<TenantApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [approvingApplication, setApprovingApplication] = useState<TenantApplication | null>(null);

  // 承認処理
  const handleApprove = async (application: TenantApplication) => {
    setApprovingApplication(application);
    setShowApproveConfirm(true);
  };

  const confirmApprove = async () => {
    if (!approvingApplication) return;

    const success = await approve(approvingApplication);
    if (success) {
      alert('テナント申請を承認しました');
      refetch();
    }
    setShowApproveConfirm(false);
    setApprovingApplication(null);
  };

  // 拒否処理
  const handleReject = (application: TenantApplication) => {
    setRejectingApplication(application);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectingApplication || !rejectReason.trim()) {
      alert('拒否理由を入力してください');
      return;
    }

    const success = await reject(rejectingApplication.id, rejectReason);
    if (success) {
      alert('テナント申請を拒否しました');
      refetch();
    }
    setShowRejectModal(false);
    setRejectingApplication(null);
    setRejectReason('');
  };

  if (loading) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>申請データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>エラーが発生しました</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ステータスフィルタータブ */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          📝 テナント申請管理
        </h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setStatusFilter('pending')}
            style={{
              padding: '10px 20px',
              background: statusFilter === 'pending' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${statusFilter === 'pending' ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⏳ 承認待ち
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            style={{
              padding: '10px 20px',
              background: statusFilter === 'approved' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${statusFilter === 'approved' ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✅ 承認済み
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            style={{
              padding: '10px 20px',
              background: statusFilter === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${statusFilter === 'rejected' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ❌ 拒否済み
          </button>
        </div>

        {/* 申請リスト */}
        {applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.7 }}>
            該当する申請はありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {applications.map((application) => {
              const planDetails = RANK_PLANS[application.rank_plan];
              return (
                <div
                  key={application.id}
                  style={{
                    padding: 20,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700 }}>
                        {application.tenant_name}
                      </h3>
                      <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace', marginBottom: 4 }}>
                        申請者: {application.applicant_address}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        申請日時: {new Date(application.created_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div style={{
                      padding: '8px 16px',
                      background: application.status === 'approved'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : application.status === 'rejected'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(251, 191, 36, 0.2)',
                      border: `1px solid ${
                        application.status === 'approved'
                          ? '#22c55e'
                          : application.status === 'rejected'
                          ? '#ef4444'
                          : '#fbbf24'
                      }`,
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      {application.status === 'approved' && '✅ 承認済み'}
                      {application.status === 'rejected' && '❌ 拒否済み'}
                      {application.status === 'pending' && '⏳ 承認待ち'}
                    </div>
                  </div>

                  {application.description && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, opacity: 0.9 }}>説明:</div>
                      <div style={{ fontSize: 14, opacity: 0.8 }}>{application.description}</div>
                    </div>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                  }}>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>プラン</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{planDetails.name}</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>最大HUB数</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{planDetails.maxHubs}個</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>SBTランク数</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{planDetails.sbtRanks}段階</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>月額料金</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{planDetails.monthlyFee.toLocaleString()}円</div>
                    </div>
                  </div>

                  {(application.custom_token_address || application.custom_token_reason) && (
                    <div style={{
                      padding: 12,
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ カスタムトークン指定あり</div>
                      {application.custom_token_address && (
                        <div style={{ fontSize: 11, opacity: 0.9, fontFamily: 'monospace', marginBottom: 4 }}>
                          アドレス: {application.custom_token_address}
                        </div>
                      )}
                      {application.custom_token_reason && (
                        <div style={{ fontSize: 11, opacity: 0.9 }}>
                          理由: {application.custom_token_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {application.status === 'approved' && application.tenant_id && (
                    <div style={{
                      padding: 12,
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        テナントID: {application.tenant_id}
                      </div>
                      {application.approved_by && (
                        <div style={{ fontSize: 11, opacity: 0.8, fontFamily: 'monospace' }}>
                          承認者: {application.approved_by}
                        </div>
                      )}
                      {application.approved_at && (
                        <div style={{ fontSize: 11, opacity: 0.8 }}>
                          承認日時: {new Date(application.approved_at).toLocaleString('ja-JP')}
                        </div>
                      )}
                    </div>
                  )}

                  {application.status === 'rejected' && application.rejection_reason && (
                    <div style={{
                      padding: 12,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>拒否理由:</div>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>{application.rejection_reason}</div>
                      {application.approved_by && (
                        <div style={{ fontSize: 11, opacity: 0.8, fontFamily: 'monospace', marginTop: 4 }}>
                          拒否者: {application.approved_by}
                        </div>
                      )}
                    </div>
                  )}

                  {application.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={() => handleApprove(application)}
                        disabled={approving}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          border: 'none',
                          borderRadius: 8,
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: approving ? 'not-allowed' : 'pointer',
                          opacity: approving ? 0.6 : 1,
                        }}
                      >
                        {approving ? '承認中...' : '✅ 承認する'}
                      </button>
                      <button
                        onClick={() => handleReject(application)}
                        disabled={rejecting}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          borderRadius: 8,
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: rejecting ? 'not-allowed' : 'pointer',
                          opacity: rejecting ? 0.6 : 1,
                        }}
                      >
                        {rejecting ? '拒否中...' : '❌ 拒否する'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 承認確認モーダル */}
      {showApproveConfirm && approvingApplication && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#2d2d44',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            color: '#fff',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700 }}>
              承認確認
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, opacity: 0.9 }}>
              以下のテナント申請を承認しますか？
            </p>
            <div style={{
              padding: 16,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {approvingApplication.tenant_name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace' }}>
                {approvingApplication.applicant_address}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowApproveConfirm(false);
                  setApprovingApplication(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmApprove}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                承認する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拒否理由入力モーダル */}
      {showRejectModal && rejectingApplication && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#2d2d44',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            color: '#fff',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700 }}>
              拒否理由入力
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 14, opacity: 0.9 }}>
              以下のテナント申請を拒否します。理由を入力してください。
            </p>
            <div style={{
              padding: 16,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {rejectingApplication.tenant_name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace' }}>
                {rejectingApplication.applicant_address}
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="拒否理由を入力してください（必須）"
              style={{
                width: '100%',
                minHeight: 120,
                padding: 12,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 24,
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingApplication(null);
                  setRejectReason('');
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                  opacity: rejectReason.trim() ? 1 : 0.6,
                }}
              >
                拒否する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ランクプラン管理タブ
 */
function RankPlansTab() {
  const { plans, loading, error, refetch } = useAllTenantRankPlans();
  const { tenants } = useTenantList();
  const { setPlan, setting } = useSetTenantRankPlan();

  // プラン価格管理
  const { pricing, loading: pricingLoading, refetch: refetchPricing } = useRankPlanPricing();
  const { updatePrice, updating: updatingPrice } = useUpdateRankPlanPrice();

  // 編集中のテナントプラン
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [formData, setFormData] = useState<TenantRankPlanForm>({
    tenant_id: 0,
    rank_plan: 'STUDIO',
    is_active: true,
    subscription_end_date: null,
    notes: '',
  });

  // 価格編集状態
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);
  const [priceFormData, setPriceFormData] = useState<{[key: string]: number}>({});

  // テナントIDからテナント名を取得
  const getTenantName = (tenantId: number) => {
    const tenant = tenants.find(t => t.id === String(tenantId));
    return tenant?.name || `テナント #${tenantId}`;
  };

  // テナントのランクプランを取得
  const getTenantPlan = (tenantId: number) => {
    return plans?.find(p => p.tenant_id === tenantId);
  };

  // 編集開始
  const handleEdit = (tenantId: number) => {
    const existingPlan = getTenantPlan(tenantId);
    setEditingTenantId(tenantId);
    setFormData({
      tenant_id: tenantId,
      rank_plan: existingPlan?.rank_plan || 'STUDIO',
      is_active: existingPlan?.is_active ?? true,
      subscription_end_date: existingPlan?.subscription_end_date || null,
      notes: existingPlan?.notes || '',
    });
  };

  // 保存
  const handleSave = async () => {
    if (!editingTenantId) return;

    const success = await setPlan(formData);
    if (success) {
      alert('ランクプランを保存しました');
      setEditingTenantId(null);
      refetch();
    } else {
      alert('保存に失敗しました');
    }
  };

  // キャンセル
  const handleCancel = () => {
    setEditingTenantId(null);
  };

  // 価格編集開始
  const handleEditPrice = (rankPlan: string) => {
    setEditingPriceFor(rankPlan);
    // 空の状態から入力を開始できるように、初期値は設定しない
    const newFormData = { ...priceFormData };
    delete newFormData[rankPlan];
    setPriceFormData(newFormData);
  };

  // 価格保存
  const handleSavePrice = async (rankPlan: string) => {
    const newPrice = priceFormData[rankPlan];
    if (newPrice === undefined || newPrice < 0) {
      alert('有効な価格を入力してください');
      return;
    }

    const success = await updatePrice({
      rank_plan: rankPlan as any,
      price_jpy: newPrice,
    });

    if (success) {
      alert('価格を更新しました');
      setEditingPriceFor(null);
      refetchPricing();
    } else {
      alert('価格の更新に失敗しました');
    }
  };

  // 価格編集キャンセル
  const handleCancelPriceEdit = () => {
    setEditingPriceFor(null);
  };

  if (loading) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18 }}>ランクプラン情報を読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 60,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>エラーが発生しました</div>
        <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>{error}</div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: 16,
          textAlign: 'left',
          fontSize: 13,
          fontFamily: 'monospace',
          maxWidth: 600,
          margin: '0 auto',
        }}>
          <div style={{ marginBottom: 12, opacity: 0.8 }}>考えられる原因:</div>
          <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.7 }}>
            <li>tenant_rank_plansテーブルが作成されていない</li>
            <li>Supabaseの接続設定に問題がある</li>
            <li>RLSポリシーでアクセスが拒否されている</li>
          </ul>
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>テーブル作成SQL:</div>
            <div>supabase/create_tenant_rank_plans.sql</div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            marginTop: 20,
            padding: '12px 24px',
            background: 'rgba(102, 126, 234, 0.8)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔄 再読み込み
        </button>
      </div>
    );
  }

  // テナントIDの一覧（実テナントとランクプランから取得）
  const allTenantIds = Array.from(
    new Set([
      ...tenants.map(t => parseInt(t.id) || 0).filter(id => id > 0),
      ...(plans || []).map(p => p.tenant_id),
    ])
  ).sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>
          🎖️ ランクプラン管理
        </h2>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
          各テナントのランクプラン設定と管理
        </p>

        {/* テナント一覧テーブル */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>テナントID</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>テナント名</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>ランクプラン</th>
                <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>ステータス</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>終了日</th>
                <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {allTenantIds.map((tenantId) => {
                const plan = getTenantPlan(tenantId);
                const isEditing = editingTenantId === tenantId;
                const planDetails = plan ? RANK_PLANS[plan.rank_plan] : null;

                return (
                  <tr
                    key={tenantId}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      background: isEditing ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: 12, fontFamily: 'monospace' }}>#{tenantId}</td>
                    <td style={{ padding: 12 }}>{getTenantName(tenantId)}</td>
                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <select
                          value={formData.rank_plan}
                          onChange={(e) => setFormData({ ...formData, rank_plan: e.target.value as any })}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 6,
                            color: '#fff',
                            fontSize: 13,
                            width: '100%',
                          }}
                        >
                          <option value="STUDIO">STUDIO</option>
                          <option value="STUDIO_PRO">STUDIO PRO</option>
                          <option value="STUDIO_PRO_MAX">STUDIO PRO MAX</option>
                        </select>
                      ) : (
                        <span>
                          {planDetails ? (
                            <span style={{
                              padding: '4px 12px',
                              background: 'rgba(139, 92, 246, 0.2)',
                              border: '1px solid rgba(139, 92, 246, 0.4)',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                            }}>
                              {planDetails.name}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.5, fontSize: 13 }}>未設定</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {isEditing ? (
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            style={{ width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: 13 }}>アクティブ</span>
                        </label>
                      ) : (
                        <span>
                          {plan?.is_active ? (
                            <span style={{
                              padding: '4px 12px',
                              background: 'rgba(34, 197, 94, 0.2)',
                              border: '1px solid rgba(34, 197, 94, 0.4)',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#86efac',
                            }}>
                              ✅ アクティブ
                            </span>
                          ) : plan ? (
                            <span style={{
                              padding: '4px 12px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#fca5a5',
                            }}>
                              ❌ 非アクティブ
                            </span>
                          ) : (
                            <span style={{ opacity: 0.5, fontSize: 13 }}>-</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {isEditing ? (
                        <input
                          type="date"
                          value={formData.subscription_end_date || ''}
                          onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value || null })}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 6,
                            color: '#fff',
                            fontSize: 13,
                            width: '100%',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 13, opacity: 0.8 }}>
                          {plan?.subscription_end_date
                            ? new Date(plan.subscription_end_date).toLocaleDateString('ja-JP')
                            : '-'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleSave}
                            disabled={setting}
                            style={{
                              padding: '6px 16px',
                              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                              border: 'none',
                              borderRadius: 6,
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: setting ? 'not-allowed' : 'pointer',
                              opacity: setting ? 0.6 : 1,
                            }}
                          >
                            {setting ? '保存中...' : '💾 保存'}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={setting}
                            style={{
                              padding: '6px 16px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: 6,
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: setting ? 'not-allowed' : 'pointer',
                              opacity: setting ? 0.6 : 1,
                            }}
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(tenantId)}
                          style={{
                            padding: '6px 16px',
                            background: 'rgba(102, 126, 234, 0.2)',
                            border: '1px solid rgba(102, 126, 234, 0.5)',
                            borderRadius: 6,
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ 編集
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 編集中のメモ欄 */}
        {editingTenantId !== null && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: 'rgba(102, 126, 234, 0.1)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: 12,
          }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              メモ
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="プラン変更の理由や備考を入力..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        )}
      </div>

      {/* プラン詳細説明 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700 }}>
          📋 プラン詳細 {pricingLoading && <span style={{ fontSize: 12, opacity: 0.6 }}>(価格を読み込み中...)</span>}
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
        }}>
          {Object.entries(RANK_PLANS).map(([key, plan]) => {
            const isEditingPrice = editingPriceFor === key;
            const currentPrice = getPlanPrice(pricing, key as any);

            return (
              <div
                key={key}
                style={{
                  padding: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>{plan.description}</div>
                <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>最大HUB数: {plan.maxHubs}個</div>
                  <div>SBTランク数: {plan.sbtRanks}段階</div>
                  <div>カスタムトークン: {plan.customTokenEnabled ? '可' : '不可'}</div>

                  {/* 価格編集UI */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isEditingPrice ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          value={priceFormData[key] !== undefined ? priceFormData[key] : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setPriceFormData({ ...priceFormData, [key]: 0 });
                            } else {
                              const numVal = parseInt(val, 10);
                              setPriceFormData({ ...priceFormData, [key]: isNaN(numVal) ? 0 : numVal });
                            }
                          }}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 13,
                            width: 100,
                          }}
                        />
                        <span style={{ fontSize: 12 }}>円</span>
                        <button
                          onClick={() => handleSavePrice(key)}
                          disabled={updatingPrice}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(34, 197, 94, 0.8)',
                            border: 'none',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 11,
                            cursor: updatingPrice ? 'not-allowed' : 'pointer',
                            opacity: updatingPrice ? 0.5 : 1,
                          }}
                        >
                          {updatingPrice ? '保存中...' : '保存'}
                        </button>
                        <button
                          onClick={handleCancelPriceEdit}
                          disabled={updatingPrice}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(156, 163, 175, 0.8)',
                            border: 'none',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 11,
                            cursor: updatingPrice ? 'not-allowed' : 'pointer',
                            opacity: updatingPrice ? 0.5 : 1,
                          }}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, color: '#fbbf24', fontSize: 14 }}>
                          月額: {currentPrice.toLocaleString()}円
                        </span>
                        <button
                          onClick={() => handleEditPrice(key)}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(102, 126, 234, 0.8)',
                            border: 'none',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 11,
                            cursor: 'pointer',
                            marginLeft: 'auto',
                          }}
                        >
                          ✏️ 編集
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
