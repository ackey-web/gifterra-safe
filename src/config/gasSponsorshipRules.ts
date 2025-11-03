// src/config/gasSponsorshipRules.ts
// ガススポンサーシップのルール定義（パターン3: ハイブリッド方式）

/**
 * ガススポンサーの種類
 */
export type GasSponsor = 'platform' | 'tenant' | 'user';

/**
 * 操作の種類
 */
export type OperationType =
  | 'tip'                    // Tip送信
  | 'claimReward'            // Reward受取
  | 'purchaseFromHub'        // GIFT HUBで特典配布
  | 'mintSBT'                // SBT mint
  | 'transferToken'          // トークン転送
  | '*';                     // その他全て

/**
 * スポンサーシップルール
 */
export interface GasSponsorRule {
  /** 操作の種類 */
  operation: OperationType;

  /** 誰がガス代を負担するか */
  sponsor: GasSponsor;

  /** スポンサー条件 */
  conditions?: {
    /** 最大金額（wei）- この金額以下のみスポンサー */
    maxAmount?: string;

    /** 1日あたりの最大回数 */
    maxPerDay?: number;

    /** 新規ユーザーのみ（最初のN tx） */
    newUserOnly?: boolean;
    firstTransactionsCount?: number;

    /** テナントの売上から自動控除 */
    autoDeductFromRevenue?: boolean;
    deductionRate?: number; // 0.02 = 2%
  };

  /** 優先度（数字が大きいほど優先） */
  priority?: number;
}

/**
 * Phase 1: プラットフォーム全額負担
 *
 * 初期段階では全てのガス代をプラットフォームが負担
 * ユーザー獲得とUX向上を最優先
 */
export const PHASE_1_RULES: GasSponsorRule[] = [
  // 新規ユーザー: 最初の3txは無条件で無料（5tx → 3txに削減してコスト削減）
  {
    operation: '*',
    sponsor: 'platform',
    conditions: {
      newUserOnly: true,
      firstTransactionsCount: 3,
    },
    priority: 100, // 最優先
  },

  // Tip送信: 500 JPYC以下は無料（1000 JPYC → 500 JPYCに削減）
  {
    operation: 'tip',
    sponsor: 'platform',
    conditions: {
      maxAmount: '500000000000000000000', // 500 JPYC（1000 JPYCから削減）
      maxPerDay: 5, // 1日5回まで（10回から削減）
    },
    priority: 90,
  },

  // Reward受取: 常に無料（ユーザー体験維持のため継続）
  {
    operation: 'claimReward',
    sponsor: 'platform',
    priority: 90,
  },

  // SBT mint: 常に無料（エンゲージメント維持のため継続）
  {
    operation: 'mintSBT',
    sponsor: 'platform',
    priority: 90,
  },

  // GIFT HUBでの特典配布: 50 JPYC以下は無料（100 JPYC → 50 JPYCに削減）
  {
    operation: 'purchaseFromHub',
    sponsor: 'platform',
    conditions: {
      maxAmount: '50000000000000000000', // 50 JPYC（100 JPYCから削減）
      maxPerDay: 3, // 1日3回まで（5回から削減）
    },
    priority: 80,
  },

  // その他: ユーザー負担
  {
    operation: '*',
    sponsor: 'user',
    priority: 0,
  },
];

/**
 * Phase 2: ハイブリッド方式
 *
 * 成長段階でコストを最適化
 * テナントの売上から一部を自動控除してガスプールに充当
 */
export const PHASE_2_RULES: GasSponsorRule[] = [
  // 新規ユーザー: 最初の3txは無条件で無料（プラットフォーム負担、5tx → 3txに削減）
  {
    operation: '*',
    sponsor: 'platform',
    conditions: {
      newUserOnly: true,
      firstTransactionsCount: 3,
    },
    priority: 100,
  },

  // Tip送信: プラットフォーム負担（コミュニティ活性化のため、500 JPYCに削減）
  {
    operation: 'tip',
    sponsor: 'platform',
    conditions: {
      maxAmount: '500000000000000000000', // 500 JPYC（1000 JPYCから削減）
      maxPerDay: 5, // 1日5回まで（10回から削減）
    },
    priority: 90,
  },

  // Reward受取: プラットフォーム負担（ユーザー体験重視）
  {
    operation: 'claimReward',
    sponsor: 'platform',
    priority: 90,
  },

  // SBT mint: プラットフォーム負担
  {
    operation: 'mintSBT',
    sponsor: 'platform',
    priority: 90,
  },

  // GIFT HUBでの特典配布: テナント負担（売上から自動控除）
  {
    operation: 'purchaseFromHub',
    sponsor: 'tenant',
    conditions: {
      autoDeductFromRevenue: true,
      deductionRate: 0.02, // 売上の2%をガスプールに
    },
    priority: 80,
  },

  // その他: ユーザー負担
  {
    operation: '*',
    sponsor: 'user',
    priority: 0,
  },
];

/**
 * 現在アクティブなルールセット
 *
 * 環境変数で切り替え可能:
 * - VITE_GAS_SPONSORSHIP_PHASE=1 → Phase 1
 * - VITE_GAS_SPONSORSHIP_PHASE=2 → Phase 2
 */
export function getActiveRules(): GasSponsorRule[] {
  const phase = import.meta.env.VITE_GAS_SPONSORSHIP_PHASE || '1';

  switch (phase) {
    case '2':
      return PHASE_2_RULES;
    case '1':
    default:
      return PHASE_1_RULES;
  }
}

/**
 * 操作に対して適用されるルールを取得
 *
 * @param operation - 操作の種類
 * @param context - コンテキスト情報（金額、ユーザー等）
 * @returns マッチしたルール
 */
export function findMatchingRule(
  operation: OperationType,
  context?: {
    amount?: string;
    userAddress?: string;
    tenantId?: string;
    isNewUser?: boolean;
    dailyTxCount?: number;
  }
): GasSponsorRule | null {
  const rules = getActiveRules();

  // 優先度順にソート
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sortedRules) {
    // 操作タイプがマッチするか
    if (rule.operation !== '*' && rule.operation !== operation) {
      continue;
    }

    // 条件チェック
    if (rule.conditions) {
      const { conditions } = rule;

      // 新規ユーザー限定チェック
      if (conditions.newUserOnly && !context?.isNewUser) {
        continue;
      }

      // 最大金額チェック
      if (conditions.maxAmount && context?.amount) {
        if (BigInt(context.amount) > BigInt(conditions.maxAmount)) {
          continue;
        }
      }

      // 1日の最大回数チェック
      if (conditions.maxPerDay && context?.dailyTxCount !== undefined) {
        if (context.dailyTxCount >= conditions.maxPerDay) {
          continue;
        }
      }
    }

    // マッチした
    return rule;
  }

  // マッチなし
  return null;
}

/**
 * ユーザーが新規かどうかを判定
 *
 * @param userAddress - ユーザーのウォレットアドレス
 * @returns 新規ユーザーかどうか
 */
export async function isNewUser(userAddress: string): Promise<boolean> {
  // TODO: Supabaseやコントラクトから取引履歴を取得
  // 暫定的に常にfalseを返す（Phase 1では全員にスポンサー）
  return false;
}

/**
 * ユーザーの1日の取引回数を取得
 *
 * @param userAddress - ユーザーのウォレットアドレス
 * @param operation - 操作の種類
 * @returns 今日の取引回数
 */
export async function getDailyTransactionCount(
  userAddress: string,
  operation: OperationType
): Promise<number> {
  // TODO: Supabaseから今日の取引履歴を取得
  // 暫定的に0を返す
  return 0;
}

/**
 * ガススポンサーシップの統計情報
 */
export interface GasSponsorStats {
  totalSponsored: number;      // 総スポンサー回数
  totalCost: string;            // 総コスト（wei）
  platformCost: string;         // プラットフォーム負担額
  tenantCost: string;           // テナント負担額
  averageCostPerTx: string;     // 平均コスト
}

/**
 * ガススポンサーシップの統計を取得
 *
 * @returns 統計情報
 */
export async function getGasSponsorStats(): Promise<GasSponsorStats> {
  // TODO: Supabaseから統計データを取得
  return {
    totalSponsored: 0,
    totalCost: '0',
    platformCost: '0',
    tenantCost: '0',
    averageCostPerTx: '0',
  };
}
