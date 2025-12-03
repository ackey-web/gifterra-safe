// src/pages/TenantPayment.tsx
// Stripe決済ページ - 有料プランの決済を処理

import { useState, useEffect } from 'react';
import { RANK_PLANS, type RankPlan } from '../types/tenantApplication';
import { loadStripe } from '@stripe/stripe-js';
import { useSubmitTenantApplication } from '../hooks/useTenantApplications';

// Stripe公開可能キー（環境変数から読み込み）
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface TenantPaymentProps {
  isMobile?: boolean;
}

export function TenantPayment({ isMobile = false }: TenantPaymentProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submit } = useSubmitTenantApplication();

  // URLパラメータを取得
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') as RankPlan | null;
  const billingCycle = urlParams.get('billing') as 'monthly' | 'yearly' | null;

  useEffect(() => {
    // プランまたは課金サイクルが指定されていない場合はプラン選択に戻す
    if (!plan || !billingCycle) {
      window.location.href = '/tenant/plan-selection';
      return;
    }

    // localStorageから申請データを確認
    const savedData = localStorage.getItem('pending_tenant_application');
    if (!savedData) {
      // 申請データがない場合は申請フォームに戻す
      window.location.href = `/tenant/application?plan=${plan}&billing=${billingCycle}`;
      return;
    }
  }, [plan, billingCycle]);

  if (!plan || !billingCycle) {
    return null;
  }

  const planDetails = RANK_PLANS[plan];
  const monthlyPrice = planDetails.monthlyFee;
  const yearlyPrice = monthlyPrice * 10; // 2ヶ月無料
  const totalPrice = billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;

  const handlePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      // localStorageから申請データを取得
      const savedDataStr = localStorage.getItem('pending_tenant_application');
      if (!savedDataStr) {
        setError('申請データが見つかりません。もう一度申請フォームから入力してください。');
        return;
      }

      const applicationData = JSON.parse(savedDataStr);

      // TODO: バックエンドAPIでStripe Checkoutセッションを作成
      // 現時点ではモック実装 - 実際にはバックエンドにリクエストを送信

      // 仮の決済成功シミュレーション（3秒後）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 決済成功後、申請を送信
      const success = await submit(applicationData);

      if (success) {
        // localStorageをクリア
        localStorage.removeItem('pending_tenant_application');

        // マイページにリダイレクト
        window.location.href = '/mypage?application_submitted=true';
      } else {
        setError('申請の送信に失敗しました。もう一度お試しください。');
      }

      /* 実際の実装例:
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          billingCycle,
          applicationData,
        }),
      });

      const { sessionId } = await response.json();
      const stripe = await stripePromise;

      if (stripe) {
        // Stripe Checkoutにリダイレクト
        // 決済完了後のコールバックで申請を送信
        await stripe.redirectToCheckout({ sessionId });
      }
      */
    } catch (err) {
      console.error('決済エラー:', err);
      setError('決済処理中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      padding: isMobile ? '24px 16px' : '40px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: 600,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        padding: isMobile ? 32 : 40,
      }}>
        {/* ヘッダー */}
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <h1 style={{
            fontSize: isMobile ? 24 : 28,
            fontWeight: 700,
            marginBottom: 8,
          }}>
            お支払い
          </h1>
          <p style={{
            fontSize: isMobile ? 14 : 15,
            opacity: 0.7,
          }}>
            プラン申請のお支払いを完了してください
          </p>
        </div>

        {/* プラン詳細 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 16,
          padding: isMobile ? 20 : 24,
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700 }}>
                {planDetails.name}
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, opacity: 0.6 }}>
                {billingCycle === 'monthly' ? '月額プラン' : '年額プラン（2ヶ月無料）'}
              </div>
            </div>
            <div style={{
              fontSize: isMobile ? 24 : 28,
              fontWeight: 700,
              color: '#667eea',
            }}>
              ¥{totalPrice.toLocaleString()}
            </div>
          </div>

          {/* プラン内容 */}
          <div style={{ fontSize: isMobile ? 13 : 14, lineHeight: 2 }}>
            <div>🎁 GIFT HUB: {planDetails.maxHubs}基</div>
            <div>⬆️ SBTランク: {planDetails.sbtRanks}段階</div>
            {planDetails.hasCustomToken && <div>💎 カスタムトークン対応（拡張予定）</div>}
            {planDetails.hasAdvancedAnalytics && <div>📊 高度な分析機能</div>}
            {planDetails.hasApiIntegration && <div>🔌 API連携</div>}
            {planDetails.hasPrioritySupport && <div>🎯 優先サポート</div>}
          </div>
        </div>

        {/* 注記 */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 12,
          padding: isMobile ? 16 : 20,
          marginBottom: 24,
          fontSize: isMobile ? 13 : 14,
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📝 お支払い後の流れ</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>決済完了後、申請が自動的に送信されます</li>
            <li>管理者による審査（通常1-2営業日）</li>
            <li>承認後、テナント用のコントラクトが自動デプロイされます</li>
            <li>管理画面（Admin）にアクセスできるようになります</li>
          </ul>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: isMobile ? 16 : 20,
            marginBottom: 24,
            fontSize: isMobile ? 13 : 14,
            color: '#ef4444',
          }}>
            ❌ {error}
          </div>
        )}

        {/* 決済ボタン */}
        <button
          onClick={handlePayment}
          disabled={processing}
          style={{
            width: '100%',
            padding: isMobile ? '16px' : '18px',
            background: processing
              ? 'rgba(102, 126, 234, 0.5)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            cursor: processing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: 16,
          }}
          onMouseEnter={(e) => {
            if (!processing) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {processing ? '処理中...' : `¥${totalPrice.toLocaleString()} を支払う`}
        </button>

        {/* キャンセルボタン */}
        <button
          onClick={() => window.location.href = `/tenant/application?plan=${plan}&billing=${billingCycle}`}
          disabled={processing}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 12,
            color: '#fff',
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            cursor: processing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!processing) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          戻る：申請内容を修正
        </button>

        {/* セキュリティ情報 */}
        <div style={{
          textAlign: 'center',
          fontSize: isMobile ? 11 : 12,
          opacity: 0.5,
          marginTop: 24,
          lineHeight: 1.6,
        }}>
          🔒 すべての決済はStripeによって安全に処理されます<br />
          クレジットカード情報は当社のサーバーに保存されません
        </div>
      </div>
    </div>
  );
}
