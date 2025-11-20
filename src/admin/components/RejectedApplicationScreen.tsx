// src/admin/components/RejectedApplicationScreen.tsx
// テナント申請が拒否された状態を表示する画面

import type { TenantApplication } from '../../types/tenantApplication';
import { RANK_PLANS } from '../../types/tenantApplication';

interface RejectedApplicationScreenProps {
  application: TenantApplication;
}

export function RejectedApplicationScreen({ application }: RejectedApplicationScreenProps) {
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
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        color: '#fff'
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>

        <h2 style={{
          fontSize: 24,
          marginBottom: 16,
          fontWeight: 700,
          color: '#fca5a5',
        }}>
          申請が承認されませんでした
        </h2>

        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.6 }}>
          テナント申請を確認させていただきましたが、<br/>
          今回は承認を見送らせていただきました。
        </p>

        {application.rejection_reason && (
          <div style={{
            padding: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            marginBottom: 24,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#fca5a5' }}>
              拒否理由
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.95 }}>
              {application.rejection_reason}
            </div>

            {application.approved_by && (
              <div style={{
                fontSize: 11,
                opacity: 0.6,
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'monospace',
              }}>
                処理者: {application.approved_by.slice(0, 6)}...{application.approved_by.slice(-4)}
              </div>
            )}
          </div>
        )}

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
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>申請日時</div>
            <div style={{ fontSize: 14 }}>
              {new Date(application.created_at).toLocaleString('ja-JP')}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>処理日時</div>
            <div style={{ fontSize: 14 }}>
              {application.approved_at ? new Date(application.approved_at).toLocaleString('ja-JP') : '-'}
            </div>
          </div>
        </div>

        <div style={{
          padding: 16,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            💬 <strong>再申請をご希望の場合</strong>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
              拒否理由を確認の上、内容を修正して再度お申し込みください。<br/>
              ご不明な点がございましたら、カスタマーサポートまでお問い合わせください。
            </div>
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
            onClick={() => {
              // TODO: サポートページまたは問い合わせフォームへ遷移
              alert('カスタマーサポートへのお問い合わせ機能は準備中です');
            }}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            サポートに問い合わせ
          </button>
        </div>

        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 24, lineHeight: 1.5 }}>
          サポート営業時間: 平日 10:00-18:00 (土日祝日を除く)
        </p>
      </div>
    </div>
  );
}
