// src/pages/NotificationsPage.tsx
// 通知一覧ページ

import { useState, useEffect } from 'react';
import { useNotifications, type Notification } from '../hooks/useNotifications';

export function NotificationsPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userAddress, setUserAddress] = useState<string | undefined>();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // ローカルストレージから認証情報を取得
    const authData = localStorage.getItem('gifterra_auth');
    if (authData) {
      try {
        const auth = JSON.parse(authData);
        setUserAddress(auth.address);
      } catch (e) {
        console.error('認証情報の取得エラー:', e);
      }
    }
  }, []);

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(userAddress);

  // 通知タイプ別のアイコン
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'jpyc_received':
        return '💴';
      case 'tip_received':
        return '💰';
      case 'tenant_status_changed':
        return '🏢';
      case 'follow':
        return '👥';
      case 'system_announcement':
        return '📢';
      default:
        return '🔔';
    }
  };

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
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // 通知をクリック
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // 通知タイプに応じて遷移先を変更
    switch (notification.type) {
      case 'follow':
        if (notification.from_address) {
          window.location.href = `/profile/${notification.from_address}`;
        }
        break;
      case 'jpyc_received':
      case 'tip_received':
        if (notification.tx_hash) {
          window.open(`https://polygonscan.com/tx/${notification.tx_hash}`, '_blank');
        }
        break;
      default:
        if (notification.tx_hash) {
          window.open(`https://polygonscan.com/tx/${notification.tx_hash}`, '_blank');
        }
        break;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: isMobile ? '80px 16px 24px' : '100px 24px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? 20 : 32,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <button
              onClick={() => window.history.back()}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← 戻る
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                すべて既読
              </button>
            )}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 24 : 32,
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            🔔 通知
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </span>
            )}
          </h1>
        </div>

        {/* 通知リスト */}
        <div
          style={{
            minHeight: 400,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 80,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: isMobile ? 14 : 16,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: 40,
                  height: 40,
                  border: '4px solid #e2e8f0',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: 16,
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
          ) : notifications.length === 0 ? (
            <div
              style={{
                padding: 80,
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 16 }}>🔕</div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, marginBottom: 8 }}>
                通知はありません
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14 }}>
                新しい通知があるとここに表示されます
              </div>
            </div>
          ) : (
            notifications.map((notification, index) => {
              // スーパーアドミンからの一斉送信アナウンスの背景色
              const isSystemAnnouncement = notification.type === 'system_announcement';

              // デバッグ用ログ（開発時のみ）
              console.log(`🔔 通知[${index}]:`, {
                type: notification.type,
                isSystemAnnouncement,
                title: notification.title,
                is_read: notification.is_read,
                calculatedBgColor: isSystemAnnouncement
                  ? (notification.is_read ? '#fef3c7' : '#fef08a')
                  : (notification.is_read ? '#ffffff' : '#f0f9ff'),
              });

              // 背景色を決定
              let bgColor: string;
              let hoverBgColor: string;

              if (isSystemAnnouncement) {
                // システムアナウンスの場合：アンバー系
                bgColor = notification.is_read ? '#fef3c7' : '#fef08a';
                hoverBgColor = notification.is_read ? '#fde68a' : '#fde047';
              } else {
                // 通常の通知の場合
                bgColor = notification.is_read ? '#ffffff' : '#f0f9ff';
                hoverBgColor = notification.is_read ? '#f8fafc' : '#dbeafe';
              }

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: isMobile ? 16 : 20,
                    borderBottom: index === notifications.length - 1 ? 'none' : '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: bgColor,
                    transition: 'background-color 0.2s',
                    ...(isSystemAnnouncement && {
                      borderLeft: '4px solid #f59e0b',
                    }),
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBgColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = bgColor;
                  }}
                >
                <div style={{ display: 'flex', gap: 16 }}>
                  {/* アイコン */}
                  <div
                    style={{
                      fontSize: isMobile ? 32 : 40,
                      flexShrink: 0,
                      width: isMobile ? 48 : 56,
                      height: isMobile ? 48 : 56,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSystemAnnouncement
                        ? (notification.is_read ? '#fde68a' : '#fbbf24') // アンバー系
                        : (notification.is_read ? '#f1f5f9' : '#dbeafe'), // 通常
                      borderRadius: '50%',
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* 内容 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: notification.is_read ? 400 : 700,
                        fontSize: isMobile ? 15 : 16,
                        color: isSystemAnnouncement ? '#92400e' : '#1a1a1a', // アンバー系のダークカラー
                        marginBottom: 6,
                      }}
                    >
                      {notification.title}
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? 13 : 14,
                        color: isSystemAnnouncement ? '#78350f' : '#64748b', // アンバー系のダークカラー
                        marginBottom: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {notification.message}
                    </div>
                    {notification.amount && (
                      <div
                        style={{
                          fontSize: isMobile ? 14 : 15,
                          fontWeight: 700,
                          color: '#10b981',
                          marginBottom: 8,
                        }}
                      >
                        +{notification.amount} {notification.token_symbol || 'JPYC'}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: isMobile ? 12 : 13,
                        color: '#94a3b8',
                      }}
                    >
                      {getRelativeTime(notification.created_at)}
                    </div>
                  </div>

                  {/* 未読インジケーター */}
                  {!notification.is_read && (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>
    </div>
  );
}
