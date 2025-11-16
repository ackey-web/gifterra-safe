// src/components/TipModal.tsx
// チップ送信モーダル（固定金額選択）

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useActiveAccount } from 'thirdweb/react';
import { performTransactionSecurityCheck } from '../utils/transactionSecurity';
import { TransactionSecurityModal } from './TransactionSecurityModal';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientAddress: string;
  recipientName: string;
  onSendTip: (amount: number) => Promise<void>;
  isMobile: boolean;
}

const TIP_AMOUNTS = [50, 100, 500, 1000, 3000];

export function TipModal({
  isOpen,
  onClose,
  recipientAddress,
  recipientName,
  onSendTip,
  isMobile,
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityCheckResult, setSecurityCheckResult] = useState<any>(null);
  const account = useActiveAccount();

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedAmount || isSending || !account) return;

    setIsSending(true);
    try {
      // セキュリティチェック実行
      const checkResult = await performTransactionSecurityCheck(
        account.address,
        selectedAmount
      );

      // アカウントが凍結されている場合
      if (checkResult.isFrozen) {
        alert(`アカウントが凍結されています\n理由: ${checkResult.freezeReason || '不明'}`);
        setIsSending(false);
        return;
      }

      // トランザクション制限に引っかかった場合
      if (!checkResult.allowed) {
        alert(`トランザクションが制限されています\n理由: ${checkResult.reason || '不明'}`);
        setIsSending(false);
        return;
      }

      // 確認が必要な場合（高額または疑わしい取引）
      if (checkResult.requiresConfirmation) {
        setSecurityCheckResult(checkResult);
        setShowSecurityModal(true);
        setIsSending(false);
        return;
      }

      // 問題なければ送信
      await onSendTip(selectedAmount);
      setSelectedAmount(null);
      onClose();
    } catch (error) {
      console.error('Security check or send failed:', error);
      alert('送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  const handleSecurityConfirm = async () => {
    if (!selectedAmount) return;

    setShowSecurityModal(false);
    setIsSending(true);
    try {
      await onSendTip(selectedAmount);
      setSelectedAmount(null);
      onClose();
    } catch (error) {
      console.error('Send failed after security confirmation:', error);
      alert('送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* セキュリティ確認モーダル */}
      {securityCheckResult && (
        <TransactionSecurityModal
          isOpen={showSecurityModal}
          onClose={() => setShowSecurityModal(false)}
          onConfirm={handleSecurityConfirm}
          amount={selectedAmount || 0}
          recipientName={recipientName}
          isHighAmount={securityCheckResult.isHighAmount || false}
          isSuspicious={securityCheckResult.isSuspicious || false}
          anomalyScore={securityCheckResult.anomalyScore}
          anomalyReasons={securityCheckResult.anomalyReasons}
          isMobile={isMobile}
        />
      )}

      {createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: isMobile ? '0' : '20px',
          }}
          onClick={onClose}
        >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: isMobile ? '0' : '20px',
          width: isMobile ? '100%' : '480px',
          maxWidth: '100%',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: isMobile ? '16px 20px' : '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: 700,
                color: '#EAF2FF',
                marginBottom: '4px',
              }}
            >
              チップを送る
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? '12px' : '13px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              {recipientName} に送信
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
          >
            ×
          </button>
        </div>

        {/* 金額選択 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '20px' : '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 600,
              color: '#EAF2FF',
              marginBottom: '16px',
            }}
          >
            金額を選択 (JPYC)
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',
              gap: '12px',
            }}
          >
            {TIP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                style={{
                  padding: isMobile ? '16px' : '20px',
                  background:
                    selectedAmount === amount
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border:
                    selectedAmount === amount
                      ? '2px solid rgba(102, 126, 234, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#EAF2FF',
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  if (selectedAmount !== amount) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedAmount !== amount) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <span>{amount.toLocaleString()}</span>
                <span
                  style={{
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: 500,
                    opacity: 0.8,
                  }}
                >
                  JPYC
                </span>
              </button>
            ))}
          </div>

          {selectedAmount && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(102, 126, 234, 0.1)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '8px',
                }}
              >
                送信内容
              </div>
              <div
                style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: 700,
                  color: '#EAF2FF',
                }}
              >
                {selectedAmount.toLocaleString()} JPYC
              </div>
              <div
                style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '4px',
                }}
              >
                送信先: {recipientName}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          style={{
            padding: isMobile ? '16px 20px' : '20px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '14px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#EAF2FF',
              fontSize: isMobile ? '14px' : '15px',
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
            onClick={handleSend}
            disabled={!selectedAmount || isSending}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '14px',
              background:
                !selectedAmount || isSending
                  ? 'rgba(102, 126, 234, 0.3)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#EAF2FF',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: 600,
              cursor: !selectedAmount || isSending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: !selectedAmount || isSending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (selectedAmount && !isSending) {
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedAmount && !isSending) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {isSending ? '送信中...' : 'チップを送る'}
          </button>
        </div>
      </div>
    </div>,
        document.body
      )}
    </>
  );
}
