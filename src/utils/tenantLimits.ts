// src/utils/tenantLimits.ts
// テナントのランクプランに基づく機能制限チェック

import type { RankPlan } from '../types/tenantApplication';
import { RANK_PLANS } from '../types/tenantApplication';
import type { TenantRankPlanData } from '../hooks/useTenantRankPlan';

/**
 * テナントの制限チェック結果
 */
export interface TenantLimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxAllowed?: number;
}

/**
 * テナントのランクプラン情報を取得
 * プランが未設定の場合はデフォルト(STUDIO)を返す
 */
export function getTenantPlanDetails(plan: TenantRankPlanData | null) {
  if (!plan || !plan.is_active) {
    // プラン未設定または非アクティブの場合はSTUDIOとして扱う
    return RANK_PLANS.STUDIO;
  }
  return RANK_PLANS[plan.rank_plan];
}

/**
 * GIFT HUB作成制限チェック
 */
export function canCreateHub(
  currentHubCount: number,
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  const planDetails = getTenantPlanDetails(plan);

  if (currentHubCount >= planDetails.maxHubs) {
    return {
      allowed: false,
      reason: `GIFT HUBの作成上限に達しました。現在のプラン(${planDetails.name})では最大${planDetails.maxHubs}個まで作成可能です。`,
      currentCount: currentHubCount,
      maxAllowed: planDetails.maxHubs,
    };
  }

  return {
    allowed: true,
    currentCount: currentHubCount,
    maxAllowed: planDetails.maxHubs,
  };
}

/**
 * SBTランク数制限チェック
 */
export function canUseSbtRank(
  requestedRank: number,
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  const planDetails = getTenantPlanDetails(plan);

  if (requestedRank > planDetails.sbtRanks) {
    return {
      allowed: false,
      reason: `このSBTランクは利用できません。現在のプラン(${planDetails.name})では最大${planDetails.sbtRanks}段階まで設定可能です。`,
      currentCount: requestedRank,
      maxAllowed: planDetails.sbtRanks,
    };
  }

  return {
    allowed: true,
    currentCount: requestedRank,
    maxAllowed: planDetails.sbtRanks,
  };
}

/**
 * カスタムトークン利用可否チェック
 */
export function canUseCustomToken(
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  const planDetails = getTenantPlanDetails(plan);

  if (!planDetails.hasCustomToken) {
    return {
      allowed: false,
      reason: `カスタムトークンは利用できません。STUDIO PRO MAXプランにアップグレードしてください。`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * 高度な分析機能利用可否チェック
 */
export function canUseAdvancedAnalytics(
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  const planDetails = getTenantPlanDetails(plan);

  if (!planDetails.hasAdvancedAnalytics) {
    return {
      allowed: false,
      reason: `高度な分析機能は利用できません。STUDIO PRO以上のプランにアップグレードしてください。`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * API連携機能利用可否チェック
 */
export function canUseApiIntegration(
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  const planDetails = getTenantPlanDetails(plan);

  if (!planDetails.hasApiIntegration) {
    return {
      allowed: false,
      reason: `API連携機能は利用できません。STUDIO PRO MAXプランにアップグレードしてください。`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * 優先サポート利用可否チェック
 */
export function hasPrioritySupport(
  plan: TenantRankPlanData | null
): boolean {
  const planDetails = getTenantPlanDetails(plan);
  return planDetails.hasPrioritySupport;
}

/**
 * サブスクリプション期限チェック
 */
export function isSubscriptionActive(
  plan: TenantRankPlanData | null
): TenantLimitCheckResult {
  if (!plan) {
    return {
      allowed: true, // プラン未設定の場合はSTUDIOとして扱うため制限なし
    };
  }

  if (!plan.is_active) {
    return {
      allowed: false,
      reason: 'サブスクリプションが無効化されています。管理者にお問い合わせください。',
    };
  }

  // サブスクリプション終了日チェック
  if (plan.subscription_end_date) {
    const endDate = new Date(plan.subscription_end_date);
    const now = new Date();

    if (now > endDate) {
      return {
        allowed: false,
        reason: `サブスクリプションの有効期限が切れています。期限: ${endDate.toLocaleDateString('ja-JP')}`,
      };
    }
  }

  return {
    allowed: true,
  };
}

/**
 * 包括的な機能制限チェック
 * サブスクリプション状態も含めて全体をチェック
 */
export function checkFeatureAccess(
  featureType: 'hub' | 'sbt_rank' | 'custom_token' | 'analytics' | 'api',
  plan: TenantRankPlanData | null,
  additionalParams?: { currentCount?: number; requestedRank?: number }
): TenantLimitCheckResult {
  // まずサブスクリプション状態をチェック
  const subscriptionCheck = isSubscriptionActive(plan);
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck;
  }

  // 機能別チェック
  switch (featureType) {
    case 'hub':
      return canCreateHub(additionalParams?.currentCount || 0, plan);
    case 'sbt_rank':
      return canUseSbtRank(additionalParams?.requestedRank || 1, plan);
    case 'custom_token':
      return canUseCustomToken(plan);
    case 'analytics':
      return canUseAdvancedAnalytics(plan);
    case 'api':
      return canUseApiIntegration(plan);
    default:
      return { allowed: true };
  }
}

/**
 * プランアップグレード推奨メッセージを生成
 */
export function getUpgradeRecommendation(
  currentPlan: RankPlan | null,
  desiredFeature: string
): string {
  const current = currentPlan ? RANK_PLANS[currentPlan].name : 'STUDIO';

  if (currentPlan === 'STUDIO') {
    return `${desiredFeature}を利用するには、STUDIO PROまたはSTUDIO PRO MAXプランへのアップグレードが必要です。`;
  } else if (currentPlan === 'STUDIO_PRO') {
    return `${desiredFeature}を利用するには、STUDIO PRO MAXプランへのアップグレードが必要です。`;
  }

  return `現在のプラン(${current})では${desiredFeature}はご利用いただけません。`;
}
