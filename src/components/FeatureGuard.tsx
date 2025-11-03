// src/components/FeatureGuard.tsx
// 🛡️ 機能制限コンポーネント（将来のマルチテナント実装準備）

import React from 'react';
import { getFeatureRestriction, getFeatureDescription } from '../utils/permissions';

interface FeatureGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

/**
 * 機能アクセス制限コンポーネント
 * 現在は全て表示、将来的にプランに基づいて制限
 */
export const FeatureGuard: React.FC<FeatureGuardProps> = ({
  feature,
  children,
  fallback,
  showUpgrade = true
}) => {
  const restriction = getFeatureRestriction(feature);
  
  // 現在は全て許可
  if (restriction.hasAccess) {
    return <>{children}</>;
  }
  
  // 将来の実装：制限時の表示
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return (
    <FeatureLockedMessage 
      feature={feature}
      reason={restriction.reason}
      showUpgrade={showUpgrade && restriction.upgradeRequired}
    />
  );
};

/**
 * 機能ロック時のメッセージコンポーネント
 */
interface FeatureLockedMessageProps {
  feature: string;
  reason?: string;
  showUpgrade?: boolean;
}

const FeatureLockedMessage: React.FC<FeatureLockedMessageProps> = ({
  feature,
  reason,
  showUpgrade = true
}) => {
  const description = getFeatureDescription(feature);
  
  return (
    <div style={{
      padding: 40,
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      textAlign: 'center',
      color: '#fff'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        fontSize: 18,
        color: '#f59e0b'
      }}>
        この機能は利用できません
      </h3>
      <p style={{ 
        margin: '0 0 16px 0', 
        fontSize: 14, 
        opacity: 0.8,
        lineHeight: 1.5
      }}>
        {reason || description}
      </p>
      {showUpgrade && (
        <button
          onClick={() => {
            // TODO: 将来的にプランアップグレードモーダルを表示
            alert('プランアップグレード機能は将来実装予定です');
          }}
          style={{
            background: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          プランをアップグレード
        </button>
      )}
    </div>
  );
};

/**
 * HOC: 機能制限付きコンポーネントラッパー
 * 使用例: const ProtectedVendingUI = withFeatureGuard('vending_ui')(VendingUIComponent);
 */
export const withFeatureGuard = (feature: string) => 
  <P extends object>(Component: React.ComponentType<P>) => {
    const WrappedComponent: React.FC<P> = (props) => (
      <FeatureGuard feature={feature}>
        <Component {...props} />
      </FeatureGuard>
    );
    
    WrappedComponent.displayName = `withFeatureGuard(${Component.displayName || Component.name})`;
    return WrappedComponent;
  };

/**
 * フック: 機能アクセス状態を取得
 */
export const useFeatureAccess = (feature: string) => {
  const restriction = getFeatureRestriction(feature);
  
  return {
    hasAccess: restriction.hasAccess,
    reason: restriction.reason,
    upgradeRequired: restriction.upgradeRequired,
    isLoading: false // 将来的に非同期チェック時に使用
  };
};