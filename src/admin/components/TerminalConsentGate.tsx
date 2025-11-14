// src/admin/components/TerminalConsentGate.tsx
// Terminal UI利用前の同意確認ゲート

import { useState } from 'react';

interface TerminalConsentGateProps {
  children: React.ReactNode;
}

export function TerminalConsentGate({ children }: TerminalConsentGateProps) {
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleAgree = () => {
    setHasAgreed(true);
  };

  const handleGoBack = () => {
    window.location.href = '/';
  };

  if (hasAgreed) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '650px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/gifterra-logo.png"
            alt="GIFTERRA"
            style={{
              height: '48px',
              width: 'auto',
              marginBottom: '16px',
            }}
          />
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1e3a8a',
              margin: '0 0 8px 0',
            }}
          >
            GIFTERRA FLOW TERMINAL
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0,
            }}
          >
            ご利用前の確認事項
          </p>
        </div>

        {/* 重要な注意事項 */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '28px' }}>⚠️</span>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#92400e',
                margin: 0,
              }}
            >
              重要なお知らせ
            </h2>
          </div>
          <p
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#92400e',
              margin: '0 0 8px 0',
              lineHeight: '1.6',
            }}
          >
            GIFTERRA TERMINAL は「決済サービス」ではありません。
          </p>
        </div>

        {/* 機能説明 */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <p
            style={{
              fontSize: '15px',
              color: '#334155',
              margin: '0 0 16px 0',
              lineHeight: '1.8',
            }}
          >
            本機能は、JPYCトークンを用いた
            <strong style={{ color: '#1e3a8a' }}>
              外部ウォレット間の送受信を行うためのUI（インターフェース）
            </strong>
            です。
          </p>

          <ul
            style={{
              fontSize: '14px',
              color: '#475569',
              lineHeight: '1.8',
              margin: 0,
              paddingLeft: '20px',
            }}
          >
            <li style={{ marginBottom: '12px' }}>
              本機能で生成される金額コードは、
              <strong>「JPYC送受信のリクエスト情報」</strong>を表示するものです。
            </li>
            <li style={{ marginBottom: '12px' }}>
              トランザクションの実行は、ユーザー本人のウォレット操作によって行われ、
              <strong>GIFTERRAは送受信の当事者ではありません。</strong>
            </li>
            <li style={{ marginBottom: '12px' }}>
              <strong>対価の支払い・代金決済・売買契約の成立を保証または証明するものではありません。</strong>
            </li>
            <li style={{ marginBottom: '12px' }}>
              JPYC送受信の実行は、ブロックチェーン上で記録され、
              <strong>取消はできません。</strong>
            </li>
          </ul>
        </div>

        {/* 利用目的 */}
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: '#0c4a6e',
              margin: 0,
              lineHeight: '1.8',
            }}
          >
            本機能は、応援・贈り物・デジタルコンテンツ配布との連携（STUDIO機能）を前提とした
            <strong>「ギフティング補助UI」</strong>です。
            <br />
            決済インフラとしての利用を目的としていません。
          </p>
        </div>

        {/* 最終確認 */}
        <div
          style={{
            borderTop: '2px solid #e2e8f0',
            paddingTop: '24px',
            marginBottom: '24px',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1e293b',
              textAlign: 'center',
              margin: '0 0 24px 0',
            }}
          >
            上記を理解した上で、TERMINAL UI を利用しますか？
          </p>

          {/* ボタン */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexDirection: window.innerWidth < 480 ? 'column' : 'row',
            }}
          >
            <button
              onClick={handleGoBack}
              style={{
                flex: 1,
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '600',
                background: '#f1f5f9',
                color: '#475569',
                border: '2px solid #cbd5e1',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              戻る
            </button>
            <button
              onClick={handleAgree}
              style={{
                flex: 2,
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
              }}
            >
              同意して利用する
            </button>
          </div>
        </div>

        {/* フッター注記 */}
        <p
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            textAlign: 'center',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          ※ この確認は、Terminal UI利用時に毎回表示されます。
        </p>
      </div>
    </div>
  );
}
