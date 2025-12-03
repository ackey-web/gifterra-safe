// src/components/GaslessPaymentConfirmModal.tsx
// ガスレス決済確認モーダル - PIN入力後に支払い内容を確認するモーダル

import type { GaslessPaymentRequest } from '../types/gaslessPayment';

interface GaslessPaymentConfirmModalProps {
  paymentRequest: GaslessPaymentRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GaslessPaymentConfirmModal({
  paymentRequest,
  onConfirm,
  onCancel,
}: GaslessPaymentConfirmModalProps) {
  // 金額をフォーマット（18 decimals）
  const amount = (parseFloat(paymentRequest.amount) / 1e18).toFixed(2);

  // 有効期限をフォーマット
  const expiresAt = new Date(paymentRequest.valid_before * 1000).toLocaleString('ja-JP');

  // ステータスに応じた表示
  const isExpired = Date.now() / 1000 > paymentRequest.valid_before;
  const isCompleted = paymentRequest.status === 'completed';
  const isSigned = paymentRequest.status === 'signed';

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
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              marginBottom: '8px',
            }}
          >
            💳 お支払い内容の確認
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
            内容をご確認の上、署名してください
          </p>
        </div>

        {/* エラー/警告表示 */}
        {isExpired && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#ef4444',
            }}
          >
            ⚠️ この決済リクエストは有効期限切れです
          </div>
        )}

        {isCompleted && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#22c55e',
            }}
          >
            ✅ この決済は既に完了しています
          </div>
        )}

        {isSigned && (
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#3b82f6',
            }}
          >
            📝 署名済み - 店舗が決済を実行中です
          </div>
        )}

        {/* 支払い詳細 */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          {/* 金額 */}
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
              お支払い金額
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#667eea',
                lineHeight: 1,
              }}
            >
              ¥{amount}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
              JPYC
            </div>
          </div>

          {/* 店舗情報 */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '16px',
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                お支払い先
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {paymentRequest.merchant_address}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                決済ID (PIN)
              </div>
              <div
                style={{
                  fontSize: '16px',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '2px',
                }}
              >
                {paymentRequest.pin}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>
                有効期限
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>{expiresAt}</div>
            </div>
          </div>
        </div>

        {/* 注記 */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '8px', color: '#3b82f6' }}>
            💡 ガスレス決済について
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>ガス代（手数料）は店舗が負担します</li>
            <li>署名後、店舗側で決済が実行されます</li>
            <li>ウォレット内の資産は移動しません（署名のみ）</li>
          </ul>
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '16px',
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
            キャンセル
          </button>

          <button
            onClick={onConfirm}
            disabled={isExpired || isCompleted || isSigned}
            style={{
              flex: 1,
              padding: '16px',
              background:
                isExpired || isCompleted || isSigned
                  ? 'rgba(102, 126, 234, 0.3)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 600,
              cursor: isExpired || isCompleted || isSigned ? 'not-allowed' : 'pointer',
              boxShadow:
                isExpired || isCompleted || isSigned
                  ? 'none'
                  : '0 4px 12px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isExpired && !isCompleted && !isSigned) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
          >
            確認して署名
          </button>
        </div>
      </div>
    </div>
  );
}
