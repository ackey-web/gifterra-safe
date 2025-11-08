// src/components/AppWrapper.tsx
// アプリケーション全体のラッパー - 利用規約同意チェックを含む

import { useState, useEffect, ReactNode } from 'react';
import { hasAcceptedTerms, setTermsConsent } from '../utils/termsConsent';
import { TermsOfServiceModal } from './TermsOfServiceModal';

interface AppWrapperProps {
  children: ReactNode;
  isMobile?: boolean;
}

export function AppWrapper({ children, isMobile = false }: AppWrapperProps) {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 利用規約への同意状態をチェック
    const hasAccepted = hasAcceptedTerms();
    setShowTermsModal(!hasAccepted);
    setIsChecking(false);
  }, []);

  const handleAccept = () => {
    setTermsConsent();
    setShowTermsModal(false);
  };

  // チェック中は何も表示しない（ちらつき防止）
  if (isChecking) {
    return null;
  }

  // 利用規約未同意の場合はモーダルを表示
  if (showTermsModal) {
    return <TermsOfServiceModal onAccept={handleAccept} isMobile={isMobile} />;
  }

  // 同意済みの場合は通常のアプリを表示
  return <>{children}</>;
}
