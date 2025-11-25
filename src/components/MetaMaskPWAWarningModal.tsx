// src/components/MetaMaskPWAWarningModal.tsx
// PWA環境でのMetaMask互換性警告モーダル

import { createPortal } from 'react-dom';

interface MetaMaskPWAWarningModalProps {
  isMobile: boolean;
  onClose: () => void;
}

export function MetaMaskPWAWarningModal({
  isMobile,
  onClose,
}: MetaMaskPWAWarningModalProps) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: isMobile ? 16 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: isMobile ? 16 : 20,
          padding: isMobile ? 24 : 32,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '2px solid rgba(245, 87, 108, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: '2px solid rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 48 : 56,
              marginBottom: 12,
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: '#fca5a5',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            PWA版 MetaMask互換性に関する<br />重要なお知らせ
          </h2>
        </div>

        {/* 本文 */}
        <div
          style={{
            color: '#EAF2FF',
            fontSize: isMobile ? 13 : 14,
            lineHeight: 1.8,
            marginBottom: 24,
          }}
        >
          {/* PWA版について */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 14 : 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                color: '#93c5fd',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>📱</span>
              PWA版について
            </div>
            <p style={{ margin: 0, color: '#bfdbfe', fontSize: isMobile ? 11 : 12, lineHeight: 1.7 }}>
              現在提供中の GIFTERRA PWA版（ホーム画面に追加する簡易アプリ）は、
              正式なネイティブアプリ公開前の
              <strong style={{ color: '#fff' }}> 検証用バージョン </strong>
              です。
            </p>
          </div>

          {/* MetaMask互換性問題 */}
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 14 : 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                color: '#fca5a5',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>🚨</span>
              MetaMask互換性について
            </div>
            <p style={{ margin: '0 0 10px 0', color: '#fecaca', fontSize: isMobile ? 11 : 12, lineHeight: 1.7 }}>
              MetaMask の最新アップデート（v7.59.0）の影響で、
              スマホのPWA環境では MetaMask が正常に動作しない不具合を確認しています。
            </p>
            <p style={{ margin: 0, color: '#fecaca', fontSize: isMobile ? 11 : 12, lineHeight: 1.7 }}>
              Safari / Chrome などの
              <strong style={{ color: '#fff' }}> ブラウザからの利用であれば問題ありません。</strong>
            </p>
          </div>

          {/* 推奨ログイン方法 */}
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '2px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 14 : 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                color: '#86efac',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>✅</span>
              推奨ログイン方法
            </div>
            <p
              style={{
                margin: 0,
                color: '#bbf7d0',
                fontSize: isMobile ? 11 : 12,
                lineHeight: 1.7,
              }}
            >
              また、Google / X / Discord 認証で自動生成される
              <strong style={{ color: '#fff' }}> Privy Embedded Wallet </strong>
              は PWA・ブラウザともに正常動作しますので、
              今すぐ安定して使いたい方はこちらをご利用ください。
            </p>
          </div>

          {/* 今後の展望 */}
          <div
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '2px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 12,
              padding: isMobile ? 14 : 16,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                color: '#c4b5fd',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>🚀</span>
              今後の予定
            </div>
            <p style={{ margin: '0 0 10px 0', color: '#ddd6fe', fontSize: isMobile ? 11 : 12, lineHeight: 1.7 }}>
              GIFTERRA の正式な
              <strong style={{ color: '#fff' }}> ネイティブアプリ版は検証完了後にリリース予定</strong>
              です。
              それに伴い、PWA特有の制限や互換性の問題も解消される見込みです。
            </p>
            <p style={{ margin: 0, color: '#ddd6fe', fontSize: isMobile ? 11 : 12, lineHeight: 1.7 }}>
              ご不便をおかけしますが、引き続き改善していきます。
            </p>
          </div>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: isMobile ? '14px 20px' : '16px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          了解しました
        </button>

        {/* フッター補足 */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            fontSize: isMobile ? 11 : 12,
            color: '#94a3b8',
            lineHeight: 1.6,
          }}
        >
          ご不明な点がございましたら、<br />
          サポートチャットまでお問い合わせください。
        </div>
      </div>
    </div>,
    document.body
  );
}
