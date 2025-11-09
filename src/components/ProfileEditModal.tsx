// src/components/ProfileEditModal.tsx
// プロフィール編集モーダル

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase, uploadAvatarImage, deleteAvatarImage } from '../lib/supabase';

interface ProfileEditModalProps {
  onClose: () => void;
  onSave: () => void;
  isMobile: boolean;
  currentProfile: {
    display_name: string;
    bio: string;
    avatar_url?: string;
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
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState(currentProfile.avatar_url || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setIsSubmitting(true);
    setError('');

    try {
      console.log('💾 ProfileEditModal - Saving profile:', {
        wallet_address: walletAddress.toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
      });

      // upsert: 存在すれば更新、存在しなければ作成
      // まず既存のプロフィールを確認
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', 'default')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      console.log('📋 Existing profile:', existingProfile);

      let upsertError;
      if (existingProfile) {
        // 既存プロフィールを更新
        const { error } = await supabase
          .from('user_profiles')
          .update({
            display_name: displayName.trim(),
            bio: bio.trim(),
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', 'default')
          .eq('wallet_address', walletAddress.toLowerCase());
        upsertError = error;
      } else {
        // 新規プロフィールを作成
        const { error } = await supabase
          .from('user_profiles')
          .insert({
            tenant_id: 'default',
            wallet_address: walletAddress.toLowerCase(),
            display_name: displayName.trim(),
            bio: bio.trim(),
            avatar_url: avatarUrl || null,
          });
        upsertError = error;
      }

      if (upsertError) {
        console.error('❌ ProfileEditModal - Upsert error:', upsertError);
        throw upsertError;
      }

      console.log('✅ ProfileEditModal - Profile saved successfully');

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
