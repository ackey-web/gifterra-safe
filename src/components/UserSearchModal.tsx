// src/components/UserSearchModal.tsx
// ユーザー検索モーダル（ウォレットアドレスで検索）

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
}

export function UserSearchModal({ onClose, isMobile }: UserSearchModalProps) {
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchedUser | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchAddress.trim()) return;

    setIsSearching(true);
    setNotFound(false);
    setSearchResult(null);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name, avatar_url')
        .eq('tenant_id', 'default')
        .eq('wallet_address', searchAddress.toLowerCase().trim())
        .eq('show_wallet_address', true) // 公開設定のユーザーのみ
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

      setSearchResult(data);
    } catch (err) {
      console.error('Search error:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigateToProfile = () => {
    if (searchResult) {
      window.location.href = `/profile/${searchResult.wallet_address}`;
    }
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
              ウォレットアドレス
            </label>
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="0x..."
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
              onKeyPress={(e) => {
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
              ※ウォレットアドレスを公開設定にしているユーザーのみ検索できます
            </p>
          </div>

          {/* 検索ボタン */}
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchAddress.trim()}
            style={{
              width: '100%',
              padding: isMobile ? 12 : 14,
              background:
                isSearching || !searchAddress.trim()
                  ? 'rgba(59, 130, 246, 0.3)'
                  : 'rgba(59, 130, 246, 0.8)',
              border: 'none',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: isSearching || !searchAddress.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: 20,
            }}
            onMouseEnter={(e) => {
              if (!isSearching && searchAddress.trim()) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSearching && searchAddress.trim()) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
              }
            }}
          >
            {isSearching ? '検索中...' : '検索'}
          </button>

          {/* 検索結果 */}
          {searchResult && (
            <div
              style={{
                padding: isMobile ? 16 : 20,
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                {/* プロフィール画像 */}
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: searchResult.avatar_url
                      ? 'transparent'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {searchResult.avatar_url ? (
                    <img
                      src={searchResult.avatar_url}
                      alt={searchResult.display_name}
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
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: isMobile ? 15 : 16,
                      fontWeight: 600,
                      color: '#EAF2FF',
                      marginBottom: 4,
                    }}
                  >
                    {searchResult.display_name || 'Unknown User'}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {searchResult.wallet_address.slice(0, 6)}...
                    {searchResult.wallet_address.slice(-4)}
                  </div>
                </div>
              </div>

              {/* プロフィールを見るボタン */}
              <button
                onClick={handleNavigateToProfile}
                style={{
                  width: '100%',
                  padding: isMobile ? 10 : 12,
                  background: 'rgba(59, 130, 246, 0.8)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
                }}
              >
                プロフィールを見る
              </button>
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
