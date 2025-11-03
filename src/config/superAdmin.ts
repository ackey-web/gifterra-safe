// src/config/superAdmin.ts
// スーパーアドミン設定

/**
 * スーパーアドミンのウォレットアドレス一覧
 *
 * 環境変数から読み込むか、デフォルト値を使用
 * 複数のアドレスはカンマ区切りで設定
 *
 * @example
 * VITE_SUPER_ADMIN_ADDRESSES=0x1234...,0x5678...,0xabcd...
 */
const SUPER_ADMIN_ADDRESSES_ENV = import.meta.env.VITE_SUPER_ADMIN_ADDRESSES || '';

export const SUPER_ADMIN_ADDRESSES: string[] = SUPER_ADMIN_ADDRESSES_ENV
  ? SUPER_ADMIN_ADDRESSES_ENV.split(',').map((addr: string) => addr.trim().toLowerCase())
  : [
      // デフォルトのスーパーアドミンアドレス（開発用）
      // 本番環境では環境変数で上書きすること
      '0x66f1274ad5d042b7571c2efa943370dbcd3459ab', // METATRON管理者
    ];

/**
 * 指定されたアドレスがスーパーアドミンかどうかを判定
 *
 * @param address - チェックするウォレットアドレス
 * @returns スーパーアドミンの場合 true
 */
export function isSuperAdmin(address: string | undefined): boolean {
  if (!address) return false;
  return SUPER_ADMIN_ADDRESSES.includes(address.toLowerCase());
}

/**
 * スーパーアドミン機能の設定
 */
export const SUPER_ADMIN_CONFIG = {
  /** スーパーアドミン機能を有効にするか */
  enabled: import.meta.env.VITE_ENABLE_SUPER_ADMIN !== 'false',

  /** デバッグモード（開発環境では全員をスーパーアドミンとして扱う） */
  debugMode: import.meta.env.VITE_SUPER_ADMIN_DEBUG_MODE === 'true',

  /** アクセス拒否時のリダイレクト先 */
  redirectOnDenied: '/',
} as const;

/**
 * デバッグモード時は全員をスーパーアドミンとして扱う
 */
export function isSuperAdminWithDebug(address: string | undefined): boolean {
  if (SUPER_ADMIN_CONFIG.debugMode && address) {
    return true;
  }
  return isSuperAdmin(address);
}
