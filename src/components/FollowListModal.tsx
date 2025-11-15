// src/components/FollowListModal.tsx
// フォロー/フォロワーリストを表示するモーダル

import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { FollowUser } from '../hooks/useFollowLists';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  users: FollowUser[];
  isLoading: boolean;
  isMobile: boolean;
  onFollowUser?: (walletAddress: string) => Promise<void>; // フォローバック用コールバック
  onRefresh?: () => Promise<void>; // リスト再取得用コールバック
}

export function FollowListModal({
  isOpen,
  onClose,
  type,
  users,
  isLoading,
  isMobile,
  onFollowUser,
  onRefresh,
}: FollowListModalProps) {
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

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
            {type === 'followers' ? 'フォロワー' : 'フォロー中'} ({users.length})
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

        {/* リスト */}
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
          ) : users.length === 0 ? (
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
              {type === 'followers' ? 'フォロワーはいません' : 'フォロー中のユーザーはいません'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {users.map((user) => (
                <div
                  key={user.wallet_address}
                  onClick={() => {
                    window.location.href = `/profile/${user.wallet_address}`;
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '10px',
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
                      width: isMobile ? '36px' : '40px',
                      height: isMobile ? '36px' : '40px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: user.avatar_url
                        ? 'transparent'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '16px' : '18px',
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
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: 600,
                        color: '#EAF2FF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '2px',
                      }}
                    >
                      {user.display_name || `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                    </div>
                    {/* フォローリストで相互フォローの場合「フォローされています」を表示 */}
                    {type === 'following' && user.is_following_back && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          marginTop: '4px',
                        }}
                      >
                        フォローされています
                      </div>
                    )}
                  </div>

                  {/* フォロワーリストで未フォローの場合「フォローバック」ボタンを表示 */}
                  {type === 'followers' && user.is_following_me && !user.is_following_back && onFollowUser && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation(); // プロフィール遷移を防ぐ
                        const isFollowing = followingInProgress.has(user.wallet_address);
                        if (isFollowing) return;

                        setFollowingInProgress(prev => new Set(prev).add(user.wallet_address));
                        try {
                          await onFollowUser(user.wallet_address);
                          if (onRefresh) {
                            await onRefresh();
                          }
                        } catch (error) {
                          // エラー時は何もしない
                        } finally {
                          setFollowingInProgress(prev => {
                            const next = new Set(prev);
                            next.delete(user.wallet_address);
                            return next;
                          });
                        }
                      }}
                      disabled={followingInProgress.has(user.wallet_address)}
                      style={{
                        padding: isMobile ? '6px 12px' : '8px 16px',
                        background: followingInProgress.has(user.wallet_address)
                          ? 'rgba(59, 130, 246, 0.3)'
                          : 'rgba(59, 130, 246, 0.8)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#EAF2FF',
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: 600,
                        cursor: followingInProgress.has(user.wallet_address) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!followingInProgress.has(user.wallet_address)) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!followingInProgress.has(user.wallet_address)) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
                        }
                      }}
                    >
                      {followingInProgress.has(user.wallet_address) ? 'フォロー中...' : 'フォローバック'}
                    </button>
                  )}
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
