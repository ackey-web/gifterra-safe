// src/components/BookmarkUserModal.tsx
// ブックマークユーザー一覧・管理モーダル

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useUserBookmarks,
  removeBookmark,
  updateBookmarkNickname,
  type UserBookmark,
} from '../hooks/useUserBookmarks';

interface BookmarkUserModalProps {
  userAddress: string | undefined;
  isMobile: boolean;
  onClose: () => void;
  onSelectUser?: (address: string, name?: string) => void; // 送金用の選択コールバック
  mode?: 'view' | 'select'; // 'view': 閲覧・管理モード, 'select': 送金先選択モード
}

export function BookmarkUserModal({
  userAddress,
  isMobile,
  onClose,
  onSelectUser,
  mode = 'view',
}: BookmarkUserModalProps) {
  const { bookmarks, isLoading } = useUserBookmarks(userAddress);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');

  const handleRemoveBookmark = async (bookmarkId: string) => {
    if (!confirm('このブックマークを削除しますか?')) {
      return;
    }

    const result = await removeBookmark(bookmarkId);
    if (result.success) {
      alert('ブックマークを削除しました');
    } else {
      alert(`削除に失敗しました: ${result.error}`);
    }
  };

  const handleStartEditNickname = (bookmark: UserBookmark) => {
    setEditingNickname(bookmark.id);
    setNicknameInput(bookmark.nickname || '');
  };

  const handleSaveNickname = async (bookmarkId: string) => {
    const result = await updateBookmarkNickname(bookmarkId, nicknameInput);
    if (result.success) {
      setEditingNickname(null);
    } else {
      alert(`ニックネーム更新に失敗しました: ${result.error}`);
    }
  };

  const handleSelectUser = (bookmark: UserBookmark) => {
    if (onSelectUser) {
      const displayName = bookmark.nickname || bookmark.profile?.name || 'Unknown';
      onSelectUser(bookmark.bookmarked_address, displayName);
      onClose();
    }
  };

  const shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: isMobile ? 16 : 20,
          padding: isMobile ? 20 : 28,
          maxWidth: isMobile ? '100%' : 600,
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '2px solid rgba(255,255,255,0.1)',
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? 20 : 24,
              fontWeight: 700,
              color: '#EAF2FF',
              margin: 0,
            }}
          >
            ⭐ {mode === 'select' ? 'ブックマークから選択' : 'ブックマークユーザー'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#EAF2FF',
              fontSize: 28,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* ローディング */}
        {isLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            読み込み中...
          </div>
        )}

        {/* ブックマークなし */}
        {!isLoading && bookmarks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: '#94a3b8',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>
              ブックマークがありません
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {mode === 'select'
                ? 'ユーザー検索からブックマークを追加してください'
                : 'よく送金するユーザーをブックマークしましょう'}
            </div>
          </div>
        )}

        {/* ブックマーク一覧 */}
        {!isLoading && bookmarks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: isMobile ? 14 : 16,
                  cursor: mode === 'select' ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  if (mode === 'select') {
                    handleSelectUser(bookmark);
                  }
                }}
                onMouseEnter={(e) => {
                  if (mode === 'select') {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode === 'select') {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  {/* アバター */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: bookmark.profile?.avatar_url
                        ? `url(${bookmark.profile.avatar_url})`
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {!bookmark.profile?.avatar_url && '👤'}
                  </div>

                  {/* 名前・ニックネーム */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingNickname === bookmark.id ? (
                      <input
                        type="text"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveNickname(bookmark.id);
                          } else if (e.key === 'Escape') {
                            setEditingNickname(null);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: '#fff',
                          border: '2px solid #667eea',
                          borderRadius: 6,
                          fontSize: 14,
                          color: '#1a1a1a',
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: '#EAF2FF',
                            marginBottom: 4,
                          }}
                        >
                          {bookmark.nickname || bookmark.profile?.name || 'Unknown'}
                          {bookmark.nickname && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 400,
                                color: '#94a3b8',
                                marginLeft: 8,
                              }}
                            >
                              ({bookmark.profile?.name || 'No Name'})
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#94a3b8',
                            fontFamily: 'monospace',
                          }}
                        >
                          {shortenAddress(bookmark.bookmarked_address)}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 操作ボタン（view モードのみ） */}
                {mode === 'view' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingNickname === bookmark.id ? (
                      <>
                        <button
                          onClick={() => handleSaveNickname(bookmark.id)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(34, 197, 94, 0.2)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            borderRadius: 6,
                            color: '#86efac',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingNickname(null)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(148, 163, 184, 0.2)',
                            border: '1px solid rgba(148, 163, 184, 0.4)',
                            borderRadius: 6,
                            color: '#cbd5e1',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEditNickname(bookmark)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(102, 126, 234, 0.2)',
                            border: '1px solid rgba(102, 126, 234, 0.4)',
                            borderRadius: 6,
                            color: '#a5b4fc',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ ニックネーム編集
                        </button>
                        <button
                          onClick={() => handleRemoveBookmark(bookmark.id)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: 6,
                            color: '#fca5a5',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ 削除
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* 選択モードのインジケーター */}
                {mode === 'select' && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      fontSize: 13,
                      color: '#a5b4fc',
                      textAlign: 'center',
                    }}
                  >
                    クリックして送金先に設定
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* フッター（件数表示） */}
        {!isLoading && bookmarks.length > 0 && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '2px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
              fontSize: 13,
              color: '#94a3b8',
            }}
          >
            {bookmarks.length}件のブックマーク
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
