// src/admin/TenantProfilePage.tsx
import { useState, useEffect } from 'react';
import { uploadImage, deleteFileFromUrl } from '../lib/supabase';

interface TenantProfile {
  tenantId: string;
  tenantName: string;
  description: string;
  thumbnail: string; // Supabase URL
}

export default function TenantProfilePage() {
  const [profile, setProfile] = useState<TenantProfile>({
    tenantId: '',
    tenantName: '',
    description: '',
    thumbnail: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ローカルストレージから読み込み
  useEffect(() => {
    const saved = localStorage.getItem('tenant_profile');
    if (saved) {
      const data = JSON.parse(saved);
      setProfile(data);
      if (data.thumbnail) {
        setImagePreview(data.thumbnail);
      }
    } else {
      // 初回はテナントIDを生成
      const newTenantId = `TN${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
      setProfile(prev => ({ ...prev, tenantId: newTenantId }));
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // サイズチェック (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: '画像サイズは2MB以下にしてください' });
      return;
    }

    // ファイル形式チェック
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setMessage({ type: 'error', text: 'JPG、PNG、WebP形式の画像を選択してください' });
      return;
    }

    // プレビュー表示用にFileオブジェクトからURLを作成
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setSelectedFile(file);
    setMessage(null);
  };

  const handleSave = async () => {
    // バリデーション
    if (!profile.tenantName.trim()) {
      setMessage({ type: 'error', text: 'テナント名を入力してください' });
      return;
    }

    if (profile.tenantName.length > 50) {
      setMessage({ type: 'error', text: 'テナント名は50文字以内にしてください' });
      return;
    }

    if (profile.description.length > 500) {
      setMessage({ type: 'error', text: '説明は500文字以内にしてください' });
      return;
    }

    setIsSaving(true);
    setIsUploading(true);
    setMessage(null);

    try {
      let thumbnailUrl = profile.thumbnail;

      // 新しい画像が選択されている場合、Supabaseにアップロード
      if (selectedFile) {
        setMessage({ type: 'success', text: '画像をアップロード中...' });

        // 古い画像がある場合は削除
        if (profile.thumbnail) {
          await deleteFileFromUrl(profile.thumbnail);
        }

        // 新しい画像をアップロード
        const uploadedUrl = await uploadImage(selectedFile, 'PUBLIC');
        if (uploadedUrl) {
          thumbnailUrl = uploadedUrl;
        } else {
          throw new Error('画像のアップロードに失敗しました');
        }

        setSelectedFile(null);
      }

      // プロフィールデータを更新
      const updatedProfile = {
        ...profile,
        thumbnail: thumbnailUrl,
      };

      // localStorageに保存（URLのみ）
      localStorage.setItem('tenant_profile', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);

      // プレビューを更新
      if (thumbnailUrl) {
        setImagePreview(thumbnailUrl);
      }

      setMessage({ type: 'success', text: 'テナントプロフィールを保存しました' });
    } catch (error) {
      console.error('保存エラー:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存に失敗しました'
      });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const copyTenantId = () => {
    navigator.clipboard.writeText(profile.tenantId);
    setMessage({ type: 'success', text: 'テナントIDをコピーしました' });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: 24,
    }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>
          🏢 テナントプロフィール設定
        </h1>
        <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#6b7280' }}>
          ユーザーのマイページに表示されるテナント情報を設定します
        </p>
      </div>

      {/* メッセージ */}
      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 24,
          borderRadius: 8,
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: 14,
          fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* フォーム */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 32,
      }}>
        {/* テナントID */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: '#374151',
            marginBottom: 8,
          }}>
            テナントID
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={profile.tenantId}
              readOnly
              style={{
                flex: 1,
                padding: '10px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                color: '#6b7280',
                cursor: 'not-allowed',
              }}
            />
            <button
              onClick={copyTenantId}
              style={{
                padding: '10px 16px',
                background: '#667eea',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📋 コピー
            </button>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#9ca3af' }}>
            このIDをユーザーと共有することで、マイページのテナント一覧に追加できます
          </p>
        </div>

        {/* テナント名 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: '#374151',
            marginBottom: 8,
          }}>
            テナント名 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={profile.tenantName}
            onChange={(e) => setProfile({ ...profile, tenantName: e.target.value })}
            placeholder="例：カフェ GIFTERRA"
            maxLength={50}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#ffffff',
              border: '2px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              color: '#1a1a1a',
            }}
          />
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#9ca3af' }}>
            {profile.tenantName.length}/50文字
          </p>
        </div>

        {/* 説明 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: '#374151',
            marginBottom: 8,
          }}>
            説明
          </label>
          <textarea
            value={profile.description}
            onChange={(e) => setProfile({ ...profile, description: e.target.value })}
            placeholder="テナントの紹介文を入力してください"
            maxLength={500}
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#ffffff',
              border: '2px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              color: '#1a1a1a',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#9ca3af' }}>
            {profile.description.length}/500文字
          </p>
        </div>

        {/* サムネイル画像 */}
        <div style={{ marginBottom: 32 }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: '#374151',
            marginBottom: 8,
          }}>
            サムネイル画像
          </label>

          {imagePreview && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={imagePreview}
                alt="プレビュー"
                style={{
                  width: 200,
                  height: 200,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '2px solid #e5e7eb',
                }}
              />
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            disabled={isUploading}
            style={{
              display: 'block',
              marginBottom: 8,
            }}
          />
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#9ca3af' }}>
            推奨: 400x400px、2MB以下、JPG/PNG/WebP
            {selectedFile && (
              <span style={{ color: '#10b981', fontWeight: 600, marginLeft: 8 }}>
                ✓ 選択済み: {selectedFile.name}
              </span>
            )}
          </p>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={isSaving || isUploading}
          style={{
            width: '100%',
            padding: '14px',
            background: isSaving || isUploading ? '#9ca3af' : '#10b981',
            border: 'none',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            cursor: isSaving || isUploading ? 'not-allowed' : 'pointer',
          }}
        >
          {isUploading ? '📤 アップロード中...' : isSaving ? '💾 保存中...' : '💾 保存する'}
        </button>
      </div>
    </div>
  );
}
