// src/components/WalletQRPaymentModal.tsx
// ウォレットQR決済用の金額入力モーダル

import { useState } from 'react';
import type { WalletQRData } from '../types/qrPayment';

interface WalletQRPaymentModalProps {
  walletData: WalletQRData;
  onConfirm: (amount: string, message: string) => void;
  onCancel: () => void;
  debugLogs?: string[];
}

export function WalletQRPaymentModal({
  walletData,
  onConfirm,
  onCancel,
  debugLogs = [],
}: WalletQRPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(true);

  const handleAmountClick = (digit: string) => {
    if (digit === 'C') {
      setAmount('');
    } else if (digit === '00') {
      setAmount(prev => prev + '00');
    } else {
      setAmount(prev => prev + digit);
    }
  };

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('金額を入力してください');
      return;
    }
    onConfirm(amount, message);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h2
            style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#fff',
            }}
          >
            💳 お支払い金額を入力
          </h2>

          {/* デバッグパネル */}
          {debugLogs.length > 0 && (
            <>
              {showDebugPanel ? (
                <div style={{
                  background: '#1a1a1a',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  maxHeight: 150,
                  overflow: 'auto',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#00ff00',
                  textAlign: 'left',
                  position: 'relative',
                }}>
                  <button
                    onClick={() => setShowDebugPanel(false)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: '#333',
                      border: 'none',
                      color: '#fff',
                      fontSize: 9,
                      padding: '3px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    非表示
                  </button>
                  <div style={{ marginTop: 20 }}>
                    {debugLogs.map((log, index) => (
                      <div key={index} style={{ marginBottom: 3, lineHeight: 1.3 }}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDebugPanel(true)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: '#1a1a1a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#00ff00',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  🔍 デバッグログ ({debugLogs.length}件)
                </button>
              )}
            </>
          )}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.6',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
              {walletData.name || '店舗'}
            </div>
            {walletData.description && (
              <div style={{ fontSize: '13px', opacity: 0.8 }}>{walletData.description}</div>
            )}
          </div>
        </div>

        {/* 金額表示 */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            textAlign: 'center',
            border: '2px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
            お支払い金額
          </div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#3b82f6',
              minHeight: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {amount || '0'} <span style={{ fontSize: '28px', marginLeft: '8px' }}>JPYC</span>
          </div>
        </div>

        {/* テンキー */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'C'].map((key) => (
            <button
              key={key}
              onClick={() => handleAmountClick(key)}
              style={{
                padding: '20px',
                fontSize: '24px',
                fontWeight: 'bold',
                background: key === 'C' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                color: key === 'C' ? '#ef4444' : '#fff',
                border: key === 'C' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
                e.currentTarget.style.background = key === 'C' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = key === 'C' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* メッセージ入力（オプション） */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            メッセージ（任意）
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="ありがとうございます"
            maxLength={100}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: '#fff',
              outline: 'none',
            }}
          />
        </div>

        {/* アクションボタン */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
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
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount) <= 0}
            style={{
              flex: 2,
              padding: '16px',
              fontSize: '18px',
              fontWeight: 'bold',
              background:
                amount && parseFloat(amount) > 0
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : 'rgba(148, 163, 184, 0.3)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: amount && parseFloat(amount) > 0 ? 'pointer' : 'not-allowed',
              boxShadow:
                amount && parseFloat(amount) > 0 ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'none',
              transition: 'all 0.2s',
              opacity: amount && parseFloat(amount) > 0 ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (amount && parseFloat(amount) > 0) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (amount && parseFloat(amount) > 0) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            お支払い確定
          </button>
        </div>

        {/* プライバシー保護メッセージ */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: '1.5',
          }}
        >
          🔒 <strong>プライバシー保護</strong>
          <br />
          この決済では、トランザクション情報のみが記録されます。
          <br />
          あなたのGIFTERRAユーザー情報は店舗に共有されません。
        </div>
      </div>
    </div>
  );
}
