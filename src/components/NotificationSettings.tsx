// src/components/NotificationSettings.tsx
// ユーザーの通知設定を管理するコンポーネント

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NotificationSettingsProps {
  userAddress: string;
  isMobile?: boolean;
}

interface NotificationTypes {
  jpyc_received: boolean;
  rank_up: boolean;
  gift_received: boolean;
  followed: boolean;
}

interface UserNotificationSettings {
  user_address: string;
  email_notifications_enabled: boolean;
  email_address: string | null;
  notification_types: NotificationTypes;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  userAddress,
  isMobile = false,
}) => {
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 設定を読み込み
  useEffect(() => {
    loadSettings();
  }, [userAddress]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_address', userAddress.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = レコードが見つからない
        throw error;
      }

      if (data) {
        setSettings(data);
        setEmailInput(data.email_address || '');
      } else {
        // 初期設定
        setSettings({
          user_address: userAddress.toLowerCase(),
          email_notifications_enabled: false,
          email_address: null,
          notification_types: {
            jpyc_received: true,
            rank_up: true,
            gift_received: true,
            followed: true,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      showMessage('error', '設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!settings) return;

    // メール通知が有効な場合はメールアドレス必須
    if (settings.email_notifications_enabled && !emailInput.trim()) {
      showMessage('error', 'メールアドレスを入力してください');
      return;
    }

    // メールアドレスの簡易バリデーション
    if (emailInput.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      showMessage('error', '有効なメールアドレスを入力してください');
      return;
    }

    try {
      setSaving(true);

      const updatedSettings = {
        ...settings,
        email_address: emailInput.trim() || null,
      };

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(updatedSettings);

      if (error) throw error;

      setSettings(updatedSettings);
      showMessage('success', '設定を保存しました');
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      showMessage('error', '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmailNotifications = (enabled: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, email_notifications_enabled: enabled });
  };

  const toggleNotificationType = (type: keyof NotificationTypes) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notification_types: {
        ...settings.notification_types,
        [type]: !settings.notification_types[type],
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
        読み込み中...
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: isMobile ? 12 : 16,
        padding: isMobile ? '20px 16px' : '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >

      {/* メッセージ表示 */}
      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 8,
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      {/* メール通知 ON/OFF */}
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: '#EAF2FF', marginBottom: 4 }}>
              メール通知
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
              通知をメールで受け取る
            </div>
          </div>
          <button
            onClick={() => toggleEmailNotifications(!settings.email_notifications_enabled)}
            style={{
              position: 'relative',
              width: 50,
              height: 28,
              borderRadius: 14,
              border: 'none',
              background: settings.email_notifications_enabled
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#cbd5e0',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: settings.email_notifications_enabled ? 24 : 2,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#ffffff',
                transition: 'left 0.3s',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            />
          </button>
        </div>

        {/* メールアドレス入力 */}
        {settings.email_notifications_enabled && (
          <div style={{ marginTop: 16 }}>
            <label
              htmlFor="email-input"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#EAF2FF',
                marginBottom: 8,
              }}
            >
              メールアドレス
            </label>
            <input
              id="email-input"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@email.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 15,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 8,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#EAF2FF',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            />
          </div>
        )}
      </div>

      {/* 通知タイプ別設定（メール通知の有効無効に関わらず表示） */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#EAF2FF',
            marginBottom: 8,
          }}
        >
          通知内容の設定
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 16 }}>
          受け取る通知の種類を選択できます
        </div>

        {/* JPYC受信 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={settings.notification_types.jpyc_received}
            onChange={() => toggleNotificationType('jpyc_received')}
            style={{
              width: 18,
              height: 18,
              marginRight: 10,
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontSize: 14, color: '#EAF2FF' }}>💴 JPYC受信</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              JPYCを受け取ったときに通知
            </div>
          </div>
        </label>

        {/* フォローされた */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={settings.notification_types.followed}
            onChange={() => toggleNotificationType('followed')}
            style={{
              width: 18,
              height: 18,
              marginRight: 10,
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontSize: 14, color: '#EAF2FF' }}>👥 フォローされた</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              他のユーザーにフォローされたときに通知
            </div>
          </div>
        </label>

        {/* ランクアップ */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={settings.notification_types.rank_up}
            onChange={() => toggleNotificationType('rank_up')}
            style={{
              width: 18,
              height: 18,
              marginRight: 10,
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontSize: 14, color: '#EAF2FF' }}>🎖️ ランクアップ</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              ランクが上がったときに通知
            </div>
          </div>
        </label>

        {/* ギフト受信 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={settings.notification_types.gift_received}
            onChange={() => toggleNotificationType('gift_received')}
            style={{
              width: 18,
              height: 18,
              marginRight: 10,
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontSize: 14, color: '#EAF2FF' }}>🎁 ギフト受信</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              ギフトを受け取ったときに通知
            </div>
          </div>
        </label>
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '12px 24px',
          fontSize: 16,
          fontWeight: 600,
          color: '#ffffff',
          background: saving
            ? '#cbd5e0'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 8,
          cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: saving ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => {
          if (!saving) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!saving) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }
        }}
      >
        {saving ? '保存中...' : '設定を保存'}
      </button>
    </div>
  );
};
