// src/components/LoginHistoryModal.tsx
// ログイン履歴表示モーダル

import { createPortal } from 'react-dom';
import { useLoginHistory, type LoginHistoryEntry } from '../hooks/useLoginHistory';

interface LoginHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  isMobile: boolean;
}

export function LoginHistoryModal({
  isOpen,
  onClose,
  walletAddress,
  isMobile,
}: LoginHistoryModalProps) {
  const { history, isLoading } = useLoginHistory(walletAddress);

  if (!isOpen) return null;

  // 相対時間表示
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // デバイス情報の表示
  const getDeviceInfo = (entry: LoginHistoryEntry) => {
    const { device_info, user_agent } = entry;

    if (device_info?.platform) {
      return `${device_info.platform} - ${device_info.timezone || '不明'}`;
    }

    if (user_agent) {
      // User Agentからブラウザ情報を抽出
      if (user_agent.includes('Mobile')) return 'モバイル';
      if (user_agent.includes('Chrome')) return 'Chrome';
      if (user_agent.includes('Firefox')) return 'Firefox';
      if (user_agent.includes('Safari')) return 'Safari';
      return 'デスクトップ';
    }

    return '不明';
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
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
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? 20 : 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              color: '#EAF2FF',
            }}
          >
            🔐 ログイン履歴
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* リスト */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? 16 : 20,
          }}
        >
          {isLoading ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: 32,
                  height: 32,
                  border: '3px solid rgba(255, 255, 255, 0.1)',
                  borderTop: '3px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: 12,
                }}
              />
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}
              </style>
              <div>読み込み中...</div>
            </div>
          ) : history.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div>ログイン履歴はありません</div>
            </div>
          ) : (
            <div>
              {/* 説明 */}
              <p
                style={{
                  margin: '0 0 20px 0',
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: 1.6,
                }}
              >
                最新20件のログイン履歴を表示しています。不審なログインがある場合は、速やかにパスワードを変更してください。
              </p>

              {/* 履歴リスト */}
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: isMobile ? 14 : 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          fontWeight: 600,
                          color: '#EAF2FF',
                          marginBottom: 4,
                        }}
                      >
                        {index === 0 ? '現在のセッション' : `ログイン ${index + 1}`}
                      </div>
                      <div
                        style={{
                          fontSize: isMobile ? 11 : 12,
                          color: 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        {getRelativeTime(entry.login_at)}
                      </div>
                    </div>
                    {index === 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '4px 8px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          borderRadius: 12,
                          fontWeight: 600,
                        }}
                      >
                        現在
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'rgba(255, 255, 255, 0.5)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>デバイス:</span>{' '}
                      {getDeviceInfo(entry)}
                    </div>
                    {entry.ip_address && (
                      <div>
                        <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>IP:</span>{' '}
                        {entry.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          style={{
            padding: isMobile ? 16 : 20,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 11 : 12,
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'rgba(255, 255, 255, 0.7)' }}>セキュリティのヒント:</strong>
            <br />
            不審なログインを発見した場合は、速やかにウォレットの秘密鍵を変更し、サポートにお問い合わせください。
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
