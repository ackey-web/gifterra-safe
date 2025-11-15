// src/pages/ProfilePage.tsx
// プロフィールページ

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { ROLE_LABELS } from '../types/profile';
import type { UserRole, CustomLink } from '../types/profile';
import { useFollow } from '../hooks/useFollow';
import { useFollowLists } from '../hooks/useFollowLists';
import { FollowListModal } from '../components/FollowListModal';

interface UserProfile {
  display_name: string;
  bio: string;
  avatar_url?: string;
  receive_message?: string;
  cover_image_url?: string;
  website_url?: string;
  custom_links?: CustomLink[];
  roles?: UserRole[];
  location?: string;
  wallet_address: string;
  show_wallet_address?: boolean;
  created_at: string;
  updated_at: string;
}

export function ProfilePage() {
  const isMobile = useIsMobile(); // Capacitorネイティブ & レスポンシブWeb対応
  const [showEditModal, setShowEditModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFollowListModal, setShowFollowListModal] = useState(false);
  const [followListTab, setFollowListTab] = useState<'followers' | 'following'>('followers');
  const { user } = usePrivy();
  const thirdwebAddress = useAddress(); // Thirdwebウォレット（MetaMaskなど）

  // URLパラメータからアドレスを取得（他のユーザーのプロフィール表示用）
  const path = location.pathname;
  const pathAddress = path.split('/profile/')[1] || '';

  // ウォレットアドレスを取得（Privy埋め込みウォレット優先、なければThirdweb）
  // Mypageと同じロジックで、メタマスクアカウント切り替えに対応
  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const currentUserWalletAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';

  // 表示するウォレットアドレス（URLパラメータがあればそれ、なければ自分のアドレス）
  const walletAddress = pathAddress || currentUserWalletAddress;

  // 他のユーザーのプロフィールを見ているかどうか（自分のアドレスと異なる場合）
  const isViewingOtherProfile = pathAddress &&
    pathAddress.length > 0 &&
    pathAddress.toLowerCase() !== currentUserWalletAddress.toLowerCase();

  // フォロー機能（常にフォロワー数・フォロー中の数を取得、フォローボタンは他人のみ）
  const {
    isFollowing,
    followerCount,
    followingCount,
    isLoading: isFollowLoading,
    toggleFollow,
  } = useFollow(
    walletAddress, // 表示中のプロフィールのアドレス（自分・他人問わず）
    isViewingOtherProfile ? currentUserWalletAddress : null // 他人の場合のみ自分のアドレスを渡す
  );

  // フォロー/フォロワーリストを取得（相互フォロー判定のためcurrentUserAddressも渡す）
  const {
    followers,
    following,
    isLoading: isFollowListsLoading,
    refetch: refetchFollowLists,
  } = useFollowLists(walletAddress, currentUserWalletAddress);

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
    // ブラウザ履歴で一つ前の画面に戻る
    window.history.back();
  };

  // フォローバック用のコールバック関数
  const handleFollowUser = async (targetAddress: string) => {
    if (!currentUserWalletAddress) {
      console.error('ウォレットアドレスが取得できません');
      return;
    }

    try {
      // フォロー処理
      const { error } = await supabase.from('user_follows').insert({
        tenant_id: 'default',
        follower_address: currentUserWalletAddress.toLowerCase(),
        following_address: targetAddress.toLowerCase(),
      });

      if (error) {
        console.error('フォローエラー:', error);
        throw error;
      }
    } catch (err) {
      console.error('フォロー処理エラー:', err);
      throw err;
    }
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
          {/* 自分のプロフィールの場合のみ編集ボタンを表示 */}
          {!isViewingOtherProfile && (
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
          )}
        </div>

        {/* プロフィールカード */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: isMobile ? 16 : 20,
            overflow: 'hidden',
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
              {/* カバー画像 */}
              {profile?.cover_image_url && (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  <img
                    src={profile.cover_image_url}
                    alt="カバー画像"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* フォローボタン（カバー画像の下） */}
              {isViewingOtherProfile && currentUserWalletAddress && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: isMobile ? '12px 16px' : '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <button
                    onClick={toggleFollow}
                    disabled={isFollowLoading}
                    style={{
                      padding: isMobile ? '8px 16px' : '10px 20px',
                      background: isFollowing
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: isMobile ? 14 : 15,
                      fontWeight: 600,
                      cursor: isFollowLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isFollowLoading ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isFollowLoading) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isFollowLoading) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                      }
                    }}
                  >
                    {isFollowLoading ? '処理中...' : isFollowing ? 'フォロー解除' : 'フォロー'}
                  </button>
                </div>
              )}

              <div style={{ padding: isMobile ? 20 : 32 }}>
                {/* アイコンと基本情報 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 20,
                    alignItems: isMobile ? 'center' : 'flex-start',
                    marginBottom: 24,
                  }}
                >
                  {/* アイコン */}
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
                      flexShrink: 0,
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
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '👤';
                        }}
                      />
                    ) : (
                      '👤'
                    )}
                  </div>

                  {/* 表示名とロール */}
                  <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                    <h2
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: isMobile ? 20 : 24,
                        fontWeight: 700,
                        color: '#EAF2FF',
                      }}
                    >
                      {profile?.display_name || '未設定'}
                    </h2>

                    {/* フォロワー数・フォロー中の数 */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        marginBottom: 12,
                        justifyContent: isMobile ? 'center' : 'flex-start',
                      }}
                    >
                      <div
                        onClick={() => {
                          setFollowListTab('followers');
                          setShowFollowListModal(true);
                        }}
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          color: 'rgba(255, 255, 255, 0.8)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#667eea';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#EAF2FF' }}>
                          {followerCount}
                        </span>{' '}
                        フォロワー
                      </div>
                      <div
                        onClick={() => {
                          setFollowListTab('following');
                          setShowFollowListModal(true);
                        }}
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          color: 'rgba(255, 255, 255, 0.8)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#667eea';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#EAF2FF' }}>
                          {followingCount}
                        </span>{' '}
                        フォロー中
                      </div>
                    </div>

                    {/* 所在地 */}
                    {profile?.location && (
                      <p
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: isMobile ? 13 : 14,
                          color: 'rgba(255, 255, 255, 0.7)',
                        }}
                      >
                        📍 {profile.location}
                      </p>
                    )}

                    {/* ロール */}
                    {profile?.roles && profile.roles.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          justifyContent: isMobile ? 'center' : 'flex-start',
                        }}
                      >
                        {profile.roles.map((role) => (
                          <span
                            key={role}
                            style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              background: role === 'DEVELOPER'
                                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: 20,
                              fontSize: isMobile ? 11 : 12,
                              fontWeight: 600,
                              color: '#fff',
                            }}
                          >
                            {ROLE_LABELS[role]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 自己紹介 */}
                {profile?.bio && (
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
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* リンク */}
                {(profile?.website_url || (profile?.custom_links && profile.custom_links.length > 0)) && (
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 12,
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.7)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      リンク
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Webサイト */}
                      {profile?.website_url && (
                        <a
                          href={profile.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: isMobile ? '10px 14px' : '12px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            color: '#93c5fd',
                            fontSize: isMobile ? 13 : 14,
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                        >
                          🌐 Webサイト
                        </a>
                      )}

                      {/* カスタムリンク */}
                      {profile?.custom_links && profile.custom_links.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: isMobile ? '10px 14px' : '12px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            color: '#93c5fd',
                            fontSize: isMobile ? 13 : 14,
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                        >
                          🔗 {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* ウォレットアドレス（公開設定がtrueの場合のみ表示） */}
                {profile?.show_wallet_address !== false && (
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
                )}

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
              </div>
            </>
          )}
        </div>

        {/* JPYC受信UI */}
        <div
          style={{
            marginTop: 24,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: isMobile ? 16 : 20,
            padding: isMobile ? 20 : 24,
            backdropFilter: 'blur(10px)',
          }}
        >
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: isMobile ? 16 : 18,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            📱 JPYC受信UI
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: isMobile ? 12 : 13,
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            店舗向けのJPYC受信用QRコードを生成・表示できます
          </p>
          <button
            onClick={() => (window.location.href = '/terminal')}
            style={{
              width: '100%',
              padding: isMobile ? '12px 16px' : '14px 20px',
              background: '#fff',
              border: 'none',
              borderRadius: 10,
              color: '#d97706',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Terminal画面を開く →
          </button>
        </div>
      </div>

      {/* 編集モーダル（自分のプロフィールの場合のみ） */}
      {showEditModal && !isViewingOtherProfile && (
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
            cover_image_url: profile?.cover_image_url || '',
            website_url: profile?.website_url || '',
            custom_links: profile?.custom_links || [],
            roles: profile?.roles || [],
            location: profile?.location || '',
            show_wallet_address: profile?.show_wallet_address,
          }}
          walletAddress={currentUserWalletAddress}
        />
      )}

      {/* フォロー/フォロワーリストモーダル */}
      <FollowListModal
        isOpen={showFollowListModal}
        onClose={() => setShowFollowListModal(false)}
        type={followListTab}
        users={followListTab === 'followers' ? followers : following}
        isLoading={isFollowListsLoading}
        isMobile={isMobile}
        onFollowUser={handleFollowUser}
        onRefresh={refetchFollowLists}
      />
    </div>
  );
}
