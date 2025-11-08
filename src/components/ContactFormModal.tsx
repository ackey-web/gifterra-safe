// src/components/ContactFormModal.tsx
// お問い合わせフォームモーダル

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

interface ContactFormModalProps {
  onClose: () => void;
  isMobile: boolean;
  userEmail?: string;
}

export function ContactFormModal({ onClose, isMobile, userEmail }: ContactFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !subject || !message) {
      setError('全ての項目を入力してください');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Supabaseにお問い合わせ内容を保存
      const { error: insertError } = await supabase
        .from('contact_inquiries')
        .insert([
          {
            name,
            email,
            subject,
            message,
            status: 'pending',
            created_at: new Date().toISOString(),
          }
        ]);

      if (insertError) throw insertError;

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('お問い合わせ送信エラー:', err);
      setError('送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
          borderRadius: isMobile ? 16 : 24,
          maxWidth: isMobile ? '100%' : 500,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
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
            {isSubmitted ? '送信完了' : 'お問い合わせ'}
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

        {/* コンテンツ */}
        <div style={{ padding: isMobile ? 20 : 24 }}>
          {isSubmitted ? (
            // 送信完了画面
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 64,
                  marginBottom: 16,
                }}
              >
                ✅
              </div>
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: isMobile ? 18 : 20,
                  fontWeight: 600,
                  color: '#EAF2FF',
                }}
              >
                お問い合わせを受け付けました
              </h3>
              <p
                style={{
                  margin: '0 0 24px 0',
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(255, 255, 255, 0.7)',
                  lineHeight: 1.6,
                }}
              >
                お問い合わせいただきありがとうございます。
                <br />
                <strong style={{ color: '#3b82f6' }}>48時間以内</strong>に担当者より
                <br />
                ご登録のメールアドレス宛に折り返しご連絡いたします。
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 32px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                閉じる
              </button>
            </div>
          ) : (
            // お問い合わせフォーム
            <form onSubmit={handleSubmit}>
              <p
                style={{
                  margin: '0 0 20px 0',
                  fontSize: isMobile ? 12 : 13,
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: 1.6,
                }}
              >
                お問い合わせ内容を入力してください。
                担当者が48時間以内にご連絡いたします。
              </p>

              {/* お名前 */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  お名前 <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* メールアドレス */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  メールアドレス <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* 件名 */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  件名 <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="お問い合わせの件名"
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* お問い合わせ内容 */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: '#EAF2FF',
                  }}
                >
                  お問い合わせ内容 <span style={{ color: '#f87171' }}>*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="お問い合わせ内容を詳しくご記入ください"
                  rows={6}
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#EAF2FF',
                    fontSize: isMobile ? 14 : 15,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>

              {/* エラーメッセージ */}
              {error && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    color: '#fca5a5',
                    fontSize: isMobile ? 13 : 14,
                  }}
                >
                  {error}
                </div>
              )}

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px' : '14px',
                  background: isSubmitting
                    ? 'rgba(100, 100, 100, 0.3)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: isMobile ? 15 : 16,
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSubmitting ? '送信中...' : '送信する'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
