// src/admin/components/PaymentQRGenerator.tsx
// テナント向け決済QRコード生成コンポーネント

import { useState } from 'react';
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

    setIsGenerating(true);

    try {
      const amountWei = parsePaymentAmount(amount, jpycConfig.decimals);
      const expires = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
      const requestId = generateRequestId();

      // X402形式でエンコード
      const paymentData = encodeX402({
        to: walletAddress,
        token: jpycConfig.currentAddress,
        amount: amountWei,
        message: message || undefined,
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
          amount: amount,
          message: message || null,
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
    }
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
              <option value={3}>3分</option>
              <option value={5}>5分（推奨）</option>
              <option value={10}>10分</option>
              <option value={30}>30分</option>
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
              有効期限: {expiryMinutes}分
            </div>
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
    </div>
  );
}
