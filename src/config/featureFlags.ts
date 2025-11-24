// src/config/featureFlags.ts
// 機能フラグ管理 - 段階的なロールアウトを可能にする

/**
 * ガスレス決済機能が有効かどうかをチェック
 *
 * 有効化条件:
 * 1. VITE_ENABLE_GASLESS_PAYMENT=true
 * 2. allowlist が空、または現在のアドレスが含まれる
 *
 * @param walletAddress - チェックするウォレットアドレス（オプション）
 * @returns ガスレス決済が利用可能な場合は true
 */
export function isGaslessPaymentEnabled(walletAddress?: string): boolean {
  // 環境変数から設定を読み込み
  const enabled = import.meta.env.VITE_ENABLE_GASLESS_PAYMENT === 'true';

  if (!enabled) {
    return false;
  }

  // allowlist が設定されている場合はチェック
  const allowlist = import.meta.env.VITE_GASLESS_PAYMENT_ALLOWLIST;

  if (!allowlist || allowlist.trim() === '') {
    // allowlist が空の場合は全ユーザーに許可
    return true;
  }

  // walletAddress が提供されていない場合は、機能として有効かどうかのみ返す
  if (!walletAddress) {
    return true; // 機能自体は有効
  }

  // allowlist に含まれているかチェック
  const allowedAddresses = allowlist
    .split(',')
    .map((addr) => addr.trim().toLowerCase());

  return allowedAddresses.includes(walletAddress.toLowerCase());
}

/**
 * Legacy UI（旧UI）が有効かどうかをチェック
 *
 * @returns Legacy UI が利用可能な場合は true
 */
export function isLegacyUIEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_LEGACY_UI !== 'false';
}

/**
 * 新しい履歴機能が有効かどうかをチェック (Phase 2)
 *
 * @returns 新しい履歴機能が利用可能な場合は true
 */
export function isNewHistoryEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_NEW_HISTORY === 'true';
}

/**
 * 新しいFlow機能が有効かどうかをチェック (Phase 3)
 *
 * @returns 新しいFlow機能が利用可能な場合は true
 */
export function isNewFlowEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_NEW_FLOW === 'true';
}
