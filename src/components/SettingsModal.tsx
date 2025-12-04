// src/components/SettingsModal.tsx
// 設定モーダル（マイページの⚙️アイコンから開く）

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ContactFormModal } from './ContactFormModal';
import { NotificationSettings } from './NotificationSettings';
import { ProfileEditModal } from './ProfileEditModal';
import { LoginHistoryModal } from './LoginHistoryModal';
import { AccountDeletionModal } from './AccountDeletionModal';
import { usePrivy } from '@privy-io/react-auth';
import { useAddress } from '@thirdweb-dev/react';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  onClose: () => void;
  isMobile: boolean;
  onLogout?: () => void;
}

export function SettingsModal({ onClose, isMobile, onLogout }: SettingsModalProps) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { user } = usePrivy();
  const thirdwebAddress = useAddress();
  const privyAddress = user?.wallet?.address;
  const connectedAddress = privyAddress || thirdwebAddress;

  // プロフィール情報を取得
  useEffect(() => {
    const fetchProfile = async () => {
      if (!connectedAddress) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('tenant_id', 'default')
          .eq('wallet_address', connectedAddress.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error('Failed to fetch profile:', error);
          return;
        }

        setUserProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    fetchProfile();
  }, [connectedAddress]);

  return (
    <>
      {createPortal(
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
              maxWidth: isMobile ? '100%' : 400,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
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
            flexShrink: 0,
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
            設定
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

        {/* メニューリスト */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? 16 : 20,
        }}>
          {/* プロフィール編集 */}
          {connectedAddress && (
            <button
              type="button"
              onClick={() => setShowProfileEdit(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 16,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                marginBottom: 12,
                textDecoration: 'none',
                color: '#EAF2FF',
                transition: 'all 0.2s',
                cursor: 'pointer',
                textAlign: 'left',
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
              <span style={{ fontSize: 20 }}>👤</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  プロフィール編集
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  表示名や受け取り時メッセージを設定
                </div>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
                →
              </span>
            </button>
          )}

          {/* 利用規約 */}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? 14 : 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              marginBottom: 12,
              textDecoration: 'none',
              color: '#EAF2FF',
              transition: 'all 0.2s',
              cursor: 'pointer',
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
            <span style={{ fontSize: 20 }}>📜</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                利用規約
              </div>
              <div
                style={{
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                サービスの利用条件を確認
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
              →
            </span>
          </a>

          {/* プライバシーポリシー */}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? 14 : 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              marginBottom: 12,
              textDecoration: 'none',
              color: '#EAF2FF',
              transition: 'all 0.2s',
              cursor: 'pointer',
              textAlign: 'left',
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
            <span style={{ fontSize: 20 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                プライバシーポリシー
              </div>
              <div
                style={{
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                個人情報の取り扱いについて
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
              →
            </span>
          </a>

          {/* 通知設定 */}
          {connectedAddress && (
            <button
              type="button"
              onClick={() => setShowNotificationSettings(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 16,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                marginBottom: 12,
                textDecoration: 'none',
                color: '#EAF2FF',
                transition: 'all 0.2s',
                cursor: 'pointer',
                textAlign: 'left',
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
              <span style={{ fontSize: 20 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  通知設定
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  メール通知の設定を管理
                </div>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
                →
              </span>
            </button>
          )}

          {/* お問い合わせ・サポート */}
          <button
            type="button"
            onClick={() => setShowContactForm(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? 14 : 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              marginBottom: 12,
              textDecoration: 'none',
              color: '#EAF2FF',
              transition: 'all 0.2s',
              cursor: 'pointer',
              textAlign: 'left',
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
            <span style={{ fontSize: 20 }}>💬</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                お問い合わせ・サポート
              </div>
              <div
                style={{
                  fontSize: isMobile ? 11 : 12,
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                ヘルプとサポートを受ける
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
              →
            </span>
          </button>

          {/* ログイン履歴 */}
          {connectedAddress && (
            <button
              type="button"
              onClick={() => setShowLoginHistory(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 16,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                marginBottom: 12,
                textDecoration: 'none',
                color: '#EAF2FF',
                transition: 'all 0.2s',
                cursor: 'pointer',
                textAlign: 'left',
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
              <span style={{ fontSize: 20 }}>🔐</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  ログイン履歴
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  セキュリティとログイン履歴を確認
                </div>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.4)' }}>
                →
              </span>
            </button>
          )}

          {/* 退会 */}
          {connectedAddress && (
            <button
              type="button"
              onClick={() => setShowAccountDeletion(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 16,
                background: 'rgba(220, 38, 38, 0.05)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                borderRadius: 12,
                marginBottom: 12,
                textDecoration: 'none',
                color: 'rgba(252, 165, 165, 0.9)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.2)';
              }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  退会する
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    color: 'rgba(252, 165, 165, 0.7)',
                  }}
                >
                  アカウント情報を匿名化
                </div>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(252, 165, 165, 0.5)' }}>
                →
              </span>
            </button>
          )}

          {/* アプリ情報 */}
          <div
            style={{
              padding: isMobile ? 14 : 16,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
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
              <span style={{ fontSize: 20 }}>ℹ️</span>
              <div
                style={{
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                アプリ情報
              </div>
            </div>
            <div
              style={{
                fontSize: isMobile ? 11 : 12,
                color: 'rgba(255, 255, 255, 0.6)',
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: '0 0 8px 0' }}>
                <strong style={{ color: '#EAF2FF' }}>GIFTERRA</strong>
              </p>
              <p style={{ margin: '0 0 4px 0' }}>Version 1.0.0</p>
              <p style={{ margin: '0 0 4px 0' }}>
                特許出願中（Patent Pending）
              </p>
              <p style={{ margin: 0 }}>Powered by GIFTERRA</p>
              <p style={{ margin: 0 }}>Presented by METATRON.</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
        document.body
      )}

      {showContactForm && (
        <ContactFormModal
          onClose={() => setShowContactForm(false)}
          isMobile={isMobile}
          userEmail={user?.email?.address}
        />
      )}

      {showNotificationSettings && connectedAddress && createPortal(
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
          onClick={() => setShowNotificationSettings(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
              borderRadius: isMobile ? 16 : 24,
              maxWidth: isMobile ? '100%' : 500,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
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
                position: 'sticky',
                top: 0,
                background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
                zIndex: 1,
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
                通知設定
              </h2>
              <button
                onClick={() => setShowNotificationSettings(false)}
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

            {/* NotificationSettingsコンポーネント */}
            <div style={{ padding: isMobile ? 16 : 20 }}>
              <NotificationSettings
                userAddress={connectedAddress}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* プロフィール編集モーダル */}
      {showProfileEdit && connectedAddress && (
        <ProfileEditModal
          onClose={() => setShowProfileEdit(false)}
          onSave={async () => {
            setShowProfileEdit(false);
            // プロフィール情報を再取得
            try {
              const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('tenant_id', 'default')
                .eq('wallet_address', connectedAddress.toLowerCase())
                .maybeSingle();

              if (!error) {
                setUserProfile(data);
              }
            } catch (err) {
              console.error('Error refreshing profile:', err);
            }
          }}
          isMobile={isMobile}
          currentProfile={{
            display_name: userProfile?.display_name || '',
            bio: userProfile?.bio || '',
            avatar_url: userProfile?.avatar_url || '',
            receive_message: userProfile?.receive_message || 'ありがとうございました。',
          }}
          walletAddress={connectedAddress}
        />
      )}

      {/* ログイン履歴モーダル */}
      {showLoginHistory && connectedAddress && (
        <LoginHistoryModal
          isOpen={showLoginHistory}
          onClose={() => setShowLoginHistory(false)}
          walletAddress={connectedAddress}
          isMobile={isMobile}
        />
      )}

      {/* アカウント退会モーダル */}
      {showAccountDeletion && connectedAddress && (
        <AccountDeletionModal
          isOpen={showAccountDeletion}
          onClose={() => setShowAccountDeletion(false)}
          onSuccess={() => {
            setShowAccountDeletion(false);
            onClose();
            // ログアウト処理
            if (onLogout) {
              onLogout();
            }
          }}
          walletAddress={connectedAddress}
          isMobile={isMobile}
        />
      )}

    </>
  );
}
