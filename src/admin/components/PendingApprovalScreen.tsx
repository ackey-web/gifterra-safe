// src/admin/components/PendingApprovalScreen.tsx
// テナント申請が承認待ちの状態を表示する画面

import type { TenantApplication } from '../../types/tenantApplication';
import { RANK_PLANS } from '../../types/tenantApplication';

interface PendingApprovalScreenProps {
  application: TenantApplication;
}

export function PendingApprovalScreen({ application }: PendingApprovalScreenProps) {
  const planDetails = RANK_PLANS[application.rank_plan];

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
        maxWidth: 500,
        padding: 40,
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 12,
        color: '#fff'
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>

        <h2 style={{
          fontSize: 24,
          marginBottom: 16,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          テナント申請を受付中です
        </h2>

        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.6 }}>
          管理者による承認をお待ちください。<br/>
          承認後、管理画面にアクセスできるようになります。
        </p>

        <div style={{
          padding: 20,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          marginBottom: 24,
          textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>申請内容</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>テナント名</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{application.tenant_name}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>プラン</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {planDetails.name}
              <span style={{ fontSize: 13, opacity: 0.7, marginLeft: 8 }}>
                (¥{planDetails.monthlyFee.toLocaleString()}/月)
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>申請日時</div>
            <div style={{ fontSize: 14 }}>
              {new Date(application.created_at).toLocaleString('ja-JP')}
            </div>
          </div>

          {application.description && (
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>説明</div>
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                {application.description}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: 16,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 8,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            💡 <strong>承認後に利用可能になる機能</strong>
            <ul style={{
              textAlign: 'left',
              margin: '8px 0 0 0',
              paddingLeft: 20,
              fontSize: 12,
              opacity: 0.9,
            }}>
              <li>最大 {planDetails.maxHubs} 個の GIFT HUB</li>
              <li>{planDetails.sbtRanks} 段階の SBT ランク</li>
              {planDetails.hasCustomToken && <li>カスタムトークン対応（拡張予定）</li>}
              {planDetails.hasAdvancedAnalytics && <li>高度な分析機能</li>}
              {planDetails.hasApiIntegration && <li>API連携</li>}
              {planDetails.hasPrioritySupport && <li>優先サポート</li>}
            </ul>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/mypage'}
          style={{
            padding: '12px 32px',
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

        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 24, lineHeight: 1.5 }}>
          ※ 通常1-2営業日以内に承認結果をお知らせします<br/>
          お急ぎの場合はサポートまでお問い合わせください
        </p>
      </div>
    </div>
  );
}
