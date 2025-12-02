// src/pages/GaslessScannerTest.tsx
// ガスレス決済用QRスキャナーテストページ

import { useState, useEffect } from 'react';
import { useAddress, useSigner } from '@thirdweb-dev/react';
import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { QRScannerCamera } from '../components/QRScannerCamera';
import { getTokenConfig } from '../config/tokens';
import {
  decodeX402,
  formatPaymentAmount,
  isPaymentExpired,
  getTimeUntilExpiry,
  type X402PaymentData
} from '../utils/x402';
import { preparePermitPaymentParams } from '../utils/permitSignature';

// ERC20 ABI (最小限)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export function GaslessScannerTest() {
  const thirdwebAddress = useAddress();
  const thirdwebSigner = useSigner();
  const privyContext = usePrivy() as any;
  const { user, authenticated, wallets } = privyContext;

  const privyEmbeddedWalletAddress = user?.wallet?.address;
  const walletAddress = privyEmbeddedWalletAddress || thirdwebAddress || '';

  const [showScanner, setShowScanner] = useState(false);
  const [paymentData, setPaymentData] = useState<X402PaymentData | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [privySigner, setPrivySigner] = useState<ethers.Signer | null>(null);

  const jpycConfig = getTokenConfig('JPYC');
  const PAYMENT_GATEWAY_ADDRESS = import.meta.env.VITE_PAYMENT_GATEWAY_ADDRESS || '';

  // Signer取得（Privy経由）
  useEffect(() => {
    const getSigner = async () => {
      if (!wallets || wallets.length === 0) {
        setPrivySigner(null);
        return;
      }

      try {
        const wallet = wallets[0];
        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
        const ethersSigner = ethersProvider.getSigner();
        setPrivySigner(ethersSigner);
      } catch (error: any) {
        console.error('[ガスレススキャナー] Signer取得エラー:', error);
        setPrivySigner(null);
      }
    };

    if (authenticated) {
      getSigner();
    }
  }, [authenticated, wallets]);

  const signer = privySigner || thirdwebSigner;

  // QRコードスキャン処理
  const handleScan = async (data: string) => {
    try {
      setMessage({ type: 'info', text: 'QRコードを処理中...' });

      const decoded = decodeX402(data);

      // 有効期限チェック
      if (isPaymentExpired(decoded.expires)) {
        setMessage({ type: 'error', text: 'このQRコードは有効期限切れです' });
        return;
      }

      // 残高確認
      let userBalance = '0';
      try {
        const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/polygon');
        const tokenContract = new ethers.Contract(decoded.token, ERC20_ABI, readOnlyProvider);

        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();

        userBalance = ethers.utils.formatUnits(balance, decimals);
      } catch (balanceError: any) {
        console.error('残高取得エラー:', balanceError.message);
        userBalance = '0';
      }

      setPaymentData(decoded);
      setBalance(userBalance);
      setShowScanner(false);
      setMessage({ type: 'success', text: '✅ QRコード読み取り成功！' });

    } catch (error: any) {
      console.error('QRコード読み取りエラー:', error.message);
      setMessage({ type: 'error', text: 'QRコードの読み取りに失敗しました' });
      setShowScanner(false);
    }
  };

  // ガスレス決済の実行（Permit署名ベース）
  const handleGaslessPayment = async () => {
    if (!paymentData || !walletAddress || !signer) {
      setMessage({ type: 'error', text: 'ウォレットを接続してください' });
      return;
    }

    if (!PAYMENT_GATEWAY_ADDRESS) {
      setMessage({
        type: 'error',
        text: 'PaymentGatewayがデプロイされていません。.envにVITE_PAYMENT_GATEWAY_ADDRESSを設定してください'
      });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: 'info', text: 'Permit署名を準備中...' });

    try {

      // 1. Permitシグネチャを生成
      setMessage({ type: 'info', text: 'ウォレットで署名してください...' });

      const permitParams = await preparePermitPaymentParams(
        signer,
        PAYMENT_GATEWAY_ADDRESS,
        jpycConfig.currentAddress,
        paymentData.to,
        paymentData.amount,
        paymentData.requestId || `gasless_${Date.now()}`,
        30 // 30分の有効期限
      );

      // 2. PaymentGatewayコントラクトを呼び出し
      setMessage({ type: 'info', text: 'トランザクションを送信中...' });

      const gatewayContract = new ethers.Contract(
        PAYMENT_GATEWAY_ADDRESS,
        [
          'function executePaymentWithPermit(bytes32 requestId, address merchant, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external'
        ],
        signer
      );

      const tx = await gatewayContract.executePaymentWithPermit(
        permitParams.requestId,
        permitParams.merchant,
        permitParams.amount,
        permitParams.deadline,
        permitParams.v,
        permitParams.r,
        permitParams.s
      );

      setMessage({ type: 'info', text: 'トランザクション処理中...' });

      await tx.wait();

      setMessage({
        type: 'success',
        text: '✅ ガスレス決済が完了しました！'
      });

      setIsProcessing(false);

      // 3秒後にリセット
      setTimeout(() => {
        resetScan();
      }, 3000);

    } catch (error: any) {
      console.error('❌ ガスレス決済エラー:', error);

      let errorMessage = 'ガスレス決済に失敗しました';
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        errorMessage = '署名がキャンセルされました';
      } else if (error.message?.includes('Request already processed')) {
        errorMessage = 'この決済は既に完了しています';
      } else if (error.message?.includes('Permit expired')) {
        errorMessage = 'Permit署名の有効期限が切れています';
      } else if (error.message) {
        errorMessage = `エラー: ${error.message.substring(0, 100)}`;
      }

      setMessage({ type: 'error', text: errorMessage });
      setIsProcessing(false);
    }
  };

  // リセット
  const resetScan = () => {
    setPaymentData(null);
    setBalance('0');
    setMessage(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
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
          📱 ガスレス決済スキャナーテスト
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          カメラでQRコードをスキャンして、ガスレス決済をテストできます
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
            <div style={{ marginTop: '6px', fontSize: '12px' }}>
              残高: {balance} JPYC
            </div>
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

        {/* メッセージ表示 */}
        {message && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background:
                message.type === 'success'
                  ? 'rgba(34, 197, 94, 0.2)'
                  : message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(59, 130, 246, 0.2)',
              border: `2px solid ${
                message.type === 'success'
                  ? '#22c55e'
                  : message.type === 'error'
                  ? '#ef4444'
                  : '#3b82f6'
              }`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center',
              color:
                message.type === 'success'
                  ? '#065f46'
                  : message.type === 'error'
                  ? '#b91c1c'
                  : '#1e40af',
            }}
          >
            {message.text}
          </div>
        )}

        {/* スキャンボタン */}
        {!paymentData && (
          <button
            onClick={() => setShowScanner(true)}
            disabled={!walletAddress}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              fontWeight: 'bold',
              background: walletAddress
                ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                : '#e5e7eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              cursor: walletAddress ? 'pointer' : 'not-allowed',
              boxShadow: walletAddress ? '0 4px 16px rgba(16, 185, 129, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <img
              src="/CAMERA.png"
              alt="camera"
              style={{
                width: '28px',
                height: '28px',
              }}
            />
            QRコードをスキャン
          </button>
        )}

        {/* スキャン結果表示 */}
        {paymentData && (
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '2px solid #86efac',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 6, color: '#166534', fontWeight: 600 }}>
                支払い金額
              </div>
              <div style={{ fontSize: 42, fontWeight: 'bold', color: '#16a34a' }}>
                {formatPaymentAmount(paymentData.amount, jpycConfig.decimals)} JPYC
              </div>
              {paymentData.message && (
                <div style={{ marginTop: 8, fontSize: 14, color: '#166534' }}>
                  {paymentData.message}
                </div>
              )}
            </div>

            {/* 支払い先 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>
                支払い先
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  background: '#f3f4f6',
                  padding: 10,
                  borderRadius: 8,
                  wordBreak: 'break-all',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                }}
              >
                {paymentData.to}
              </div>
            </div>

            {/* 有効期限 */}
            {paymentData.expires && (
              <div style={{ marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
                有効期限: 残り {Math.floor(getTimeUntilExpiry(paymentData.expires) / 60)} 分
              </div>
            )}

            {/* ガスレスフラグ表示 */}
            {paymentData.gasless && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#1e40af',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                ⚡ ガスレス決済対応
              </div>
            )}

            {/* ボタン */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={resetScan}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleGaslessPayment}
                disabled={isProcessing}
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: isProcessing
                    ? '#d1d5db'
                    : 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.4)',
                }}
              >
                {isProcessing ? '処理中...' : '⚡ ガスレス決済'}
              </button>
            </div>
          </div>
        )}

        {/* QRスキャナー */}
        {showScanner && (
          <QRScannerCamera
            onScan={handleScan}
            onClose={() => setShowScanner(false)}
            placeholder="ガスレス決済QRコードをスキャン"
          />
        )}

        {/* テストリンク */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#10b981',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            🧪 QRコード生成でテスト
          </p>
          <a
            href="/gasless-qr-test"
            style={{
              fontSize: '15px',
              color: '#10b981',
              fontWeight: 'bold',
              textDecoration: 'underline',
            }}
          >
            QR生成テストページへ →
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
