// src/components/TenantPlanCard.tsx
// 承認済みテナント向けプラン表示・アップグレードカード

import { useState } from 'react';
import type { RankPlan } from '../types/tenantApplication';
import { RANK_PLANS } from '../types/tenantApplication';
import type { TenantRankPlanData } from '../hooks/useTenantRankPlan';
import { getPlanPrice } from '../hooks/useRankPlanPricing';

interface TenantPlanCardProps {
  isMobile: boolean;
  currentPlan: TenantRankPlanData | null;
  tenantId: number;
}

/**
 * プラン別ヘッダーグラデーション
 */
const getPlanGradient = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)';
    case 'STUDIO_PRO':
      return 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)';
    case 'STUDIO_PRO_MAX':
      return 'linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)';
    default:
      return 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
  }
};

const getPlanBorder = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return '1px solid rgba(59, 130, 246, 0.3)';
    case 'STUDIO_PRO':
      return '1px solid rgba(168, 85, 247, 0.3)';
    case 'STUDIO_PRO_MAX':
      return '1px solid rgba(251, 146, 60, 0.3)';
    default:
      return '1px solid rgba(102, 126, 234, 0.2)';
  }
};

const getPlanColor = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return '#3b82f6';
    case 'STUDIO_PRO':
      return '#a855f7';
    case 'STUDIO_PRO_MAX':
      return '#fb923c';
    default:
      return '#667eea';
  }
};

const getPlanIcon = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return '🎨';
    case 'STUDIO_PRO':
      return '⚡';
    case 'STUDIO_PRO_MAX':
      return '🚀';
    default:
      return '✨';
  }
};

/**
 * プラン別ヘッダー画像パス
 * 画像は /public/images/plan-headers/ に配置してください
 */
const getPlanHeaderImage = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return '/images/plan-headers/studio.png';
    case 'STUDIO_PRO':
      return '/images/plan-headers/studio-pro.png';
    case 'STUDIO_PRO_MAX':
      return '/images/plan-headers/studio-pro-max.png';
    default:
      return '/images/plan-headers/default.png';
  }
};

/**
 * 次のプランを取得
 */
const getNextPlan = (currentPlan: RankPlan): RankPlan | null => {
  if (currentPlan === 'STUDIO') return 'STUDIO_PRO';
  if (currentPlan === 'STUDIO_PRO') return 'STUDIO_PRO_MAX';
  return null; // STUDIO_PRO_MAXは最上位
};

export function TenantPlanCard({ isMobile, currentPlan, tenantId }: TenantPlanCardProps) {
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

  if (!currentPlan || !currentPlan.is_active) {
    // プランが存在しないか非アクティブの場合は何も表示しない
    return null;
  }

  const plan = currentPlan.rank_plan;
  const planDetails = RANK_PLANS[plan];
  const nextPlan = getNextPlan(plan);
  const nextPlanDetails = nextPlan ? RANK_PLANS[nextPlan] : null;

  return (
    <div style={{
      background: getPlanGradient(plan),
      border: getPlanBorder(plan),
      borderRadius: isMobile ? 16 : 24,
      padding: isMobile ? 24 : 32,
      overflow: 'hidden',
    }}>
      {/* 現在のプランヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {/* プラン別ヘッダー画像 */}
        <div style={{
          width: '100%',
          height: isMobile ? 120 : 160,
          marginBottom: 16,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <img
            src={getPlanHeaderImage(plan)}
            alt={`${planDetails.name} header`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // 画像読み込み失敗時はアイコンで代替
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
                parent.innerHTML = `<div style="font-size: ${isMobile ? 48 : 64}px">${getPlanIcon(plan)}</div>`;
              }
            }}
          />
        </div>
        <div style={{ fontSize: isMobile ? 16 : 18, opacity: 0.7, marginBottom: 4 }}>
          現在のプラン
        </div>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: isMobile ? 24 : 28,
          fontWeight: 700,
          color: getPlanColor(plan),
        }}>
          {planDetails.name}
        </h2>
        <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.8 }}>
          ¥{planDetails.monthlyFee.toLocaleString()}/月
        </div>
      </div>

      {/* 現在のプラン機能 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: isMobile ? 16 : 20,
        marginBottom: nextPlan ? 24 : 0,
      }}>
        <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, marginBottom: 12 }}>
          ✓ ご利用可能な機能
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 13 : 14 }}>
            <span style={{ opacity: 0.7 }}>• GIFT HUB:</span>
            <span style={{ fontWeight: 600 }}>{planDetails.maxHubs}個</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 13 : 14 }}>
            <span style={{ opacity: 0.7 }}>• SBTランク:</span>
            <span style={{ fontWeight: 600 }}>{planDetails.sbtRanks}段階</span>
          </div>
          {planDetails.hasAdvancedAnalytics && (
            <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.9 }}>
              • 高度な分析機能
            </div>
          )}
          {planDetails.hasCustomToken && (
            <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.9 }}>
              • カスタムトークン対応
            </div>
          )}
          {planDetails.hasApiIntegration && (
            <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.9 }}>
              • API連携
            </div>
          )}
          {planDetails.hasPrioritySupport && (
            <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.9 }}>
              • 優先サポート
            </div>
          )}
        </div>
      </div>

      {/* アップグレードセクション */}
      {nextPlan && nextPlanDetails && (
        <>
          <div style={{
            width: '100%',
            height: 1,
            background: 'rgba(255,255,255,0.1)',
            marginBottom: 24,
          }} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, marginBottom: 16 }}>
              さらにパワーアップ！
            </div>

            {/* 次のプランカード */}
            <div style={{
              background: getPlanGradient(nextPlan),
              border: getPlanBorder(nextPlan),
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {getPlanIcon(nextPlan)}
              </div>
              <div style={{
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700,
                color: getPlanColor(nextPlan),
                marginBottom: 4,
              }}>
                {nextPlanDetails.name}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7, marginBottom: 12 }}>
                ¥{nextPlanDetails.monthlyFee.toLocaleString()}/月
              </div>

              {/* 追加機能 */}
              <div style={{
                fontSize: isMobile ? 12 : 13,
                opacity: 0.9,
                textAlign: 'left',
                paddingLeft: isMobile ? 8 : 12,
              }}>
                {nextPlanDetails.maxHubs > planDetails.maxHubs && (
                  <div style={{ marginBottom: 6 }}>
                    + GIFT HUB {nextPlanDetails.maxHubs - planDetails.maxHubs}個追加
                  </div>
                )}
                {nextPlanDetails.sbtRanks > planDetails.sbtRanks && (
                  <div style={{ marginBottom: 6 }}>
                    + SBTランク {nextPlanDetails.sbtRanks - planDetails.sbtRanks}段階追加
                  </div>
                )}
                {nextPlanDetails.hasAdvancedAnalytics && !planDetails.hasAdvancedAnalytics && (
                  <div style={{ marginBottom: 6 }}>+ 高度な分析機能</div>
                )}
                {nextPlanDetails.hasCustomToken && !planDetails.hasCustomToken && (
                  <div style={{ marginBottom: 6 }}>+ カスタムトークン対応</div>
                )}
                {nextPlanDetails.hasApiIntegration && !planDetails.hasApiIntegration && (
                  <div style={{ marginBottom: 6 }}>+ API連携</div>
                )}
                {nextPlanDetails.hasPrioritySupport && !planDetails.hasPrioritySupport && (
                  <div style={{ marginBottom: 6 }}>+ 優先サポート</div>
                )}
              </div>
            </div>

            {/* アップグレードボタン */}
            <button
              onClick={() => {
                // TODO: アップグレード処理を実装
                alert(`${nextPlanDetails.name}へのアップグレードは運営にお問い合わせください`);
              }}
              style={{
                width: '100%',
                padding: isMobile ? '14px' : '16px',
                background: `linear-gradient(135deg, ${getPlanColor(nextPlan)} 0%, ${getPlanColor(nextPlan)}dd 100%)`,
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: isMobile ? 15 : 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${getPlanColor(nextPlan)}40`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {nextPlanDetails.name}にアップグレード
            </button>
          </div>
        </>
      )}

      {/* 最上位プランの場合 */}
      {!nextPlan && (
        <div style={{
          textAlign: 'center',
          padding: isMobile ? 16 : 20,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          marginTop: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👑</div>
          <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, marginBottom: 4 }}>
            最上位プランをご利用中
          </div>
          <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7 }}>
            すべての機能をお楽しみいただけます
          </div>
        </div>
      )}
    </div>
  );
}
