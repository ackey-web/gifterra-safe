// src/components/ProfileEditModal.tsx
// プロフィール編集モーダル

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase, uploadAvatarImage, deleteAvatarImage, uploadCoverImage, deleteCoverImage } from '../lib/supabase';
import { ROLE_LABELS } from '../types/profile';
import type { UserRole, CustomLink } from '../types/profile';

interface ProfileEditModalProps {
  onClose: () => void;
  onSave: () => void;
  isMobile: boolean;
  currentProfile: {
    display_name: string;
    bio: string;
    avatar_url?: string;
    receive_message?: string;
    cover_image_url?: string;
    website_url?: string;
    custom_links?: CustomLink[];
    roles?: UserRole[];
    location?: string;
    show_wallet_address?: boolean;
    reject_anonymous_transfers?: boolean;
    twitter_id?: string;
  };
  walletAddress: string;
}

export function ProfileEditModal({
  onClose,
  onSave,
  isMobile,
  currentProfile,
  walletAddress,
}: ProfileEditModalProps) {
  const [displayName, setDisplayName] = useState(currentProfile.display_name || '');
  const [bio, setBio] = useState(currentProfile.bio || '');
  const [receiveMessage, setReceiveMessage] = useState(currentProfile.receive_message || 'ありがとうございました。');
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState(currentProfile.avatar_url || '');

  // 新規フィールド
  const [coverImageUrl, setCoverImageUrl] = useState(currentProfile.cover_image_url || '');
  const [coverImagePreview, setCoverImagePreview] = useState(currentProfile.cover_image_url || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentProfile.website_url || '');
  const [customLinks, setCustomLinks] = useState<CustomLink[]>(currentProfile.custom_links || []);
  const [roles, setRoles] = useState<UserRole[]>(currentProfile.roles || []);
  const [location, setLocation] = useState(currentProfile.location || '');
  const [showWalletAddress, setShowWalletAddress] = useState(currentProfile.show_wallet_address !== false);
  const [rejectAnonymousTransfers, setRejectAnonymousTransfers] = useState(currentProfile.reject_anonymous_transfers === true);
  const [twitterId, setTwitterId] = useState(currentProfile.twitter_id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [error, setError] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCoverOverlay, setShowCoverOverlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsUploading(true);

    try {
      // プレビューを表示
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // アップロード
      const url = await uploadAvatarImage(file, walletAddress);
      setAvatarUrl(url);
    } catch (err: any) {
      console.error('画像アップロードエラー:', err);
      setError(err.message || '画像のアップロードに失敗しました');
      setAvatarPreview(currentProfile.avatar_url || '');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setError('');
    setIsUploading(true);

    try {
      await deleteAvatarImage(walletAddress);
      setAvatarUrl('');
      setAvatarPreview('');
    } catch (err) {
      console.error('画像削除エラー:', err);
      setError('画像の削除に失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsCoverUploading(true);

    try {
      // プレビューを表示
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // アップロード
      const url = await uploadCoverImage(file, walletAddress);
      setCoverImageUrl(url);
    } catch (err: any) {
      console.error('カバー画像アップロードエラー:', err);
      setError(err.message || 'カバー画像のアップロードに失敗しました');
      setCoverImagePreview(currentProfile.cover_image_url || '');
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleRemoveCover = async () => {
    setError('');
    setIsCoverUploading(true);

    try {
      await deleteCoverImage(walletAddress);
      setCoverImageUrl('');
      setCoverImagePreview('');
    } catch (err) {
      console.error('カバー画像削除エラー:', err);
      setError('カバー画像の削除に失敗しました');
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleAddCustomLink = () => {
    if (customLinks.length >= 3) {
      setError('カスタムリンクは最大3件までです');
      return;
    }
    setCustomLinks([...customLinks, { label: '', url: '' }]);
  };

  const handleRemoveCustomLink = (index: number) => {
    setCustomLinks(customLinks.filter((_, i) => i !== index));
  };

  const handleCustomLinkChange = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...customLinks];
    newLinks[index][field] = value;
    setCustomLinks(newLinks);
  };

  const handleRoleToggle = (role: UserRole) => {
    if (roles.includes(role)) {
      setRoles(roles.filter(r => r !== role));
    } else {
      setRoles([...roles, role]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      setError('表示名を入力してください');
      return;
    }

    if (bio.length > 140) {
      setError('自己紹介は140文字以内で入力してください');
      return;
    }

    if (receiveMessage.length > 100) {
      setError('受け取り時メッセージは100文字以内で入力してください');
      return;
    }

    if (location.length > 20) {
      setError('所在地は20文字以内で入力してください');
      return;
    }

    // Twitter ID validation (@を除去)
    const cleanTwitterId = twitterId.trim().replace(/^@/, '');
    if (cleanTwitterId && !/^[A-Za-z0-9_]{1,15}$/.test(cleanTwitterId)) {
      setError('X IDは英数字とアンダースコアのみ、15文字以内で入力してください');
      return;
    }

    // Website URL validation
    if (websiteUrl && !websiteUrl.match(/^https?:\/\/.+/)) {
      setError('WebサイトURLは https:// または http:// で始まる必要があります');
      return;
    }

    // Custom links validation
    for (const link of customLinks) {
      if (link.label && !link.url) {
        setError('カスタムリンクのURLを入力してください');
        return;
      }
      if (link.url && !link.url.match(/^https?:\/\/.+/)) {
        setError('カスタムリンクのURLは https:// または http:// で始まる必要があります');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Filter out empty custom links
      const validCustomLinks = customLinks.filter(link => link.label && link.url);

      // Twitter IDから@を除去
      const cleanTwitterId = twitterId.trim().replace(/^@/, '');

      // upsert: 存在すれば更新、存在しなければ作成
      // Supabaseの.upsert()を使用（onConflictでユニーク制約を指定）
      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          tenant_id: 'default',
          wallet_address: walletAddress.toLowerCase(),
          display_name: displayName.trim(),
          bio: bio.trim(),
          receive_message: receiveMessage.trim(),
          avatar_url: avatarUrl || null,
          cover_image_url: coverImageUrl || null,
          website_url: websiteUrl.trim() || null,
          custom_links: validCustomLinks.length > 0 ? validCustomLinks : [],
          roles: roles.length > 0 ? roles : [],
          location: location.trim() || null,
          show_wallet_address: showWalletAddress,
          reject_anonymous_transfers: rejectAnonymousTransfers,
          twitter_id: cleanTwitterId || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'wallet_address', // wallet_addressのユニーク制約に基づいてupsert
        });

      if (upsertError) {
        console.error('❌ ProfileEditModal - Upsert error:', upsertError);
        throw upsertError;
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('プロフィール保存エラー:', err);
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1000000,
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
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
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
            プロフィール編集
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

        {/* コンテンツ */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          <form onSubmit={handleSubmit}>
            {/* プロフィール画像 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 12,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                プロフィール画像
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* クリック可能なプレビュー */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onMouseEnter={() => setShowOverlay(true)}
                  onMouseLeave={() => setShowOverlay(false)}
                  style={{
                    width: isMobile ? 120 : 100,
                    height: isMobile ? 120 : 100,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: avatarPreview
                      ? 'transparent'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? 50 : 40,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    border: `3px solid ${showOverlay && !isUploading ? 'rgba(102, 126, 234, 0.6)' : 'rgba(255, 255, 255, 0.2)'}`,
                    transform: showOverlay && !isUploading ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="プロフィール画像"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    '👤'
                  )}
                  {/* ホバー時のオーバーレイ */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: showOverlay && !isUploading ? 1 : 0,
                      transition: 'opacity 0.2s',
                      fontSize: isMobile ? 14 : 12,
                      color: '#fff',
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    {isUploading ? 'アップロード中...' : '画像を変更'}
                  </div>
                </div>

                {/* 削除ボタン（画像がある場合のみ） */}
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                    style={{
                      padding: isMobile ? '10px 16px' : '8px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 8,
                      color: '#fca5a5',
                      fontSize: isMobile ? 14 : 13,
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isUploading ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isUploading) {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                  >
                    画像を削除
                  </button>
                )}

                {/* ヘルプテキスト */}
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 12 : 11,
                    color: 'rgba(255, 255, 255, 0.6)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  画像をクリックして変更<br />
                  JPG、PNG、GIF、WebP（最大5MB）
                </p>
              </div>
            </div>

            {/* カバー画像 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 12,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                カバー画像（任意）
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* クリック可能なプレビュー */}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleCoverSelect}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => !isCoverUploading && coverInputRef.current?.click()}
                  onMouseEnter={() => setShowCoverOverlay(true)}
                  onMouseLeave={() => setShowCoverOverlay(false)}
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: coverImagePreview
                      ? 'transparent'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isMobile ? 40 : 50,
                    cursor: isCoverUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    border: `2px solid ${showCoverOverlay && !isCoverUploading ? 'rgba(102, 126, 234, 0.6)' : 'rgba(255, 255, 255, 0.2)'}`,
                    transform: showCoverOverlay && !isCoverUploading ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  {coverImagePreview ? (
                    <img
                      src={coverImagePreview}
                      alt="カバー画像"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    '🖼️'
                  )}
                  {/* ホバー時のオーバーレイ */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: showCoverOverlay && !isCoverUploading ? 1 : 0,
                      transition: 'opacity 0.2s',
                      fontSize: isMobile ? 14 : 13,
                      color: '#fff',
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    {isCoverUploading ? 'アップロード中...' : 'カバー画像を変更'}
                  </div>
                </div>

                {/* 削除ボタン（画像がある場合のみ） */}
                {coverImagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    disabled={isCoverUploading}
                    style={{
                      padding: isMobile ? '10px 16px' : '8px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 8,
                      color: '#fca5a5',
                      fontSize: isMobile ? 14 : 13,
                      fontWeight: 600,
                      cursor: isCoverUploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isCoverUploading ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isCoverUploading) {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                  >
                    カバー画像を削除
                  </button>
                )}

                {/* ヘルプテキスト */}
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 12 : 11,
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: 1.5,
                  }}
                >
                  16:9の比率推奨（最大10MB）<br />
                  JPG、PNG、GIF、WebP形式
                </p>
              </div>
            </div>

            {/* 表示名 */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                表示名 <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="山田 太郎"
                maxLength={50}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            {/* 自己紹介 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                自己紹介（140文字以内）
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="こんにちは！GIFTERRAでクリエイター活動をしています。"
                rows={4}
                maxLength={140}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
              <div
                style={{
                  marginTop: 4,
                  fontSize: isMobile ? 11 : 12,
                  color: bio.length > 140 ? '#f87171' : 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'right',
                }}
              >
                {bio.length}/140
              </div>
            </div>

            {/* 受け取り時メッセージ */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                受け取り時メッセージ（100文字以内）
              </label>
              <textarea
                value={receiveMessage}
                onChange={(e) => setReceiveMessage(e.target.value)}
                placeholder="送金してくれた方に表示されるメッセージ（例: ありがとうございました。）"
                rows={3}
                maxLength={100}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
              <div
                style={{
                  marginTop: 4,
                  fontSize: isMobile ? 11 : 12,
                  color: receiveMessage.length > 100 ? '#f87171' : 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'right',
                }}
              >
                {receiveMessage.length}/100
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: isMobile ? '8px 10px' : '10px 12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 6,
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(255, 255, 255, 0.7)',
                  lineHeight: 1.5,
                }}
              >
                💡 送金完了時に送信者へ表示されるメッセージです。お礼の言葉やメッセージを設定できます。
              </div>
            </div>

            {/* ロール選択 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 12,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                ロール（複数選択可）
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',
                  gap: 8,
                }}
              >
                {(Object.keys(ROLE_LABELS) as UserRole[])
                  .filter((role) => {
                    // 開発者ロールは特定のウォレットアドレスのみ表示
                    if (role === 'DEVELOPER') {
                      return walletAddress.toLowerCase() === '0x66F1274aD5d042b7571C2EfA943370dbcd3459aB'.toLowerCase();
                    }
                    return true;
                  })
                  .map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleToggle(role)}
                      style={{
                        padding: isMobile ? '10px 12px' : '8px 12px',
                        background: roles.includes(role)
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${roles.includes(role) ? 'rgba(102, 126, 234, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: 8,
                        color: '#EAF2FF',
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                      onMouseEnter={(e) => {
                        if (!roles.includes(role)) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!roles.includes(role)) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
              </div>
            </div>

            {/* WebサイトURL */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                WebサイトURL（任意）
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            {/* カスタムリンク */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 12,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                カスタムリンク（最大3件）
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {customLinks.map((link, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => handleCustomLinkChange(index, 'label', e.target.value)}
                        placeholder="ラベル（例: X, Instagram）"
                        maxLength={20}
                        style={{
                          width: '100%',
                          padding: isMobile ? '8px 10px' : '10px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: '#EAF2FF',
                          fontSize: isMobile ? 13 : 14,
                          outline: 'none',
                          transition: 'all 0.2s',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => handleCustomLinkChange(index, 'url', e.target.value)}
                        placeholder="https://..."
                        style={{
                          width: '100%',
                          padding: isMobile ? '8px 10px' : '10px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: '#EAF2FF',
                          fontSize: isMobile ? 13 : 14,
                          outline: 'none',
                          transition: 'all 0.2s',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomLink(index)}
                      style={{
                        width: 36,
                        height: 36,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 8,
                        color: '#fca5a5',
                        fontSize: 18,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {customLinks.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddCustomLink}
                    style={{
                      padding: isMobile ? '10px 16px' : '12px 16px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: 8,
                      color: '#93c5fd',
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    }}
                  >
                    + リンクを追加
                  </button>
                )}
              </div>
            </div>

            {/* 所在地 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                所在地（20文字以内）
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="東京都渋谷区"
                maxLength={20}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
              <div
                style={{
                  marginTop: 4,
                  fontSize: isMobile ? 11 : 12,
                  color: location.length > 20 ? '#f87171' : 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'right',
                }}
              >
                {location.length}/20
              </div>
            </div>

            {/* X (Twitter) ID */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                X (Twitter) ID（任意）
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: isMobile ? 12 : 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: isMobile ? 14 : 15,
                    pointerEvents: 'none',
                  }}
                >
                  @
                </span>
                <input
                  type="text"
                  value={twitterId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^@/, '');
                    setTwitterId(value);
                  }}
                  placeholder="gifterra_app"
                  maxLength={15}
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px 10px 28px' : '12px 16px 12px 32px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                投げ銭をXでシェアした際に通知されます
              </div>
            </div>

            {/* ウォレットアドレス公開/非公開 */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  padding: isMobile ? '12px' : '14px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <input
                  type="checkbox"
                  checked={showWalletAddress}
                  onChange={(e) => setShowWalletAddress(e.target.checked)}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                    accentColor: '#3b82f6',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 600,
                      color: '#EAF2FF',
                      marginBottom: 4,
                    }}
                  >
                    ウォレットアドレスを公開
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'rgba(255, 255, 255, 0.6)',
                      lineHeight: 1.4,
                    }}
                  >
                    {showWalletAddress
                      ? 'プロフィールページでウォレットアドレスが表示されます'
                      : 'ウォレットアドレスは非表示になります'}
                  </div>
                </div>
              </label>
              {!showWalletAddress && (
                <div
                  style={{
                    marginTop: 8,
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 6,
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(234, 179, 8, 0.9)',
                    lineHeight: 1.5,
                  }}
                >
                  ⚠️ 非公開にすると、プロフィールからのチップの受け取りができなくなります
                </div>
              )}
            </div>

            {/* 匿名送金拒否設定 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  padding: isMobile ? '12px' : '14px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <input
                  type="checkbox"
                  checked={rejectAnonymousTransfers}
                  onChange={(e) => setRejectAnonymousTransfers(e.target.checked)}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                    accentColor: '#ef4444',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 600,
                      color: '#EAF2FF',
                      marginBottom: 4,
                    }}
                  >
                    匿名送金を拒否する
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'rgba(255, 255, 255, 0.6)',
                      lineHeight: 1.4,
                    }}
                  >
                    {rejectAnonymousTransfers
                      ? '他のユーザーはあなたに匿名で送金できません'
                      : '匿名送金を許可しています'}
                  </div>
                </div>
              </label>
              {rejectAnonymousTransfers && (
                <div
                  style={{
                    marginTop: 8,
                    padding: isMobile ? '8px 10px' : '10px 12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 6,
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(147, 197, 253, 0.9)',
                    lineHeight: 1.5,
                  }}
                >
                  💡 送信者があなたに匿名で送金しようとすると、警告が表示され送金がブロックされます
                </div>
              )}
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  fontSize: isMobile ? 13 : 14,
                }}
              >
                {error}
              </div>
            )}

            {/* ボタン */}
            <div
              style={{
                display: 'flex',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  background:
                    isSubmitting || isUploading
                      ? 'rgba(100, 100, 100, 0.3)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isSubmitting || isUploading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && !isUploading) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSubmitting ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
