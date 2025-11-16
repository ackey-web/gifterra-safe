// src/components/NotificationBell.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications, type Notification } from '../hooks/useNotifications';

interface NotificationBellProps {
  userAddress: string | undefined;
  isMobile: boolean;
}

export function NotificationBell({ userAddress, isMobile }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(userAddress);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  // ベルボタンをクリック
  const handleBellClick = () => {
    if (!isOpen && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  // 通知をクリック
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // 通知タイプに応じて遷移先を変更
    switch (notification.type) {
      case 'follow':
        // フォロー通知の場合、フォロワーのプロフィールページに遷移
        if (notification.from_address) {
          window.location.href = `/profile/${notification.from_address}`;
        }
        break;
      case 'jpyc_received':
      case 'tip_received':
        // トランザクション関連の通知の場合、PolygonScanで確認
        if (notification.tx_hash) {
          window.open(`https://polygonscan.com/tx/${notification.tx_hash}`, '_blank');
        }
        break;
      default:
        // その他の通知はトランザクションハッシュがあれば開く
        if (notification.tx_hash) {
          window.open(`https://polygonscan.com/tx/${notification.tx_hash}`, '_blank');
        }
        break;
    }
  };

  return (
    <>
      {/* ベルアイコンボタン */}
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        style={{
          position: 'relative',
          width: isMobile ? 36 : 40,
          height: isMobile ? 36 : 40,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isMobile ? 18 : 20,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        🔔
        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '50%',
              width: isMobile ? 18 : 20,
              height: isMobile ? 18 : 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 10 : 11,
              fontWeight: 700,
              border: '2px solid #1a1a1a',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* ドロップダウン（Portal経由で描画） */}
      {isOpen && buttonRect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: buttonRect.bottom + 5,
            right: window.innerWidth - buttonRect.right,
            width: isMobile ? 320 : 380,
            maxHeight: isMobile ? 400 : 500,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            zIndex: 2147483647,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: isMobile ? 12 : 16,
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, color: '#ffffff' }}>
              🔔 通知
            </div>
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                すべて既読
              </button>
            )}
          </div>

          {/* 通知リスト */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: isMobile ? 340 : 430,
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: isMobile ? 13 : 14,
                }}
              >
                読み込み中...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: isMobile ? 13 : 14,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
                <div>通知はありません</div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: isMobile ? 12 : 14,
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: notification.is_read ? '#ffffff' : '#f0f9ff',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = notification.is_read ? '#f8fafc' : '#dbeafe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.is_read ? '#ffffff' : '#f0f9ff';
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* アイコン */}
                    <div style={{ fontSize: isMobile ? 20 : 24, flexShrink: 0 }}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* 内容 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: notification.is_read ? 400 : 700,
                          fontSize: isMobile ? 13 : 14,
                          color: '#1a1a1a',
                          marginBottom: 4,
                        }}
                      >
                        {notification.title}
                      </div>
                      <div
                        style={{
                          fontSize: isMobile ? 12 : 13,
                          color: '#64748b',
                          marginBottom: 6,
                          lineHeight: 1.4,
                        }}
                      >
                        {notification.message}
                      </div>
                      {notification.amount && (
                        <div
                          style={{
                            fontSize: isMobile ? 13 : 14,
                            fontWeight: 700,
                            color: '#10b981',
                            marginBottom: 6,
                          }}
                        >
                          +{notification.amount} {notification.token_symbol || 'JPYC'}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: isMobile ? 11 : 12,
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
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#3b82f6',
                          flexShrink: 0,
                          marginTop: 6,
                        }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* フッター */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: isMobile ? 10 : 12,
                borderTop: '1px solid #e2e8f0',
                textAlign: 'center',
              }}
            >
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#667eea',
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  window.location.href = '/notifications';
                }}
              >
                すべての通知を見る →
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
