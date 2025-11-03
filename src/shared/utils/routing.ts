// ========================================
// Routing: 新旧UI統合ルーティング定義
// ========================================

export const ROUTES = {
  // ─────────────────────────────────────
  // MVP新規UI（/app）
  // ─────────────────────────────────────
  APP_SEND: '/app/send',
  APP_RECEIVE: '/app/receive',
  APP_HISTORY: '/app/history',
  APP_PROFILE: '/app/profile',
  APP_PAY: '/pay', // R2P専用エンドポイント

  // ─────────────────────────────────────
  // Legacy UI（/legacy - 参照専用）
  // ─────────────────────────────────────
  LEGACY_MYPAGE: '/legacy/mypage',
  LEGACY_REWARD: '/legacy/reward',
  LEGACY_TIP: '/legacy/tip',
  LEGACY_VENDING: '/legacy/vending',
  LEGACY_ADMIN: '/legacy/admin',
  LEGACY_ADMIN_MOBILE: '/legacy/admin-mobile',
  LEGACY_CLAIM_HISTORY: '/legacy/claim-history',
  LEGACY_USER_PROFILE: '/legacy/user',
  LEGACY_DOWNLOAD: '/legacy/download',
  LEGACY_PURCHASES: '/legacy/my-purchases',
  LEGACY_SCORE_PROFILE: '/legacy/score-profile',
  LEGACY_SUPER_ADMIN: '/legacy/super-admin',

  // ─────────────────────────────────────
  // 共通ページ
  // ─────────────────────────────────────
  LOGIN: '/login',
  LOGOUT: '/logout',
  HOME: '/',
} as const;

// ルート判定ヘルパー
export function isMVPRoute(path: string): boolean {
  return path.startsWith('/app') || path === '/pay';
}

export function isLegacyRoute(path: string): boolean {
  return path.startsWith('/legacy');
}

export function getDefaultRoute(): string {
  return ROUTES.APP_SEND;
}

// ナビゲーションヘルパー
export function navigateToMVP(route: keyof typeof ROUTES) {
  if (route.startsWith('APP_')) {
    window.location.href = ROUTES[route];
  }
}

export function navigateToLegacy(route: keyof typeof ROUTES) {
  if (route.startsWith('LEGACY_')) {
    window.location.href = ROUTES[route];
  }
}
