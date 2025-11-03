// src/utils/permissions.ts
// 🔐 権限管理・機能制限ユーティリティ（将来のマルチテナント実装準備）

import type { User, Tenant } from '../types/tenant';
import { UserRole, DEFAULT_TENANT, DEFAULT_PLAN } from '../types/tenant';

/**
 * 現在のユーザー情報を取得
 * 現在は単一のスーパーアドミンとして扱い、将来的にテナント情報を含める
 */
export const getCurrentUser = (): User => {
  // TODO: 将来的には実際の認証情報から取得
  return {
    id: 'system-admin',
    walletAddress: '', // 実際のウォレット接続時に更新
    role: UserRole.SUPER_ADMIN,
    tenantId: DEFAULT_TENANT.id,
    isActive: true,
    permissions: ['*'] // スーパーアドミンは全権限
  };
};

/**
 * 現在のテナント情報を取得
 * 現在は単一テナント、将来的にはユーザーの所属テナントを返す
 */
export const getCurrentTenant = (): Tenant => {
  // TODO: 将来的にはユーザーのtenantIdから実際のテナント情報を取得
  return DEFAULT_TENANT;
};

/**
 * 機能へのアクセス権限をチェック
 * 現在は全て許可、将来的にはプランベースで制限
 */
export const hasFeatureAccess = (
  featureKey: string,
  user?: User,
  tenant?: Tenant
): boolean => {
  // 現在の実装：スーパーアドミンはすべてアクセス可能
  const currentUser = user || getCurrentUser();
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // 将来の実装：テナントのプランに基づいてチェック
  const currentTenant = tenant || getCurrentTenant();
  const feature = currentTenant.settings.features.find(f => f.key === featureKey);
  
  return feature?.enabled ?? false;
};

/**
 * 機能制限情報を取得
 * 将来的にUI上で制限理由を表示するために使用
 */
export const getFeatureRestriction = (
  featureKey: string,
  user?: User,
  tenant?: Tenant
): { 
  hasAccess: boolean; 
  reason?: string; 
  upgradeRequired?: boolean 
} => {
  const hasAccess = hasFeatureAccess(featureKey, user, tenant);
  
  if (hasAccess) {
    return { hasAccess: true };
  }

  // 将来の実装例
  return {
    hasAccess: false,
    reason: `${featureKey} 機能は現在のプランに含まれていません`,
    upgradeRequired: true
  };
};

/**
 * プラン制限をチェック
 * 将来的に自販機作成数制限などで使用
 */
export const checkPlanLimit = (
  limitType: keyof Tenant['settings'] | 'vending_machines' | 'monthly_transactions',
  currentUsage: number,
  _tenant?: Tenant
): {
  withinLimit: boolean;
  limit: number;
  remaining: number;
} => {
  // 現在は制限なし
  // const currentTenant = _tenant || getCurrentTenant(); // 将来の実装で使用予定
  
  // 将来の実装：実際のプラン制限をチェック
  const limits = DEFAULT_PLAN.limits;
  
  switch (limitType) {
    case 'vending_machines':
      const machineLimit = limits.maxVendingMachines;
      return {
        withinLimit: machineLimit === -1 || currentUsage < machineLimit,
        limit: machineLimit,
        remaining: machineLimit === -1 ? -1 : Math.max(0, machineLimit - currentUsage)
      };
    
    case 'monthly_transactions':
      const transactionLimit = limits.maxMonthlyTransactions;
      return {
        withinLimit: transactionLimit === -1 || currentUsage < transactionLimit,
        limit: transactionLimit,
        remaining: transactionLimit === -1 ? -1 : Math.max(0, transactionLimit - currentUsage)
      };
      
    default:
      return {
        withinLimit: true,
        limit: -1,
        remaining: -1
      };
  }
};

/**
 * 機能の説明文を取得
 * UI上で機能の説明やアップグレードプロンプトで使用
 */
export const getFeatureDescription = (featureKey: string): string => {
  const descriptions: Record<string, string> = {
    'tip_ui': 'チップ・投げ銭機能を利用できます',
    'reward_ui': 'リワード配布機能を利用できます', 
    'vending_ui': 'デジタル自販機機能を利用できます',
    'analytics': '詳細な分析・統計データを確認できます',
    'custom_branding': 'カスタムロゴ・ブランディング機能を利用できます'
  };
  
  return descriptions[featureKey] || '機能の詳細情報';
};

// ==============================================
// デバッグ・開発支援用ユーティリティ
// ==============================================

/**
 * 現在の権限状態をログ出力（開発用）
 */
export const debugPermissions = () => {
  const features = ['tip_ui', 'reward_ui', 'vending_ui', 'analytics', 'custom_branding'];
  features.forEach(feature => {
    hasFeatureAccess(feature);
  });
};

// 開発環境でのみデバッグ情報を出力
if (process.env.NODE_ENV === 'development') {
  (window as any).debugGifterraPermissions = debugPermissions;
}