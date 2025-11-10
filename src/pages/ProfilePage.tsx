// src/pages/ProfilePage.tsx
// プロフィールページ

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { supabase } from '../lib/supabase';
import { ProfileEditModal } from '../components/ProfileEditModal';

interface UserProfile {
  display_name: string;
  bio: string;
  avatar_url?: string;
  receive_message?: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
}

export function ProfilePage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // ウォレットアドレスを取得（Privy埋め込みウォレットまたは外部ウォレット）
  const walletAddress = user?.wallet?.address || wallets[0]?.address || '';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // プロフィールデータ取得
  const fetchProfile = async () => {
    if (!walletAddress) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', 'default')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle(); // single() の代わりに maybeSingle() を使用

      if (error) {
        console.error('❌ ProfilePage - Profile fetch error:', error);
        setProfile(null);
      } else {
        setProfile(data || null);
      }
    } catch (err) {
      console.error('❌ ProfilePage - Profile fetch exception:', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [walletAddress]);

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #018a9a 0%, #017080 100%)',
        color: '#e0e0e0',
        padding: isMobile ? 16 : 24,
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <button
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: isMobile ? '8px 12px' : '10px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ← 戻る
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 20 : 24,
              fontWeight: 700,
              color: '#EAF2FF',
            }}
          >
            プロフィール
          </h1>
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            編集
          </button>
        </div>

        {/* プロフィールカード */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: isMobile ? 16 : 20,
            padding: isMobile ? 20 : 32,
            backdropFilter: 'blur(10px)',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.6)' }}>
                読み込み中...
              </p>
            </div>
          ) : (
            <>
              {/* アイコン */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: isMobile ? 80 : 100,
                    height: isMobile ? 80 : 100,
                    background: profile?.avatar_url
                      ? 'transparent'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? 40 : 50,
                  }}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="プロフィール画像"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        // 画像読み込み失敗時はデフォルトアイコンを表示
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '👤';
                      }}
                    />
                  ) : (
                    '👤'
                  )}
                </div>
              </div>

              {/* 表示名 */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  表示名
                </label>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 18 : 20,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  {profile?.display_name || '未設定'}
                </p>
              </div>

              {/* 自己紹介 */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  自己紹介
                </label>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 14 : 15,
                    lineHeight: 1.6,
                    color: '#EAF2FF',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {profile?.bio || '未設定'}
                </p>
              </div>

              {/* ウォレットアドレス */}
              <div
                style={{
                  paddingTop: 20,
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  ウォレットアドレス
                </label>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 12 : 13,
                    fontFamily: 'monospace',
                    color: 'rgba(255, 255, 255, 0.8)',
                    wordBreak: 'break-all',
                  }}
                >
                  {walletAddress || '未接続'}
                </p>
              </div>

              {/* プロフィール未設定の場合のメッセージ */}
              {!profile && (
                <div
                  style={{
                    marginTop: 24,
                    padding: 16,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: isMobile ? 13 : 14,
                      color: '#EAF2FF',
                    }}
                  >
                    プロフィールを設定して、GIFTERRAでの活動を始めましょう
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {showEditModal && (
        <ProfileEditModal
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            fetchProfile(); // プロフィール再取得
          }}
          isMobile={isMobile}
          currentProfile={{
            display_name: profile?.display_name || '',
            bio: profile?.bio || '',
            avatar_url: profile?.avatar_url || '',
            receive_message: profile?.receive_message || 'ありがとうございました。',
          }}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
}
