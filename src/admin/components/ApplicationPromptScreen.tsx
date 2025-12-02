// src/admin/components/ApplicationPromptScreen.tsx
// テナント未申請ユーザーに申請を促す画面

import { RANK_PLANS } from '../../types/tenantApplication';

export function ApplicationPromptScreen() {
  const handleApply = () => {
    // マイページの申請フォームへ誘導
    window.location.href = '/mypage';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 40,
      textAlign: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <div style={{
        maxWidth: 600,
        padding: 40,
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 12,
        color: '#fff'
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏢</div>

        <h2 style={{
          fontSize: 28,
          marginBottom: 16,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          GIFTERRA テナント申請
        </h2>

        <p style={{ fontSize: 15, opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
          管理画面にアクセスするには、<br/>
          <strong>テナント申請</strong>が必要です。
        </p>

        <div style={{
          padding: 24,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          marginBottom: 32,
        }}>
          <h3 style={{
            fontSize: 18,
            marginBottom: 20,
            fontWeight: 700,
          }}>
            📦 利用可能なプラン
          </h3>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            textAlign: 'left',
          }}>
            {Object.values(RANK_PLANS).map((plan) => (
              <div
                key={plan.id}
                style={{
                  padding: 16,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {plan.name}
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#a78bfa',
                  }}>
                    ¥{plan.monthlyFee.toLocaleString()}<span style={{ fontSize: 13, opacity: 0.7 }}>/月</span>
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                  {plan.description}
                </div>

                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  <div>🎁 最大 <strong>{plan.maxHubs} 個</strong> の GIFT HUB</div>
                  <div>⬆️ <strong>{plan.sbtRanks} 段階</strong> の SBT ランク</div>
                  {plan.hasCustomToken && <div>💎 カスタムトークン対応（拡張予定）</div>}
                  {plan.hasAdvancedAnalytics && <div>📊 高度な分析機能</div>}
                  {plan.hasApiIntegration && <div>🔌 API連携</div>}
                  {plan.hasPrioritySupport && <div>🎯 優先サポート</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: 16,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          ✅ <strong>申請後の流れ</strong>
          <div style={{ marginTop: 8, opacity: 0.9 }}>
            1. テナント申請フォームを送信<br/>
            2. 管理者による審査（1-2営業日）<br/>
            3. 承認後、管理画面へアクセス可能<br/>
            4. コントラクトが自動デプロイされます
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
        }}>
          <button
            onClick={() => window.location.href = '/mypage'}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            マイページに戻る
          </button>

          <button
            onClick={handleApply}
            style={{
              flex: 2,
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
            }}
          >
            🚀 テナント申請を開始
          </button>
        </div>

        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 24, lineHeight: 1.5 }}>
          ※ マイページの「テナント申請」ボタンから申請フォームにアクセスできます<br/>
          ご不明な点はサポートまでお問い合わせください
        </p>
      </div>
    </div>
  );
}
