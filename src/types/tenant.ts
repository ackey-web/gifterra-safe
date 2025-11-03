// src/types/tenant.ts
// 🚀 将来のマルチテナント実装に向けた基本型定義

/**
 * ユーザーロール定義
 * 現在は SUPER_ADMIN のみ使用、将来的にテナント管理者を追加予定
 */
export const UserRole = {
  SUPER_ADMIN: 'super_admin',      // 運営側管理者（現在の admin UI ユーザー）
  TENANT_ADMIN: 'tenant_admin',    // 導入者管理者（将来実装）
  TENANT_USER: 'tenant_user'       // 導入者の一般ユーザー（将来実装）
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

/**
 * 機能フラグ
 * 現在は全機能有効、将来的にプランベースで制御予定
 */
export interface FeatureFlag {
  key: 'tip_ui' | 'reward_ui' | 'vending_ui' | 'analytics' | 'custom_branding';
  enabled: boolean;
  description?: string;
}

/**
 * プラン制限
 * 将来的にSaaSプランで使用予定
 */
export interface PlanLimits {
  maxVendingMachines: number;        // -1 = 無制限
  maxMonthlyTransactions: number;    // -1 = 無制限
  storageLimit: number;              // MB, -1 = 無制限  
  customDomainAllowed: boolean;
}

/**
 * プラン定義
 * 将来的にサブスクリプションプランで使用
 */
export interface Plan {
  id: string;
  name: string;
  price: number;                     // 月額料金（円）
  features: FeatureFlag[];
  limits: PlanLimits;
  isActive: boolean;
}

/**
 * テナント（導入者）情報
 * 現在は単一テナントとして運用、将来的にマルチテナント対応
 */
export interface Tenant {
  id: string;
  name: string;
  domain?: string;                   // カスタムドメイン（将来実装）
  planId: string;
  ownerId: string;
  ownerWallet: string;
  isActive: boolean;
  createdAt: Date;
  subscriptionExpiry?: Date;         // 将来的にサブスクリプション管理で使用
  settings: TenantSettings;
}

/**
 * テナント設定
 */
export interface TenantSettings {
  branding: {
    logo?: string;
    primaryColor: string;
    companyName: string;
  };
  features: FeatureFlag[];
  customizations: {
    welcomeMessage?: string;
    footerText?: string;
  };
}

/**
 * ユーザー情報（拡張版）
 */
export interface User {
  id: string;
  walletAddress: string;
  role: UserRole;
  tenantId?: string;                 // 所属テナント（将来実装）
  isActive: boolean;
  permissions: string[];             // 細かい権限制御用（将来実装）
}

// ==============================================
// 将来実装用のデフォルト値・定数
// ==============================================

/**
 * デフォルトプラン（現在は全機能有効）
 */
export const DEFAULT_PLAN: Plan = {
  id: 'default',
  name: 'デフォルトプラン',
  price: 0,
  features: [
    { key: 'tip_ui', enabled: true, description: 'Tip UI機能' },
    { key: 'reward_ui', enabled: true, description: 'リワードUI機能' },
    { key: 'vending_ui', enabled: true, description: '自販機UI機能' },
    { key: 'analytics', enabled: true, description: '分析・統計機能' },
    { key: 'custom_branding', enabled: true, description: 'カスタムブランディング' }
  ],
  limits: {
    maxVendingMachines: -1,          // 無制限
    maxMonthlyTransactions: -1,      // 無制限
    storageLimit: -1,                // 無制限
    customDomainAllowed: true
  },
  isActive: true
};

/**
 * デフォルトテナント（現在の単一テナント環境）
 */
export const DEFAULT_TENANT: Tenant = {
  id: 'default-tenant',
  name: 'GIFTERRA テストネット',
  planId: 'default',
  ownerId: 'system',
  ownerWallet: '',                   // 実際のウォレットアドレスが必要な場合は設定
  isActive: true,
  createdAt: new Date(),
  settings: {
    branding: {
      primaryColor: '#f59e0b',
      companyName: 'GIFTERRA'
    },
    features: DEFAULT_PLAN.features,
    customizations: {
      welcomeMessage: 'GIFTERRAへようこそ',
      footerText: 'Presented by METATRON.'
    }
  }
};