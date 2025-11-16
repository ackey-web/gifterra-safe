// src/components/AccountDeletionModal.tsx
// アカウント退会確認モーダル

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { anonymizeAccount, getAccountDeletionSummary } from '../utils/accountDeletion';

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  walletAddress: string;
  isMobile: boolean;
}

export function AccountDeletionModal({
  isOpen,
  onClose,
  onSuccess,
  walletAddress,
  isMobile,
}: AccountDeletionModalProps) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [confirmation, setConfirmation] = useState('');
  const [accountSummary, setAccountSummary] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // アカウント情報を取得
      getAccountDeletionSummary(walletAddress).then(setAccountSummary);
      setStep('confirm');
      setConfirmation('');
      setErrorMessage('');
    }
  }, [isOpen, walletAddress]);

  const handleDelete = async () => {
    if (confirmation !== '退会する') {
      return;
    }

    setStep('processing');

    const result = await anonymizeAccount(walletAddress);

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } else {
      setStep('error');
      setErrorMessage(result.error || '予期しないエラーが発生しました');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
      }}
      onClick={step === 'confirm' ? onClose : undefined}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid rgba(220, 38, 38, 0.3)',
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
              color: '#FCA5A5',
            }}
          >
            ⚠️ アカウント退会
          </h2>
          {step === 'confirm' && (
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
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* コンテンツ */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          {step === 'confirm' && (
            <>
              {/* 警告メッセージ */}
              <div
                style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: 12,
                  padding: isMobile ? 16 : 20,
                  marginBottom: 24,
                }}
              >
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: 700,
                    color: '#ef4444',
                  }}
                >
                  この操作は取り消せません
                </h3>
                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 0 20px',
                    fontSize: isMobile ? 12 : 13,
                    color: 'rgba(252, 165, 165, 0.9)',
                    lineHeight: 1.6,
                  }}
                >
                  <li>プロフィール情報は即座に匿名化されます</li>
                  <li>表示名、自己紹介、アバター画像などは削除されます</li>
                  <li>フォロワーとのつながりは失われます</li>
                  <li>一度退会すると、復元することはできません</li>
                  <li>ブロックチェーン上の送金履歴は残ります</li>
                </ul>
              </div>

              {/* アカウント情報 */}
              {accountSummary && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: isMobile ? 16 : 20,
                    marginBottom: 24,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: isMobile ? 14 : 15,
                      fontWeight: 600,
                      color: '#EAF2FF',
                    }}
                  >
                    削除されるアカウント情報
                  </h4>
                  <div
                    style={{
                      fontSize: isMobile ? 12 : 13,
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: 1.6,
                    }}
                  >
                    <p style={{ margin: '0 0 8px 0' }}>
                      表示名: <strong style={{ color: '#EAF2FF' }}>{accountSummary.displayName}</strong>
                    </p>
                    <p style={{ margin: '0 0 8px 0' }}>
                      アカウント作成日:{' '}
                      {new Date(accountSummary.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                    <p style={{ margin: '0 0 8px 0' }}>
                      フォロワー: {accountSummary.followerCount}人
                    </p>
                    <p style={{ margin: 0 }}>
                      フォロー中: {accountSummary.followingCount}人
                    </p>
                  </div>
                </div>
              )}

              {/* 確認入力 */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  確認のため「退会する」と入力してください
                </label>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="退会する"
                  style={{
                    width: '100%',
                    padding: isMobile ? 12 : 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.5)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                />
              </div>

              {/* ボタン */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: isMobile ? 12 : 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmation !== '退会する'}
                  style={{
                    flex: 1,
                    padding: isMobile ? 12 : 14,
                    background:
                      confirmation === '退会する'
                        ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                        : 'rgba(220, 38, 38, 0.3)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 700,
                    cursor: confirmation === '退会する' ? 'pointer' : 'not-allowed',
                    opacity: confirmation === '退会する' ? 1 : 0.5,
                  }}
                >
                  退会する
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: isMobile ? 40 : 60 }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 48,
                  height: 48,
                  border: '4px solid rgba(255, 255, 255, 0.1)',
                  borderTop: '4px solid #ef4444',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: 20,
                }}
              />
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}
              </style>
              <p style={{ margin: 0, color: '#EAF2FF', fontSize: isMobile ? 14 : 15 }}>
                処理中...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: isMobile ? 40 : 60 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 700,
                  color: '#10b981',
                }}
              >
                退会が完了しました
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                ご利用ありがとうございました
              </p>
            </div>
          )}

          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: isMobile ? 40 : 60 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>❌</div>
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 700,
                  color: '#ef4444',
                }}
              >
                エラーが発生しました
              </h3>
              <p
                style={{
                  margin: '0 0 24px 0',
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {errorMessage}
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: isMobile ? 12 : 14,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  color: '#EAF2FF',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
