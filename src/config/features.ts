// src/config/features.ts
// フィーチャーフラグ管理システム
// 本番環境で段階的に新機能を有効化するための設定

/**
 * フィーチャーフラグの型定義
 */
export interface FeatureFlags {
  /** ガスレス決済機能の有効化 */
  enableGaslessPayment: boolean;
  /** ガスレス決済を許可するアドレスのリスト */
  gaslessPaymentAllowlist: string[];
}

/**
 * 環境変数からフィーチャーフラグを取得
 *
 * @returns フィーチャーフラグの設定
 */
export function getFeatureFlags(): FeatureFlags {
  const enableGasless = import.meta.env.VITE_ENABLE_GASLESS_PAYMENT === 'true';
  const allowlistStr = import.meta.env.VITE_GASLESS_PAYMENT_ALLOWLIST || '';

  const allowlist = allowlistStr
    .split(',')
    .map(addr => addr.toLowerCase().trim())
    .filter(addr => addr.length > 0);

  console.log('🎯 Feature Flags:', {
    enableGaslessPayment: enableGasless,
    allowlistCount: allowlist.length,
  });

  return {
    enableGaslessPayment: enableGasless,
    gaslessPaymentAllowlist: allowlist,
  };
}

/**
 * 特定アドレスがガスレス決済を使えるかチェック
 *
 * ロジック:
 * 1. 機能が無効化されている場合 → false
 * 2. Allowlistが空の場合 → true (全員有効)
 * 3. Allowlistにアドレスが含まれている場合 → true
 * 4. それ以外 → false
 *
 * @param userAddress - チェックするユーザーアドレス
 * @returns ガスレス決済が使えるか
 */
export function isGaslessPaymentEnabled(userAddress?: string): boolean {
  const flags = getFeatureFlags();

  // 機能が無効化されている場合
  if (!flags.enableGaslessPayment) {
    console.log('⚠️ Gasless payment is disabled globally');
    return false;
  }

  // Allowlistが空の場合は全員有効
  if (flags.gaslessPaymentAllowlist.length === 0) {
    console.log('✅ Gasless payment enabled for all users (no allowlist)');
    return true;
  }

  // ユーザーアドレスがない場合
  if (!userAddress) {
    console.log('⚠️ No user address provided');
    return false;
  }

  // Allowlistにアドレスが含まれているかチェック
  const isAllowed = flags.gaslessPaymentAllowlist.includes(userAddress.toLowerCase());

  if (isAllowed) {
    console.log('✅ Gasless payment enabled for address:', userAddress);
  } else {
    console.log('⚠️ Address not in allowlist:', userAddress);
  }

  return isAllowed;
}

/**
 * フィーチャーフラグの説明を取得（デバッグ用）
 */
export function getFeatureFlagsDescription(): string {
  const flags = getFeatureFlags();

  if (!flags.enableGaslessPayment) {
    return 'ガスレス決済: 無効';
  }

  if (flags.gaslessPaymentAllowlist.length === 0) {
    return 'ガスレス決済: 全ユーザー有効';
  }

  return `ガスレス決済: ${flags.gaslessPaymentAllowlist.length}件のアドレスのみ有効`;
}
