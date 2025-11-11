// src/components/X402PaymentSection.tsx
// マイページ用X402決済セクション

import { useState } from 'react';
import { useSigner, useAddress } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { QRScannerSimple } from './QRScannerSimple';
import { supabase } from '../lib/supabase';
import { getTokenConfig } from '../config/tokens';
import {
  decodeX402,
  formatPaymentAmount,
  isPaymentExpired,
  getTimeUntilExpiry,
  type X402PaymentData
} from '../utils/x402';

// ERC20 ABI (最小限)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

interface X402PaymentSectionProps {
  isMobile?: boolean;
}

export function X402PaymentSection({ isMobile = false }: X402PaymentSectionProps) {
  const walletAddress = useAddress();
  const signer = useSigner();

  const [showScanner, setShowScanner] = useState(false);
  const [paymentData, setPaymentData] = useState<X402PaymentData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [balance, setBalance] = useState<string>('0');

  const jpycConfig = getTokenConfig('JPYC');

  // QRコードスキャン処理
  const handleScan = async (data: string) => {
    try {
      const decoded = decodeX402(data);

      // 有効期限チェック
      if (isPaymentExpired(decoded.expires)) {
        setMessage({ type: 'error', text: 'このQRコードは有効期限切れです' });
        return;
      }

      setPaymentData(decoded);
      setShowScanner(false);

      // 残高確認
      if (signer) {
        const tokenContract = new ethers.Contract(decoded.token, ERC20_ABI, signer);
        const userBalance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();
        setBalance(ethers.utils.formatUnits(userBalance, decimals));
      }

      setMessage({ type: 'info', text: '決済内容を確認してください' });
    } catch (error) {
      console.error('❌ QR decode error:', error);
      setMessage({ type: 'error', text: 'QRコードの読み取りに失敗しました' });
    }
  };

  // 支払い実行
  const handlePayment = async () => {
    if (!paymentData || !signer || !walletAddress) {
      setMessage({ type: 'error', text: 'ウォレットを接続してください' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // トークンコントラクトに接続
      const tokenContract = new ethers.Contract(paymentData.token, ERC20_ABI, signer);

      // 残高確認
      const userBalance = await tokenContract.balanceOf(walletAddress);
      if (userBalance.lt(paymentData.amount)) {
        setMessage({ type: 'error', text: '残高不足です' });
        setIsProcessing(false);
        return;
      }

      // トランザクション送信
      const tx = await tokenContract.transfer(paymentData.to, paymentData.amount);

      setMessage({ type: 'info', text: 'トランザクション送信中...' });

      // トランザクション確認待ち
      await tx.wait();

      // Supabaseの支払いリクエストを更新
      if (paymentData.requestId) {
        await supabase
          .from('payment_requests')
          .update({
            status: 'completed',
            completed_by: walletAddress.toLowerCase(),
            completed_at: new Date().toISOString(),
          })
          .eq('request_id', paymentData.requestId);
      }

      setMessage({ type: 'success', text: '✅ 支払いが完了しました！' });

      // 3秒後にリセット
      setTimeout(() => {
        setPaymentData(null);
        setMessage(null);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Payment error:', error);

      let errorMessage = '支払いに失敗しました';
      if (error.code === 4001) {
        errorMessage = 'トランザクションがキャンセルされました';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'ガス代が不足しています';
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '16px 20px' : '20px 28px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
      }}
    >
      <h3
        style={{
          margin: '0 0 16px 0',
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 'bold',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        💳 JPYC 決済
      </h3>

      {!paymentData ? (
        // QRスキャンボタン
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setShowScanner(true)}
            disabled={!walletAddress}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '16px',
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 'bold',
              background: walletAddress
                ? 'rgba(255,255,255,0.95)'
                : 'rgba(255,255,255,0.3)',
              color: walletAddress ? '#667eea' : '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: walletAddress ? 'pointer' : 'not-allowed',
              boxShadow: walletAddress ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <img
              src="/CAMERA.png"
              alt="camera"
              style={{
                width: isMobile ? '24px' : '28px',
                height: isMobile ? '24px' : '28px',
              }}
            />
            スキャンして支払う
          </button>

          {!walletAddress && (
            <p style={{ marginTop: '12px', fontSize: '13px', opacity: 0.9, color: '#fff' }}>
              ウォレット接続が必要です
            </p>
          )}
        </div>
      ) : (
        // 支払い確認画面
        <div>
          {/* 金額表示 */}
          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px', color: '#fff' }}>
              お支払い金額
            </div>
            <div style={{ fontSize: isMobile ? '36px' : '42px', fontWeight: 'bold', color: '#22c55e' }}>
              ¥{formatPaymentAmount(paymentData.amount, jpycConfig.decimals)}
            </div>
            {paymentData.message && (
              <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.9, color: '#fff' }}>
                {paymentData.message}
              </div>
            )}
          </div>

          {/* 支払先 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px', color: '#fff' }}>支払先</div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.2)',
                padding: '8px',
                borderRadius: '6px',
                wordBreak: 'break-all',
                color: '#fff',
              }}
            >
              {paymentData.to}
            </div>
          </div>

          {/* 残高表示 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px', color: '#fff' }}>
              あなたの残高
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>¥{balance} JPYC</div>
          </div>

          {/* 有効期限 */}
          {paymentData.expires && (
            <div style={{ marginBottom: '16px', fontSize: '12px', opacity: 0.9, color: '#fff' }}>
              有効期限: 残り {Math.floor(getTimeUntilExpiry(paymentData.expires) / 60)} 分
            </div>
          )}

          {/* ボタン */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                setPaymentData(null);
                setMessage(null);
              }}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '14px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: 'bold',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              style={{
                flex: 2,
                padding: isMobile ? '12px' : '14px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: 'bold',
                background: isProcessing
                  ? 'rgba(100,100,100,0.5)'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(34, 197, 94, 0.4)',
              }}
            >
              {isProcessing ? '処理中...' : '💰 支払う'}
            </button>
          </div>
        </div>
      )}

      {/* メッセージ表示 */}
      {message && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background:
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.2)'
                : message.type === 'error'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(59, 130, 246, 0.2)',
            border: `1px solid ${
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.5)'
                : message.type === 'error'
                ? 'rgba(239, 68, 68, 0.5)'
                : 'rgba(59, 130, 246, 0.5)'
            }`,
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center',
            color: '#fff',
          }}
        >
          {message.text}
        </div>
      )}

      {/* QRスキャナー */}
      {showScanner && (
        <QRScannerSimple
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          placeholder="X402決済QRコードを入力"
        />
      )}
    </div>
  );
}
