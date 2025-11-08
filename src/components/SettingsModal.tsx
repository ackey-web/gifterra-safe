// src/components/SettingsModal.tsx
// 設定モーダル（マイページの⚙️アイコンから開く）

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ContactFormModal } from './ContactFormModal';
import { usePrivy } from '@privy-io/react-auth';

interface SettingsModalProps {
  onClose: () => void;
  isMobile: boolean;
}

export function SettingsModal({ onClose, isMobile }: SettingsModalProps) {
  const [showContactForm, setShowContactForm] = useState(false);
  const { user } = usePrivy();

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
        <div style={{ padding: isMobile ? 16 : 20 }}>
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

          {/* お問い合わせ・サポート */}
          <button
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
    </>
  );
}
