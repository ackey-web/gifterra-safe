// src/components/UserSearchModal.tsx
// ユーザー検索モーダル（ウォレットアドレス・ユーザー名で検索）

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface UserSearchModalProps {
  onClose: () => void;
  isMobile: boolean;
}

interface SearchedUser {
  wallet_address: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
}

export function UserSearchModal({ onClose, isMobile }: UserSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setNotFound(false);
    setSearchResults([]);

    try {
      const trimmedQuery = searchQuery.trim();

      // ウォレットアドレスで検索（0xで始まる場合）
      if (trimmedQuery.toLowerCase().startsWith('0x')) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('wallet_address, display_name, avatar_url, icon_url, bio')
          .eq('tenant_id', 'default')
          .eq('wallet_address', trimmedQuery.toLowerCase())
          .eq('show_wallet_address', true)
          .maybeSingle();

        if (error) {
          console.error('Search error:', error);
          setNotFound(true);
          return;
        }

        if (!data) {
          setNotFound(true);
          return;
        }

        setSearchResults([{
          wallet_address: data.wallet_address,
          display_name: data.display_name,
          avatar_url: data.avatar_url || data.icon_url || undefined,
          bio: data.bio || undefined,
        }]);
      } else {
        // ユーザー名で検索（部分一致、大文字小文字区別なし）
        const { data, error } = await supabase
          .from('user_profiles')
          .select('wallet_address, display_name, name, avatar_url, icon_url, bio')
          .eq('tenant_id', 'default')
          .eq('show_wallet_address', true)
          .ilike('display_name', `%${trimmedQuery}%`)
          .limit(10);

        if (error) {
          console.error('Search error:', error);
          setNotFound(true);
          return;
        }

        if (!data || data.length === 0) {
          // display_nameで見つからない場合、nameカラムでも検索
          const { data: nameData, error: nameError } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, name, avatar_url, icon_url, bio')
            .eq('tenant_id', 'default')
            .eq('show_wallet_address', true)
            .ilike('name', `%${trimmedQuery}%`)
            .limit(10);

          if (nameError) {
            console.error('Search error:', nameError);
            setNotFound(true);
            return;
          }

          if (!nameData || nameData.length === 0) {
            setNotFound(true);
            return;
          }

          setSearchResults(nameData.map(user => ({
            wallet_address: user.wallet_address,
            display_name: user.display_name || user.name,
            avatar_url: user.avatar_url || user.icon_url || undefined,
            bio: user.bio || undefined,
          })));
        } else {
          setSearchResults(data.map(user => ({
            wallet_address: user.wallet_address,
            display_name: user.display_name || user.name,
            avatar_url: user.avatar_url || user.icon_url || undefined,
            bio: user.bio || undefined,
          })));
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigateToProfile = (walletAddress: string) => {
    window.location.href = `/profile/${walletAddress}`;
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: 999999,
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
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
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
            🔍 ユーザー検索
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
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            ✕
          </button>
        </div>

        {/* 検索フォーム */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: '#EAF2FF',
                marginBottom: 8,
              }}
            >
              ウォレットアドレス または ユーザー名
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="0x... または ユーザー名"
              style={{
                width: '100%',
                padding: isMobile ? 12 : 14,
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 13 : 14,
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <p
              style={{
                fontSize: isMobile ? 11 : 12,
                color: 'rgba(255, 255, 255, 0.5)',
                margin: '8px 0 0 0',
              }}
            >
              ※ウォレットアドレスまたはユーザー名で検索できます（公開設定のユーザーのみ）
            </p>
          </div>

          {/* 検索ボタン */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            style={{
              width: '100%',
              padding: isMobile ? 12 : 14,
              background:
                isSearching || !searchQuery.trim()
                  ? 'rgba(59, 130, 246, 0.3)'
                  : 'rgba(59, 130, 246, 0.8)',
              border: 'none',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: 20,
            }}
            onMouseEnter={(e) => {
              if (!isSearching && searchQuery.trim()) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSearching && searchQuery.trim()) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
              }
            }}
          >
            {isSearching ? '検索中...' : '検索'}
          </button>

          {/* 検索結果 */}
          {searchResults.length > 0 && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                  marginBottom: 12,
                }}
              >
                検索結果 ({searchResults.length}件)
              </div>
              {searchResults.map((user) => (
                <div
                  key={user.wallet_address}
                  onClick={() => handleNavigateToProfile(user.wallet_address)}
                  style={{
                    padding: isMobile ? 12 : 14,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {/* プロフィール画像 */}
                  <div
                    style={{
                      width: isMobile ? 44 : 50,
                      height: isMobile ? 44 : 50,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: user.avatar_url
                        ? 'transparent'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? 20 : 24,
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name}
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
                        fontSize: isMobile ? 14 : 15,
                        fontWeight: 600,
                        color: '#EAF2FF',
                        marginBottom: 2,
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
                          fontSize: isMobile ? 11 : 12,
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginBottom: 2,
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
                        fontSize: isMobile ? 10 : 11,
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 検索結果なし */}
          {notFound && (
            <div
              style={{
                padding: isMobile ? 16 : 20,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? 14 : 15,
                  color: '#FCA5A5',
                  marginBottom: 8,
                }}
              >
                ユーザーが見つかりませんでした
              </div>
              <div
                style={{
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(252, 165, 165, 0.7)',
                }}
              >
                ウォレットアドレスが間違っているか、ユーザーがウォレットアドレスを非公開に設定しています。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
