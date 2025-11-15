// src/components/FollowListModal.tsx
// フォロー/フォロワーリストを表示するモーダル

import { createPortal } from 'react-dom';
import { FollowUser } from '../hooks/useFollowLists';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'followers' | 'following';
  followers: FollowUser[];
  following: FollowUser[];
  isLoading: boolean;
  isMobile: boolean;
  onTabChange: (tab: 'followers' | 'following') => void;
}

export function FollowListModal({
  isOpen,
  onClose,
  activeTab,
  followers,
  following,
  isLoading,
  isMobile,
  onTabChange,
}: FollowListModalProps) {
  if (!isOpen) return null;

  const displayList = activeTab === 'followers' ? followers : following;

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
          width: isMobile ? '100%' : '500px',
          maxWidth: '100%',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '80vh',
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
            padding: isMobile ? '16px' : '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: 700,
              color: '#EAF2FF',
            }}
          >
            {activeTab === 'followers' ? 'フォロワー' : 'フォロー中'}
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

        {/* タブ */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            onClick={() => onTabChange('followers')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'followers' ? '2px solid #667eea' : '2px solid transparent',
              color: activeTab === 'followers' ? '#667eea' : 'rgba(255, 255, 255, 0.6)',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            フォロワー ({followers.length})
          </button>
          <button
            onClick={() => onTabChange('following')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'following' ? '2px solid #667eea' : '2px solid transparent',
              color: activeTab === 'following' ? '#667eea' : 'rgba(255, 255, 255, 0.6)',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            フォロー中 ({following.length})
          </button>
        </div>

        {/* リスト */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '12px' : '16px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
              }}
            >
              読み込み中...
            </div>
          ) : displayList.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              {activeTab === 'followers' ? 'フォロワーはいません' : 'フォロー中のユーザーはいません'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayList.map((user) => (
                <div
                  key={user.wallet_address}
                  onClick={() => {
                    window.location.href = `/profile/${user.wallet_address}`;
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: isMobile ? '12px' : '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  {/* アバター */}
                  <div
                    style={{
                      width: isMobile ? '48px' : '52px',
                      height: isMobile ? '48px' : '52px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: user.avatar_url
                        ? 'transparent'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '20px' : '24px',
                      flexShrink: 0,
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name || 'User'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>

                  {/* ユーザー情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: isMobile ? '14px' : '15px',
                        fontWeight: 600,
                        color: '#EAF2FF',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.display_name || `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`}
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
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontFamily: 'monospace',
                        marginTop: '2px',
                      }}
                    >
                      {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
