// src/pages/TenantApplication.tsx
// テナント申請フォーム - 決済完了後に入力可能

import { useState, useEffect } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { usePrivy } from '@privy-io/react-auth';
import { RANK_PLANS, type RankPlan } from '../types/tenantApplication';

interface TenantApplicationProps {
  isMobile?: boolean;
}

export function TenantApplication({ isMobile = false }: TenantApplicationProps) {
  const address = useAddress();
  const { user } = usePrivy();

  // URLパラメータを取得
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') as RankPlan | null;
  const billingCycle = urlParams.get('billing') as 'monthly' | 'yearly' | null;

  const [formData, setFormData] = useState({
    tenant_name: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const walletAddress = address || user?.wallet?.address;

  useEffect(() => {
    // プランが指定されていない場合はプラン選択に戻す
    if (!plan || !billingCycle) {
      window.location.href = '/tenant/plan-selection';
      return;
    }

    // ウォレット未接続の場合
    if (!walletAddress) {
      setFormError('ウォレットを接続してください');
    }
  }, [plan, billingCycle, walletAddress]);

  if (!plan || !billingCycle) {
    return null;
  }

  const planDetails = RANK_PLANS[plan];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // バリデーション
    if (!walletAddress) {
      setFormError('ウォレットを接続してください');
      return;
    }

    if (!formData.tenant_name || formData.tenant_name.length < 3) {
      setFormError('テナント名は3文字以上で入力してください');
      return;
    }

    if (formData.tenant_name.length > 50) {
      setFormError('テナント名は50文字以内で入力してください');
      return;
    }

    // 申請データをlocalStorageに一時保存
    const applicationData = {
      tenant_name: formData.tenant_name,
      description: formData.description,
      rank_plan: plan,
      applicant_address: walletAddress,
    };
    localStorage.setItem('pending_tenant_application', JSON.stringify(applicationData));

    // 決済ページへ遷移
    window.location.href = `/tenant/payment?plan=${plan}&billing=${billingCycle}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      padding: isMobile ? '24px 16px' : '40px 24px',
    }}>
      <div style={{
        maxWidth: 700,
        margin: '0 auto',
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
            テナント申請フォーム
          </h1>
          <p style={{
            fontSize: isMobile ? 14 : 15,
            opacity: 0.7,
          }}>
            申請内容を入力してください。入力後、お支払いページに進みます。
          </p>
        </div>

        {/* 選択プラン情報 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: isMobile ? 20 : 24,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: isMobile ? 14 : 15,
            opacity: 0.6,
            marginBottom: 8,
          }}>
            選択プラン
          </div>
          <div style={{
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            marginBottom: 4,
            color: '#667eea',
          }}>
            {planDetails.name}
          </div>
          <div style={{
            fontSize: isMobile ? 13 : 14,
            opacity: 0.7,
          }}>
            {billingCycle === 'monthly'
              ? `¥${planDetails.monthlyFee.toLocaleString()}/月`
              : `¥${planDetails.monthlyFee * 10}/年（2ヶ月無料）`}
          </div>
        </div>

        {/* 申請フォーム */}
        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: isMobile ? 20 : 28,
            marginBottom: 24,
          }}>
            {/* テナント名 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                テナント名 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.tenant_name}
                onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                placeholder="例: ELEVEN BASS LAB"
                maxLength={50}
                required
                style={{
                  width: '100%',
                  padding: isMobile ? '12px' : '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid #667eea';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                }}
              />
              <div style={{
                fontSize: isMobile ? 12 : 13,
                opacity: 0.6,
                marginTop: 6,
              }}>
                3〜50文字で入力してください
              </div>
            </div>

            {/* 説明（任意） */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                説明（任意）
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="テナントの用途や概要を入力してください（任意）"
                maxLength={500}
                rows={4}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px' : '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid #667eea';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                }}
              />
              <div style={{
                fontSize: isMobile ? 12 : 13,
                opacity: 0.6,
                marginTop: 6,
              }}>
                最大500文字
              </div>
            </div>

            {/* ウォレットアドレス */}
            <div>
              <label style={{
                display: 'block',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                申請者ウォレットアドレス
              </label>
              <div style={{
                padding: isMobile ? '12px' : '14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                fontSize: isMobile ? 13 : 14,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                opacity: 0.8,
              }}>
                {walletAddress || '未接続'}
              </div>
            </div>
          </div>

          {/* エラーメッセージ */}
          {formError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 24,
              fontSize: isMobile ? 13 : 14,
              color: '#ef4444',
            }}>
              ❌ {formError}
            </div>
          )}

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
            <div style={{ fontWeight: 700, marginBottom: 8 }}>📝 次のステップ</div>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>この後、お支払いページに進みます</li>
              <li>Stripe決済完了後、申請が自動的に送信されます</li>
              <li>管理者による審査（通常1-2営業日）</li>
              <li>承認後、テナント用のコントラクトが自動デプロイされます</li>
              <li>管理画面（Admin）にアクセスできるようになります</li>
            </ul>
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={!walletAddress}
            style={{
              width: '100%',
              padding: isMobile ? '16px' : '18px',
              background: !walletAddress
                  ? 'rgba(102, 126, 234, 0.5)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? 16 : 18,
              fontWeight: 700,
              cursor: !walletAddress ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: 16,
            }}
            onMouseEnter={(e) => {
              if (walletAddress) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {!walletAddress ? 'ウォレットを接続してください' : '次へ：お支払いページ'}
          </button>

          {/* キャンセルボタン */}
          <button
            type="button"
            onClick={() => window.location.href = '/tenant/plan-selection'}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 12,
              color: '#fff',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            戻る
          </button>
        </form>
      </div>
    </div>
  );
}
