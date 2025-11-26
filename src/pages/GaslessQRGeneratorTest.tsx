// src/pages/GaslessQRGeneratorTest.tsx
// ガスレス決済用QRコード生成テストページ

import { useState } from 'react';
import { useAddress } from '@thirdweb-dev/react';
import { QRCodeSVG } from 'qrcode.react';
import { ethers } from 'ethers';
import { getTokenConfig } from '../config/tokens';

export function GaslessQRGeneratorTest() {
  const walletAddress = useAddress();
  const jpycConfig = getTokenConfig('JPYC');

  const [amount, setAmount] = useState('100');
  const [message, setMessage] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState('30');
  const [qrData, setQrData] = useState<string | null>(null);

  // QRコード生成
  const generateQR = () => {
    if (!walletAddress) {
      alert('ウォレットを接続してください');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('有効な金額を入力してください');
      return;
    }

    try {
      // X402形式のペイメントリクエスト作成
      const amountWei = ethers.utils.parseUnits(amount, jpycConfig.decimals);
      const expiryTime = Date.now() + parseInt(expiryMinutes) * 60 * 1000;
      const requestId = `gasless_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const paymentData = {
        to: walletAddress, // 受取アドレス
        token: jpycConfig.currentAddress, // JPYCトークンアドレス
        amount: amountWei.toString(),
        chainId: 137, // Polygon Mainnet
        expires: expiryTime,
        message: message || undefined,
        requestId: requestId,
        gasless: true, // ガスレス決済フラグ
      };

      const qrString = JSON.stringify(paymentData);
      setQrData(qrString);

      console.log('✅ QRコード生成成功:', paymentData);
    } catch (error: any) {
      console.error('❌ QRコード生成エラー:', error);
      alert('QRコード生成に失敗しました: ' + error.message);
    }
  };

  // QRコードをクリア
  const clearQR = () => {
    setQrData(null);
    setAmount('100');
    setMessage('');
  };

  // QRデータをコピー
  const copyQRData = () => {
    if (qrData) {
      navigator.clipboard.writeText(qrData);
      alert('QRデータをクリップボードにコピーしました');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          🧪 ガスレス決済QR生成テスト
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          JPYC決済用のQRコードを生成して、スキャナーでテストできます
        </p>

        {/* ウォレット接続状態 */}
        {walletAddress ? (
          <div
            style={{
              background: '#d1fae5',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#065f46',
              fontWeight: 600,
            }}
          >
            ✅ ウォレット接続済み: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </div>
        ) : (
          <div
            style={{
              background: '#fee2e2',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#b91c1c',
              fontWeight: 600,
            }}
          >
            ❌ ウォレットが接続されていません
          </div>
        )}

        {/* QR生成フォーム */}
        {!qrData && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                金額 (JPYC)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                メッセージ (オプション)
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="例: コーヒー代"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                有効期限 (分)
              </label>
              <input
                type="number"
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(e.target.value)}
                placeholder="30"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={generateQR}
              disabled={!walletAddress}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: walletAddress
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#e5e7eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                cursor: walletAddress ? 'pointer' : 'not-allowed',
                boxShadow: walletAddress ? '0 4px 16px rgba(102, 126, 234, 0.4)' : 'none',
              }}
            >
              QRコードを生成
            </button>
          </div>
        )}

        {/* 生成されたQRコード */}
        {qrData && (
          <div>
            <div
              style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                marginBottom: '20px',
              }}
            >
              <QRCodeSVG
                value={qrData}
                size={280}
                level="H"
                style={{
                  border: '8px solid white',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}
              />
              <p
                style={{
                  marginTop: '16px',
                  fontSize: '14px',
                  color: '#6b7280',
                  fontWeight: '600',
                }}
              >
                {amount} JPYC の請求QRコード
              </p>
            </div>

            {/* QRデータ表示 */}
            <div
              style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                maxHeight: '150px',
                overflow: 'auto',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#374151',
                  margin: 0,
                  wordBreak: 'break-all',
                }}
              >
                {qrData}
              </p>
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={copyQRData}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                }}
              >
                📋 コピー
              </button>
              <button
                onClick={clearQR}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                🔄 リセット
              </button>
            </div>
          </div>
        )}

        {/* テストリンク */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(102, 126, 234, 0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#667eea',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            📱 スキャナーでテスト
          </p>
          <a
            href="/gasless-scanner-test"
            style={{
              fontSize: '15px',
              color: '#667eea',
              fontWeight: 'bold',
              textDecoration: 'underline',
            }}
          >
            スキャナーテストページへ →
          </a>
        </div>

        {/* ホームリンク */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <a
            href="/mypage"
            style={{
              fontSize: '14px',
              color: '#6b7280',
              textDecoration: 'underline',
            }}
          >
            マイページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
