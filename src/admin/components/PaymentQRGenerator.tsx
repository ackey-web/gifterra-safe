// src/admin/components/PaymentQRGenerator.tsx
// テナント向け決済QRコード生成コンポーネント

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { supabase } from '../../lib/supabase';
import { getTokenConfig } from '../../config/tokens';
import { encodeX402, parsePaymentAmount, generateRequestId } from '../../utils/x402';

export function PaymentQRGenerator() {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const [qrData, setQrData] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isMobile] = useState(window.innerWidth < 768);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingGenerateData, setPendingGenerateData] = useState<{ amount: string; message: string; expiryMinutes: number } | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address || wallets[0]?.address || '';

  const jpycConfig = getTokenConfig('JPYC');

  const handleGenerate = async () => {
    setError('');

    // バリデーション
    if (!amount || parseFloat(amount) <= 0) {
      setError('金額を入力してください');
      return;
    }

    if (!walletAddress) {
      setError('ウォレットに接続してください');
      return;
    }

    // WEB決済（60分以上）の場合は確認モーダルを表示
    if (expiryMinutes >= 60) {
      setPendingGenerateData({ amount, message, expiryMinutes });
      setShowConfirmModal(true);
      return;
    }

    // 対面決済の場合は直接生成
    await executeGenerate(amount, message, expiryMinutes);
  };

  const executeGenerate = async (amt: string, msg: string, expiry: number) => {
    setError('');
    setIsGenerating(true);

    try {
      const amountWei = parsePaymentAmount(amt, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + (expiry * 60);
      const requestId = generateRequestId();

      // X402形式でエンコード
      const paymentData = encodeX402({
        to: walletAddress,
        token: jpycConfig.currentAddress,
        amount: amountWei,
        chainId: 137, // Polygon Mainnet
        message: msg || undefined,
        expires,
        requestId,
      });

      setQrData(paymentData);

      // Supabaseに記録
      const { error: dbError } = await supabase
        .from('payment_requests')
        .insert({
          request_id: requestId,
          tenant_address: walletAddress.toLowerCase(),
          amount: amt,
          message: msg || null,
          expires_at: new Date(expires * 1000).toISOString(),
          status: 'pending',
        });

      if (dbError) {
        console.error('Failed to save payment request:', dbError);
        // エラーでもQRは表示（記録は任意）
      }

    } catch (err: any) {
      console.error('QR generation error:', err);
      setError(err.message || 'QRコードの生成に失敗しました');
    } finally {
      setIsGenerating(false);
      setShowConfirmModal(false);
    }
  };

  // QRコードダウンロード機能
  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // SVGをPNGに変換してダウンロード
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `jpyc-payment-${amount}JPY-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleReset = () => {
    setAmount('');
    setMessage('');
    setQrData(null);
    setError('');
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a24 0%, #2d2d3a 100%)',
        borderRadius: isMobile ? 16 : 20,
        padding: isMobile ? 20 : 32,
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <h2
        style={{
          margin: '0 0 24px 0',
          fontSize: isMobile ? 20 : 24,
          fontWeight: 700,
          color: '#EAF2FF',
        }}
      >
        💳 決済QRコード生成
      </h2>

      {!qrData ? (
        <div>
          {/* 金額入力 */}
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
              金額 (JPYC) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 1500"
              step="0.01"
              min="0"
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '14px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          {/* メモ入力 */}
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
              メモ（任意）
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例: コーヒー x 2"
              maxLength={50}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                outline: 'none',
              }}
            />
          </div>

          {/* 有効期限 */}
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
              有効期限
            </label>
            <select
              value={expiryMinutes}
              onChange={(e) => setExpiryMinutes(Number(e.target.value))}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '12px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#EAF2FF',
                fontSize: isMobile ? 14 : 15,
                outline: 'none',
              }}
            >
              <optgroup label="対面決済">
                <option value={3}>3分</option>
                <option value={5}>5分（デフォルト）</option>
                <option value={10}>10分</option>
                <option value={15}>15分</option>
                <option value={30}>30分</option>
              </optgroup>
              <optgroup label="WEB決済">
                <option value={60}>1時間</option>
                <option value={360}>6時間</option>
                <option value={1440}>24時間</option>
                <option value={4320}>72時間</option>
                <option value={10080}>7日</option>
              </optgroup>
            </select>
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

          {/* 生成ボタン */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '16px',
              background: isGenerating
                ? 'rgba(100, 100, 100, 0.3)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? '生成中...' : '✨ QRコードを生成'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          {/* QRコード表示 */}
          <div
            ref={qrRef}
            style={{
              background: '#fff',
              padding: isMobile ? 20 : 24,
              borderRadius: 12,
              display: 'inline-block',
              marginBottom: 20,
            }}
          >
            <QRCodeSVG
              value={qrData}
              size={isMobile ? 250 : 300}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* 金額表示 */}
          <div
            style={{
              marginBottom: 20,
              padding: isMobile ? '16px' : '20px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 28 : 36,
                fontWeight: 700,
                color: '#60a5fa',
                marginBottom: 8,
              }}
            >
              {amount} JPYC
            </div>
            {message && (
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {message}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                fontSize: isMobile ? 11 : 12,
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              有効期限: {
                expiryMinutes >= 1440
                  ? `${Math.floor(expiryMinutes / 1440)}日`
                  : expiryMinutes >= 60
                    ? `${Math.floor(expiryMinutes / 60)}時間`
                    : `${expiryMinutes}分`
              }
            </div>
          </div>

          {/* ボタングループ */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button
              onClick={handleDownloadQR}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '14px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📥 QRコードをダウンロード
            </button>
          </div>

          {/* リセットボタン */}
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              padding: isMobile ? '12px' : '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#EAF2FF',
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔄 新しいQRを生成
          </button>
        </div>
      )}

      {/* WEB決済確認モーダル */}
      {showConfirmModal && pendingGenerateData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 16 : 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: isMobile ? 24 : 32,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '3px solid #f59e0b',
            }}
          >
            <h2
              style={{
                fontSize: isMobile ? 18 : 20,
                marginBottom: 16,
                textAlign: 'center',
                color: '#1a1a1a',
                fontWeight: 700,
              }}
            >
              ⚠️ WEB決済用QRコード生成確認
            </h2>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '2px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 12,
                padding: isMobile ? 16 : 20,
                marginBottom: 20,
                fontSize: isMobile ? 13 : 14,
                lineHeight: 1.8,
                color: '#1a1a1a',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontWeight: 600 }}>
                このコードはJPYC送受信リンクです。
              </p>
              <p style={{ margin: 0 }}>
                取引内容や請求情報にはGIFTERRAは関与しません。
              </p>
            </div>

            <div
              style={{
                marginBottom: 20,
                padding: isMobile ? 14 : 16,
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 10,
                fontSize: isMobile ? 13 : 14,
                color: '#1a1a1a',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong>金額:</strong> {pendingGenerateData.amount} JPYC
              </div>
              {pendingGenerateData.message && (
                <div style={{ marginBottom: 8 }}>
                  <strong>メモ:</strong> {pendingGenerateData.message}
                </div>
              )}
              <div>
                <strong>有効期限:</strong>{' '}
                {pendingGenerateData.expiryMinutes >= 1440
                  ? `${Math.floor(pendingGenerateData.expiryMinutes / 1440)}日`
                  : `${Math.floor(pendingGenerateData.expiryMinutes / 60)}時間`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingGenerateData(null);
                }}
                style={{
                  flex: 1,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (pendingGenerateData) {
                    executeGenerate(
                      pendingGenerateData.amount,
                      pendingGenerateData.message,
                      pendingGenerateData.expiryMinutes
                    );
                  }
                }}
                style={{
                  flex: 2,
                  padding: isMobile ? 12 : 14,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                }}
              >
                確認して生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
