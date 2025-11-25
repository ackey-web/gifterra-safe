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
import { TipModal } from '../components/TipModal';
import { useRoleUsers } from '../hooks/useRoleUsers';
import { RoleUsersModal } from '../components/RoleUsersModal';
import { addBookmark, removeBookmark, isBookmarked } from '../hooks/useUserBookmarks';

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
  twitter_id?: string;
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
  const [showTipModal, setShowTipModal] = useState(false);
  const [showRoleUsersModal, setShowRoleUsersModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isUserBookmarked, setIsUserBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
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

  // ロール別ユーザーリストを取得
  const {
    users: roleUsers,
    isLoading: isRoleUsersLoading,
  } = useRoleUsers(selectedRole, showRoleUsersModal);

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
        setProfile(null);
      } else {
        setProfile(data || null);
      }
    } catch (err) {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [walletAddress]);

  // ブックマーク状態をチェック
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!currentUserWalletAddress || !walletAddress || !isViewingOtherProfile) {
        setIsUserBookmarked(false);
        return;
      }

      const bookmarked = await isBookmarked(currentUserWalletAddress, walletAddress);
      setIsUserBookmarked(bookmarked);
    };

    checkBookmarkStatus();
  }, [currentUserWalletAddress, walletAddress, isViewingOtherProfile]);

  // トースト通知の自動非表示
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleBack = () => {
    // ブラウザ履歴で一つ前の画面に戻る
    window.history.back();
  };

  // フォローバック用のコールバック関数
  const handleFollowUser = async (targetAddress: string) => {
    if (!currentUserWalletAddress) {
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
        throw error;
      }
    } catch (err) {
      throw err;
    }
  };

  // ブックマーク追加・削除
  const handleToggleBookmark = async () => {
    if (!currentUserWalletAddress || !walletAddress) {
      return;
    }

    setIsBookmarkLoading(true);

    try {
      if (isUserBookmarked) {
        // ブックマークから削除
        // まず現在のブックマークIDを取得する必要がある
        const { data } = await supabase
          .from('user_bookmarks')
          .select('id')
          .eq('user_address', currentUserWalletAddress.toLowerCase())
          .eq('bookmarked_address', walletAddress.toLowerCase())
          .single();

        if (data) {
          const result = await removeBookmark(data.id);
          if (result.success) {
            setIsUserBookmarked(false);
            setToastMessage('ブックマークから除外しました');
          }
        }
      } else {
        // ブックマークに追加
        const result = await addBookmark(currentUserWalletAddress, walletAddress);
        if (result.success) {
          setIsUserBookmarked(true);
          setToastMessage('このユーザーをブックマークに追加しました');
        } else if (result.error) {
          setToastMessage(result.error);
        }
      }
    } catch (err) {
      console.error('ブックマーク操作エラー:', err);
      setToastMessage('エラーが発生しました');
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  // チップ送信処理
  const handleSendTip = (amount: number) => {
    if (!walletAddress) {
      alert('送信先のアドレスが取得できません');
      return Promise.reject(new Error('送信先のアドレスが取得できません'));
    }

    // 送金ページに遷移（金額とアドレスを含む）
    const params = new URLSearchParams({
      to: walletAddress,
      amount: amount.toString(),
      isTip: 'true',
    });
    window.location.href = `/mypage?${params.toString()}`;

    // ページ遷移が完了するまでPromiseを解決しない
    return new Promise<void>(() => {});
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
          {/* 自分のプロフィールの場合のみ編集ボタンとシェアボタンを表示 */}
          {!isViewingOtherProfile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowShareLinkModal(true)}
                style={{
                  padding: isMobile ? '8px 12px' : '10px 16px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                シェア
              </button>
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
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  overflow: 'hidden',
                  background: profile?.cover_image_url
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {profile?.cover_image_url ? (
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
                ) : (
                  <img
                    src="/mas.png"
                    alt=""
                    style={{
                      maxWidth: '30%',
                      maxHeight: '30%',
                      opacity: 0.3,
                      objectFit: 'contain',
                    }}
                  />
                )}
              </div>

              {/* チップボタンとフォローボタン（カバー画像の下） */}
              {isViewingOtherProfile && currentUserWalletAddress && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: isMobile ? '8px' : '12px',
                    padding: isMobile ? '12px 16px' : '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {/* ブックマークボタン */}
                  <button
                    onClick={handleToggleBookmark}
                    disabled={isBookmarkLoading}
                    style={{
                      padding: isMobile ? '8px 16px' : '10px 20px',
                      background: isUserBookmarked
                        ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                        : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: isMobile ? 18 : 20,
                      fontWeight: 600,
                      cursor: isBookmarkLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isBookmarkLoading ? 0.6 : 1,
                      minWidth: isMobile ? 44 : 48,
                    }}
                    onMouseEnter={(e) => {
                      if (!isBookmarkLoading) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isBookmarkLoading) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                      }
                    }}
                  >
                    ⭐
                  </button>

                  {/* チップボタン（ウォレットアドレスが公開されている場合のみ表示） */}
                  {profile?.show_wallet_address !== false && (
                    <button
                      onClick={() => setShowTipModal(true)}
                      style={{
                        padding: isMobile ? '8px 16px' : '10px 20px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: isMobile ? 14 : 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                      }}
                    >
                      💰 チップを贈る
                    </button>
                  )}

                  {/* フォローボタン */}
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
                            onClick={() => {
                              setSelectedRole(role);
                              setShowRoleUsersModal(true);
                            }}
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
                              cursor: 'pointer',
                              transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.8';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
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

      {/* チップ送信モーダル */}
      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        recipientAddress={walletAddress}
        recipientName={profile?.display_name || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
        onSendTip={handleSendTip}
        isMobile={isMobile}
      />

      {/* ロール別ユーザーリストモーダル */}
      <RoleUsersModal
        isOpen={showRoleUsersModal}
        onClose={() => {
          setShowRoleUsersModal(false);
          setSelectedRole(null);
        }}
        role={selectedRole}
        roleLabel={selectedRole ? ROLE_LABELS[selectedRole] : ''}
        users={roleUsers}
        isLoading={isRoleUsersLoading}
        isMobile={isMobile}
      />

      {/* トースト通知 */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 80 : 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            padding: isMobile ? '12px 20px' : '14px 24px',
            borderRadius: 8,
            fontSize: isMobile ? 13 : 14,
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            zIndex: 10001,
            maxWidth: '90%',
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 投げ銭リンクシェアモーダル */}
      {showShareLinkModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setShowShareLinkModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: 20,
              padding: 'clamp(24px, 5vw, 32px)',
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              border: '2px solid rgba(102, 126, 234, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: 'clamp(20px, 4vw, 24px)',
                marginBottom: 16,
                textAlign: 'center',
                color: '#fff',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              TIP LINK
            </h2>

            <p
              style={{
                fontSize: 'clamp(14px, 2.5vw, 16px)',
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              あなたのチップリンクをコピーして、<br />
              Xやその他のSNSでシェアしましょう！
            </p>

            {/* リンク表示エリア */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 12,
                padding: '16px',
                marginBottom: 20,
                wordBreak: 'break-all',
                fontSize: 'clamp(12px, 2vw, 14px)',
                color: '#93c5fd',
                fontFamily: 'monospace',
              }}
            >
              {`https://gifterra-safe.vercel.app/receive/${walletAddress}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* リンクをコピーボタン */}
              <button
                onClick={() => {
                  const tipLink = `https://gifterra-safe.vercel.app/receive/${walletAddress}`;
                  navigator.clipboard.writeText(tipLink).then(() => {
                    setToastMessage('リンクをコピーしました！');
                    setShowShareLinkModal(false);
                  }).catch(() => {
                    setToastMessage('コピーに失敗しました');
                  });
                }}
                style={{
                  padding: 'clamp(12px, 2.5vw, 16px)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 'clamp(14px, 2.5vw, 16px)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                }}
              >
                📋 リンクをコピー
              </button>

              {/* Xでシェアボタン */}
              <button
                onClick={() => {
                  const displayName = profile?.display_name || 'ギフテラユーザー';
                  const twitterId = profile?.twitter_id;
                  const mentionText = twitterId ? `${displayName} @${twitterId} さんへ投げ銭` : `${displayName} さんへ投げ銭`;
                  const tipLink = `https://gifterra-safe.vercel.app/receive/${walletAddress}`;
                  const text = `${mentionText}\n${tipLink}\n\n#GIFTERRA #投げ銭 #JPYC`;
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                  setShowShareLinkModal(false);
                }}
                style={{
                  padding: 'clamp(12px, 2.5vw, 16px)',
                  background: 'linear-gradient(135deg, #1DA1F2 0%, #0d8bd9 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 'clamp(14px, 2.5vw, 16px)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(29, 161, 242, 0.4)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 161, 242, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(29, 161, 242, 0.4)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Xでシェアする
              </button>

              {/* 閉じるボタン */}
              <button
                onClick={() => setShowShareLinkModal(false)}
                style={{
                  padding: 'clamp(10px, 2vw, 12px)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  fontSize: 'clamp(13px, 2vw, 14px)',
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
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
