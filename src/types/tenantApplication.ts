// src/types/tenantApplication.ts
// テナント申請関連の型定義

/**
 * ランクプラン（Smart ContractとSupabaseで統一）
 * - STUDIO: 1 GIFT HUB, 3段階SBT, 1,500円/月
 * - STUDIO_PRO: 3 GIFT HUB, 5段階SBT, 3,800円/月
 * - STUDIO_PRO_MAX: 10 GIFT HUB, 10段階SBT, 9,800円/月
 */
export type RankPlan = 'STUDIO' | 'STUDIO_PRO' | 'STUDIO_PRO_MAX';

/**
 * 申請ステータス
 */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * ランクプラン詳細情報
 */
export interface RankPlanDetails {
  id: RankPlan;
  name: string;
  maxHubs: number;
  sbtRanks: number;
  monthlyFee: number;
  description: string;
  hasCustomToken: boolean;
  hasAdvancedAnalytics: boolean;
  hasApiIntegration: boolean;
  hasPrioritySupport: boolean;
}

/**
 * テナント申請データ
 */
export interface TenantApplication {
  id: string;
  applicant_address: string;
  tenant_name: string;
  description: string | null;
  rank_plan: RankPlan;
  custom_token_address: string | null;
  custom_token_reason: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  tenant_id: string | null;  // UUID型に変更
  rejection_reason: string | null;
  // GifterraFactory.createTenant()でデプロイされるコントラクトアドレス
  gifterra_address: string | null;
  reward_nft_address: string | null;
  pay_splitter_address: string | null;
  flag_nft_address: string | null;
  random_reward_engine_address: string | null;
}

/**
 * テナント申請フォーム入力データ
 */
export interface TenantApplicationForm {
  tenant_name: string;
  description: string;
  rank_plan: RankPlan;
  has_custom_token: boolean;
  custom_token_address: string;
  custom_token_reason: string;
}

/**
 * ランクプラン一覧定義
 */
export const RANK_PLANS: Record<RankPlan, RankPlanDetails> = {
  STUDIO: {
    id: 'STUDIO',
    name: 'STUDIO',
    maxHubs: 1,
    sbtRanks: 3, // 3段階: Beginner → Supporter → Champion
    monthlyFee: 1500,
    description: 'スタートアップに最適なベーシックプラン',
    hasCustomToken: false,
    hasAdvancedAnalytics: false,
    hasApiIntegration: false,
    hasPrioritySupport: false,
  },
  STUDIO_PRO: {
    id: 'STUDIO_PRO',
    name: 'STUDIO PRO',
    maxHubs: 3,
    sbtRanks: 5, // 5段階: Beginner → Bronze → Silver → Gold → Platinum
    monthlyFee: 3800,
    description: '成長企業向けプロフェッショナルプラン',
    hasCustomToken: false,
    hasAdvancedAnalytics: true,
    hasApiIntegration: false,
    hasPrioritySupport: false,
  },
  STUDIO_PRO_MAX: {
    id: 'STUDIO_PRO_MAX',
    name: 'STUDIO PRO MAX',
    maxHubs: 10,
    sbtRanks: 10, // 10段階: Beginner → Bronze → Silver → Gold → Platinum → Diamond → Ruby → Sapphire → Emerald → Legend
    monthlyFee: 9800,
    description: 'エンタープライズ向けプレミアムプラン',
    hasCustomToken: true,
    hasAdvancedAnalytics: true,
    hasApiIntegration: true,
    hasPrioritySupport: true,
  },
};

/**
 * ランクプランをコントラクトのenum値に変換（GifterraFactory.createTenant用）
 *
 * コントラクト側のenum PlanType:
 * - STUDIO = 0
 * - STUDIO_PRO = 1
 * - STUDIO_PRO_MAX = 2
 * - CUSTOM = 3
 */
export function rankPlanToContractValue(plan: RankPlan): number {
  const mapping: Record<RankPlan, number> = {
    STUDIO: 0,
    STUDIO_PRO: 1,
    STUDIO_PRO_MAX: 2,
  };
  return mapping[plan];
}

/**
 * コントラクトのenum値をランクプランに変換
 */
export function contractValueToRankPlan(value: number): RankPlan {
  const mapping: Record<number, RankPlan> = {
    0: 'STUDIO',
    1: 'STUDIO_PRO',
    2: 'STUDIO_PRO_MAX',
  };
  return mapping[value] || 'STUDIO';
}
