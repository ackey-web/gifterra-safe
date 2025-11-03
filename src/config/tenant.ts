// src/config/tenant.ts
// 🏗️ マルチテナント設定ファイル（将来実装用）

/**
 * マルチテナント機能の有効/無効切り替え
 * 現在は false（単一テナント）、将来的に true に変更してマルチテナント有効化
 */
export const MULTI_TENANT_ENABLED = process.env.REACT_APP_MULTI_TENANT === 'true' || false;

/**
 * テナント分離レベル設定
 */
export const TENANT_ISOLATION = {
  // データベース分離レベル
  DATABASE: 'shared_with_tenant_id' as 'separate_db' | 'shared_with_tenant_id',
  
  // ファイルストレージ分離
  STORAGE: 'tenant_folder' as 'separate_bucket' | 'tenant_folder',
  
  // ドメイン分離
  DOMAIN: 'subdomain' as 'custom_domain' | 'subdomain' | 'path_based'
};

/**
 * 開発・テスト用設定
 */
export const DEV_CONFIG = {
  // デバッグモード：権限チェックの詳細ログを出力
  DEBUG_PERMISSIONS: process.env.NODE_ENV === 'development',
  
  // テストモード：全機能を有効化（プラン制限を無視）
  BYPASS_FEATURE_RESTRICTIONS: process.env.REACT_APP_TEST_MODE === 'true',
  
  // モックデータの使用
  USE_MOCK_DATA: process.env.NODE_ENV === 'development'
};

/**
 * 将来のAPI設定
 */
export const API_CONFIG = {
  // テナント管理API（将来実装）
  TENANT_API_BASE: process.env.REACT_APP_TENANT_API_URL || '/api/tenants',
  
  // サブスクリプション管理API（将来実装）
  BILLING_API_BASE: process.env.REACT_APP_BILLING_API_URL || '/api/billing',
  
  // ファイルアップロードAPI（将来実装）
  UPLOAD_API_BASE: process.env.REACT_APP_UPLOAD_API_URL || '/api/upload'
};

/**
 * セキュリティ設定
 */
export const SECURITY_CONFIG = {
  // JWT有効期限
  JWT_EXPIRY: '24h',
  
  // セッション有効期限
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30分
  
  // API Rate Limiting
  RATE_LIMIT: {
    requests: 100,
    windowMs: 15 * 60 * 1000 // 15分
  }
};

/**
 * 実装準備状況チェック
 */
export const checkImplementationStatus = () => {
  const status = {
    types_defined: true,        // ✅ 型定義完了
    permissions_utils: true,    // ✅ 権限管理ユーティリティ完了
    feature_guards: true,       // ✅ 機能制限コンポーネント完了
    ui_structure: true,         // ✅ UI基本構造完了
    database_schema: false,     // 🚧 データベース設計（未実装）
    authentication: false,     // 🚧 認証システム（未実装）
    api_endpoints: false,       // 🚧 API実装（未実装）
    billing_integration: false // 🚧 課金システム連携（未実装）
  };
  
  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = Object.keys(status).length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);

  return {
    status,
    completedCount,
    totalCount,
    completionPercentage,
    isReadyForImplementation: completedCount >= 4 // 基本構造が完了していればOK
  };
};

// 開発環境でステータスをグローバルに公開
if (process.env.NODE_ENV === 'development') {
  (window as any).checkGifterraMultiTenantStatus = checkImplementationStatus;
}