// src/utils/termsConsent.ts
// 利用規約同意状態の管理

const TERMS_CONSENT_KEY = 'gifterra_terms_consent';

interface TermsConsent {
  accepted: boolean;
  timestamp: string; // ISO 8601形式
  version: string; // 利用規約のバージョン（将来の更新に対応）
}

/**
 * 利用規約への同意状態を取得
 */
export function getTermsConsent(): TermsConsent | null {
  try {
    const stored = localStorage.getItem(TERMS_CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to get terms consent:', error);
    return null;
  }
}

/**
 * 利用規約への同意を記録
 */
export function setTermsConsent(): void {
  const consent: TermsConsent = {
    accepted: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0', // 初期バージョン
  };
  try {
    localStorage.setItem(TERMS_CONSENT_KEY, JSON.stringify(consent));
  } catch (error) {
    console.error('Failed to set terms consent:', error);
  }
}

/**
 * ユーザーが利用規約に同意済みかチェック
 */
export function hasAcceptedTerms(): boolean {
  const consent = getTermsConsent();
  return consent !== null && consent.accepted === true;
}

/**
 * 利用規約の同意状態をクリア（デバッグ用）
 */
export function clearTermsConsent(): void {
  try {
    localStorage.removeItem(TERMS_CONSENT_KEY);
  } catch (error) {
    console.error('Failed to clear terms consent:', error);
  }
}
