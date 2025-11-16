// src/components/TransactionSecurityModal.tsx
// トランザクションセキュリティ確認モーダル

import { createPortal } from 'react-dom';

interface TransactionSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  recipientName: string;
  isHighAmount: boolean;
  isSuspicious?: boolean;
  anomalyScore?: number;
  anomalyReasons?: string[];
  isMobile: boolean;
}

export function TransactionSecurityModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  recipientName,
  isHighAmount,
  isSuspicious,
  anomalyScore,
  anomalyReasons,
  isMobile,
}: TransactionSecurityModalProps) {
  if (!isOpen) return null;

  const severityLevel = anomalyScore
    ? anomalyScore >= 70
      ? 'high'
      : anomalyScore >= 50
      ? 'medium'
      : 'low'
    : 'low';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: isSuspicious
            ? '2px solid rgba(239, 68, 68, 0.5)'
            : '1px solid rgba(251, 191, 36, 0.5)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? 20 : 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>
            {isSuspicious ? '⚠️' : '🔔'}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              color: isSuspicious ? '#fca5a5' : '#fbbf24',
              textAlign: 'center',
            }}
          >
            {isSuspicious ? 'セキュリティ警告' : '送金内容の確認'}
          </h2>
        </div>

        {/* コンテンツ */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          {/* 送金情報 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 4,
                }}
              >
                送金先
              </div>
              <div
                style={{
                  fontSize: isMobile ? 15 : 16,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                {recipientName}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: 4,
                }}
              >
                送金額
              </div>
              <div
                style={{
                  fontSize: isMobile ? 20 : 24,
                  fontWeight: 700,
                  color: isHighAmount ? '#fbbf24' : '#10b981',
                }}
              >
                {amount.toLocaleString()} JPYC
              </div>
            </div>
          </div>

          {/* 警告メッセージ */}
          {isHighAmount && (
            <div
              style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: 12,
                padding: isMobile ? 14 : 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#fbbf24',
                  marginBottom: 8,
                }}
              >
                💰 高額送金
              </div>
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(251, 191, 36, 0.9)',
                  lineHeight: 1.5,
                }}
              >
                高額な送金が検出されました。送金先と金額を再度ご確認ください。
              </div>
            </div>
          )}

          {/* 異常検知警告 */}
          {isSuspicious && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                padding: isMobile ? 14 : 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#ef4444',
                  }}
                >
                  🚨 疑わしい取引を検出
                </div>
                {anomalyScore && (
                  <span
                    style={{
                      padding: '4px 12px',
                      background:
                        severityLevel === 'high'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : severityLevel === 'medium'
                          ? 'rgba(251, 191, 36, 0.2)'
                          : 'rgba(59, 130, 246, 0.2)',
                      color:
                        severityLevel === 'high'
                          ? '#ef4444'
                          : severityLevel === 'medium'
                          ? '#fbbf24'
                          : '#60a5fa',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    リスク: {anomalyScore.toFixed(0)}点
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(239, 68, 68, 0.9)',
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                以下の理由により、この取引は疑わしいと判断されました:
              </div>

              {anomalyReasons && anomalyReasons.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 0 20px',
                    fontSize: isMobile ? 12 : 13,
                    color: 'rgba(239, 68, 68, 0.9)',
                  }}
                >
                  {anomalyReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 注意事項 */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 14 : 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 12 : 13,
                color: 'rgba(147, 197, 253, 0.9)',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#60a5fa' }}>重要な注意事項:</strong>
              <br />
              • 送金は取り消すことができません
              <br />
              • 送金先アドレスと金額を再度ご確認ください
              <br />
              • 不審な点がある場合は送金を中止してください
              <br />• 詐欺の可能性がある場合はサポートにお問い合わせください
            </div>
          </div>

          {/* ボタン */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: isMobile ? 14 : 16,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 12,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: isMobile ? 14 : 16,
                background: isSuspicious
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isSuspicious
                  ? '0 4px 16px rgba(239, 68, 68, 0.3)'
                  : '0 4px 16px rgba(16, 185, 129, 0.3)',
              }}
            >
              {isSuspicious ? '理解して続行' : '確認して送金'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
