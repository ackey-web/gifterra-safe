// src/components/RoleUsersModal.tsx
// ロール別ユーザーリストを表示するモーダル

import { createPortal } from 'react-dom';
import type { UserRole, ROLE_LABELS } from '../types/profile';
import type { RoleUser } from '../hooks/useRoleUsers';

interface RoleUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole | null;
  roleLabel: string;
  users: RoleUser[];
  isLoading: boolean;
  isMobile: boolean;
}

export function RoleUsersModal({
  isOpen,
  onClose,
  role,
  roleLabel,
  users,
  isLoading,
  isMobile,
}: RoleUsersModalProps) {
  if (!isOpen || !role) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: isMobile ? '0' : '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: isMobile ? '0' : '16px',
          width: isMobile ? '100%' : '480px',
          maxWidth: '100%',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 700,
              color: '#EAF2FF',
            }}
          >
            {roleLabel} ({users.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
          >
            ×
          </button>
        </div>

        {/* ユーザーリスト */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '8px' : '12px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(255, 255, 255, 0.1)',
                  borderTop: '3px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '12px',
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
          ) : users.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
              }}
            >
              {roleLabel}のユーザーはまだいません
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.wallet_address}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '12px',
                  padding: isMobile ? '10px' : '12px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
                onClick={() => {
                  window.location.href = `/profile/${user.wallet_address}`;
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* アバター */}
                  <div
                    style={{
                      width: isMobile ? '44px' : '48px',
                      height: isMobile ? '44px' : '48px',
                      borderRadius: '50%',
                      background: user.avatar_url
                        ? `url(${user.avatar_url})`
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: isMobile ? '18px' : '20px',
                      fontWeight: 600,
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {!user.avatar_url && (user.display_name?.[0] || '?')}
                  </div>

                  {/* ユーザー情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: isMobile ? '14px' : '15px',
                        fontWeight: 600,
                        color: '#EAF2FF',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.display_name || 'Unknown User'}
                    </div>
                    {user.bio && (
                      <div
                        style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.bio}
                      </div>
                    )}
                    {/* ロールバッジ */}
                    {user.roles && user.roles.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          marginTop: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {user.roles.slice(0, 3).map((r) => (
                          <span
                            key={r}
                            style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              background: 'rgba(102, 126, 234, 0.2)',
                              color: '#a8b3ff',
                              borderRadius: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
