// ========================================
// Feature Flags: ENVベース機能制御
// ========================================

export const FEATURE_FLAGS = {
  // ─────────────────────────────────────
  // UI表示制御
  // ─────────────────────────────────────
  ENABLE_MVP_UI: import.meta.env.VITE_ENABLE_MVP_UI !== 'false', // デフォルトON
  ENABLE_LEGACY_UI: import.meta.env.VITE_ENABLE_LEGACY_UI !== 'false', // デフォルトON

  // ─────────────────────────────────────
  // ウォレット選択
  // ─────────────────────────────────────
  USE_LEGACY_WALLET: import.meta.env.VITE_USE_LEGACY_WALLET === 'true', // デフォルトOFF（Privy使用）

  // ─────────────────────────────────────
  // パフォーマンス設定
  // ─────────────────────────────────────
  POLL_INTERVAL_MS: parseInt(import.meta.env.VITE_POLL_INTERVAL_MS || '0'), // 0=無効
  ENABLE_AUTO_REFRESH: import.meta.env.VITE_ENABLE_AUTO_REFRESH === 'true',

  // ─────────────────────────────────────
  // DB書き込み制御
  // ─────────────────────────────────────
  ALLOW_LEGACY_DB_WRITE: import.meta.env.VITE_ALLOW_LEGACY_DB_WRITE === 'true', // デフォルトOFF

  // ─────────────────────────────────────
  // デバッグ
  // ─────────────────────────────────────
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
} as const;

// ヘルパー関数
export function canUseMVP(): boolean {
  return FEATURE_FLAGS.ENABLE_MVP_UI;
}

export function canUseLegacy(): boolean {
  return FEATURE_FLAGS.ENABLE_LEGACY_UI;
}

export function shouldPoll(): boolean {
  return FEATURE_FLAGS.POLL_INTERVAL_MS > 0 && FEATURE_FLAGS.ENABLE_AUTO_REFRESH;
}

export function canWriteToDB(source: 'mvp' | 'legacy'): boolean {
  if (source === 'mvp') return true; // MVPは常に書き込み可能
  return FEATURE_FLAGS.ALLOW_LEGACY_DB_WRITE;
}

// デバッグログ出力
if (FEATURE_FLAGS.DEBUG_MODE) {
  console.log('[GIFTERRA] Feature Flags:', FEATURE_FLAGS);
}
