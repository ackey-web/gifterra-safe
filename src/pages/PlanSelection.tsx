// src/pages/PlanSelection.tsx
// プラン選択ページ - FLOW, STUDIO, STUDIO PRO, STUDIO PRO MAXの4プランから選択

import { useState } from 'react';
import { RANK_PLANS, type RankPlan } from '../types/tenantApplication';
import flowImage from '../assets/flow.png';
import studioImage from '../assets/studio.png';
import studioProImage from '../assets/studio-pro.png';
import studioProMaxImage from '../assets/studio-pro-max.png';

interface PlanSelectionProps {
  isMobile?: boolean;
}

type BillingCycle = 'monthly' | 'yearly';

const getPlanImage = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO': return studioImage;
    case 'STUDIO_PRO': return studioProImage;
    case 'STUDIO_PRO_MAX': return studioProMaxImage;
    default: return studioImage;
  }
};

const getPlanIcon = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO': return '🎨';
    case 'STUDIO_PRO': return '⚡';
    case 'STUDIO_PRO_MAX': return '🚀';
    default: return '🎨';
  }
};

const getPlanColor = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO': return '#3b82f6';
    case 'STUDIO_PRO': return '#a855f7';
    case 'STUDIO_PRO_MAX': return '#fb923c';
    default: return '#3b82f6';
  }
};

const getPlanGradient = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO':
      return 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)';
    case 'STUDIO_PRO':
      return 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)';
    case 'STUDIO_PRO_MAX':
      return 'linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)';
    default:
      return 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)';
  }
};

const getPlanBorder = (plan: RankPlan): string => {
  switch (plan) {
    case 'STUDIO': return '1px solid rgba(59, 130, 246, 0.3)';
    case 'STUDIO_PRO': return '1px solid rgba(168, 85, 247, 0.3)';
    case 'STUDIO_PRO_MAX': return '1px solid rgba(251, 146, 60, 0.3)';
    default: return '1px solid rgba(59, 130, 246, 0.3)';
  }
};

// 年額料金を計算（2ヶ月分無料）
const getYearlyPrice = (monthlyPrice: number): number => {
  return monthlyPrice * 10; // 12ヶ月 - 2ヶ月 = 10ヶ月分
};

export function PlanSelection({ isMobile = false }: PlanSelectionProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const plans: RankPlan[] = ['STUDIO', 'STUDIO_PRO', 'STUDIO_PRO_MAX'];

  const handleSelectPlan = (plan: RankPlan) => {
    // 申請フォームへ遷移（決済は後）
    window.location.href = `/tenant/application?plan=${plan}&billing=${billingCycle}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      padding: isMobile ? '24px 16px' : '40px 24px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: 40,
        }}>
          <h1 style={{
            fontSize: isMobile ? 24 : 32,
            fontWeight: 700,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            プランを選択
          </h1>
          <p style={{
            fontSize: isMobile ? 14 : 16,
            opacity: 0.8,
            lineHeight: 1.6,
          }}>
            あなたのニーズに合ったプランをお選びください
          </p>
        </div>

        {/* 月額/年額切り替えタブ */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 40,
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: 4,
            display: 'inline-flex',
            gap: 4,
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: isMobile ? '10px 20px' : '12px 32px',
                background: billingCycle === 'monthly'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              月額払い
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: isMobile ? '10px 20px' : '12px 32px',
                background: billingCycle === 'yearly'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              年額払い
              <span style={{
                position: 'absolute',
                top: -8,
                right: -8,
                background: '#22c55e',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                2ヶ月無料
              </span>
            </button>
          </div>
        </div>

        {/* プランカード */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          marginBottom: 40,
        }}>
          {/* FLOWプラン（表示のみ・選択不可） */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: 20,
              padding: isMobile ? 24 : 28,
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden',
              opacity: 0.7,
            }}
          >
            {/* 比較用バッジ */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 12,
            }}>
              比較用
            </div>

            {/* プランアイコン */}
            <div style={{
              fontSize: 56,
              textAlign: 'center',
              marginBottom: 16,
            }}>
              🌊
            </div>

            {/* プラン名 */}
            <h3 style={{
              fontSize: isMobile ? 22 : 24,
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: 8,
              color: '#667eea',
            }}>
              FLOW
            </h3>

            {/* 説明 */}
            <p style={{
              fontSize: isMobile ? 13 : 14,
              opacity: 0.7,
              textAlign: 'center',
              marginBottom: 20,
              minHeight: 40,
              lineHeight: 1.4,
            }}>
              無料プラン（テナント機能なし）
            </p>

            {/* 価格 */}
            <div style={{
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div style={{
                fontSize: isMobile ? 36 : 42,
                fontWeight: 700,
                color: '#667eea',
              }}>
                無料
              </div>
            </div>

            {/* 機能リスト */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}>
              <div style={{
                fontSize: isMobile ? 13 : 14,
                lineHeight: 2,
              }}>
                <div>🎁 GIFT HUB: なし</div>
                <div>⬆️ SBTランク: なし</div>
                <div>📊 基本機能のみ</div>
              </div>
            </div>

            {/* 選択不可ボタン */}
            <button
              disabled
              style={{
                width: '100%',
                padding: isMobile ? '14px' : '16px',
                background: 'rgba(102, 126, 234, 0.3)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: isMobile ? 15 : 16,
                fontWeight: 700,
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              テナント機能なし
            </button>
          </div>

          {/* 有料プラン */}
          {plans.map((planKey) => {
            const plan = RANK_PLANS[planKey];
            const monthlyPrice = plan.monthlyFee;
            const yearlyPrice = getYearlyPrice(monthlyPrice);
            const displayPrice = billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;
            const priceLabel = billingCycle === 'monthly' ? '/月' : '/年';

            return (
              <div
                key={planKey}
                style={{
                  background: getPlanGradient(planKey),
                  border: getPlanBorder(planKey),
                  borderRadius: 20,
                  padding: isMobile ? 24 : 28,
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = `0 12px 32px ${getPlanColor(planKey)}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => handleSelectPlan(planKey)}
              >
                {/* おすすめバッジ */}
                {planKey === 'STUDIO' && (
                  <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: '#22c55e',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 12,
                  }}>
                    おすすめ
                  </div>
                )}

                {/* プランアイコン */}
                <div style={{
                  fontSize: 56,
                  textAlign: 'center',
                  marginBottom: 16,
                }}>
                  {getPlanIcon(planKey)}
                </div>

                {/* プラン名 */}
                <h3 style={{
                  fontSize: isMobile ? 22 : 24,
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: 8,
                  color: getPlanColor(planKey),
                }}>
                  {plan.name}
                </h3>

                {/* 説明 */}
                <p style={{
                  fontSize: isMobile ? 13 : 14,
                  opacity: 0.7,
                  textAlign: 'center',
                  marginBottom: 20,
                  minHeight: 40,
                  lineHeight: 1.4,
                }}>
                  {plan.description}
                </p>

                {/* 価格 */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: 24,
                }}>
                  <div style={{
                    fontSize: isMobile ? 36 : 42,
                    fontWeight: 700,
                    color: getPlanColor(planKey),
                  }}>
                    ¥{displayPrice.toLocaleString()}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 13 : 14,
                    opacity: 0.6,
                  }}>
                    {priceLabel}
                    {billingCycle === 'yearly' && (
                      <span style={{ marginLeft: 8, fontSize: 12 }}>
                        (月額換算: ¥{Math.round(yearlyPrice / 12).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {/* 機能リスト */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}>
                  <div style={{
                    fontSize: isMobile ? 13 : 14,
                    lineHeight: 2,
                  }}>
                    <div>🎁 GIFT HUB: <strong>{plan.maxHubs}基</strong></div>
                    <div>⬆️ SBTランク: <strong>{plan.sbtRanks}段階</strong></div>
                    {plan.hasCustomToken && <div>💎 カスタムトークン対応（拡張予定）</div>}
                    {plan.hasAdvancedAnalytics && <div>📊 高度な分析機能</div>}
                    {plan.hasApiIntegration && <div>🔌 API連携</div>}
                    {plan.hasPrioritySupport && <div>🎯 優先サポート</div>}
                  </div>
                </div>

                {/* 選択ボタン */}
                <button
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px' : '16px',
                    background: `linear-gradient(135deg, ${getPlanColor(planKey)} 0%, ${getPlanColor(planKey)}dd 100%)`,
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(planKey);
                  }}
                >
                  このプランで申請
                </button>
              </div>
            );
          })}
        </div>

        {/* 注記 */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 16,
          padding: isMobile ? 20 : 24,
          marginBottom: 32,
          fontSize: isMobile ? 13 : 14,
          lineHeight: 1.8,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            ℹ️ お支払いと申請の流れ
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>FLOWプラン: 無料ですがテナント機能は利用できません（比較用表示）</li>
            <li>テナント機能: STUDIO以上のプランで利用可能です</li>
            <li>プラン選択後、申請フォームに必要事項を入力します</li>
            <li>申請内容確認後、Stripe決済ページに進みます</li>
            <li>年額払いを選択すると、2ヶ月分が無料になります</li>
            <li>決済完了後、管理者による承認が必要です（通常1-2営業日）</li>
            <li>承認後、コントラクトが自動デプロイされ管理画面にアクセスできます</li>
          </ul>
        </div>

        {/* 戻るボタン */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => window.location.href = '/tenant/introduction'}
            style={{
              padding: isMobile ? '12px 24px' : '14px 32px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            前のページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
