// src/pages/PaymentScanPage.tsx
// スマホ向けX402決済QRスキャン&支払いページ

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAddress, useContract, useSigner } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { QRScannerSimple } from '../components/QRScannerSimple';
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
  'function symbol() view returns (string)',
];

export function PaymentScanPage() {
  const { user, authenticated } = usePrivy();
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
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ヘッダー */}
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', fontWeight: 'bold' }}>
          💳 JPYC 決済
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
          {authenticated ? `${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-6)}` : 'ウォレット未接続'}
        </p>
      </header>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {!paymentData ? (
          // QRスキャンボタン
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <div style={{ fontSize: '80px', marginBottom: '30px' }}>📱</div>
            <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>QRコードをスキャン</h2>
            <p style={{ opacity: 0.8, marginBottom: '40px', fontSize: '15px' }}>
              店舗のレジに表示されたQRコードを読み取ってください
            </p>

            <button
              onClick={() => setShowScanner(true)}
              disabled={!authenticated}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '18px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: authenticated
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: authenticated ? 'pointer' : 'not-allowed',
                boxShadow: authenticated ? '0 4px 20px rgba(16, 185, 129, 0.4)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {authenticated ? 'QRスキャン開始' : 'ログインしてください'}
            </button>

            {!authenticated && (
              <div style={{ marginTop: '20px' }}>
                <a
                  href="/login"
                  style={{
                    color: '#fff',
                    textDecoration: 'underline',
                    opacity: 0.9,
                  }}
                >
                  ログインページへ →
                </a>
              </div>
            )}
          </div>
        ) : (
          // 支払い確認画面
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '30px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <h2 style={{ fontSize: '22px', marginBottom: '24px', textAlign: 'center' }}>
              支払い内容の確認
            </h2>

            {/* 金額表示 */}
            <div
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>お支払い金額</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#22c55e' }}>
                ¥{formatPaymentAmount(paymentData.amount, jpycConfig.decimals)}
              </div>
              {paymentData.message && (
                <div style={{ marginTop: '12px', fontSize: '14px', opacity: 0.9 }}>
                  {paymentData.message}
                </div>
              )}
            </div>

            {/* 支払先情報 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '4px' }}>支払先</div>
              <div
                style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  wordBreak: 'break-all',
                }}
              >
                {paymentData.to}
              </div>
            </div>

            {/* 残高表示 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '4px' }}>あなたの残高</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>¥{balance} JPYC</div>
            </div>

            {/* 有効期限 */}
            {paymentData.expires && (
              <div style={{ marginBottom: '24px', fontSize: '13px', opacity: 0.8 }}>
                有効期限: 残り {Math.floor(getTimeUntilExpiry(paymentData.expires) / 60)} 分
              </div>
            )}

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setPaymentData(null);
                  setMessage(null);
                }}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
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
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: isProcessing
                    ? 'rgba(100,100,100,0.5)'
                    : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: isProcessing ? 'none' : '0 4px 20px rgba(34, 197, 94, 0.4)',
                }}
              >
                {isProcessing ? '処理中...' : '支払う'}
              </button>
            </div>
          </div>
        )}

        {/* メッセージ表示 */}
        {message && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px 20px',
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
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {message.text}
          </div>
        )}
      </div>

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
